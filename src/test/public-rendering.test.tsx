import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { portfolioRepository, createStaticPortfolioRepository } from "@/lib/cms/repository";
import type { Project } from "@/lib/cms/schema";
import { PortfolioPage } from "@/routes/index";
import { CaseStudyPage } from "@/routes/work.$slug";

function renderWithRoutes(component: React.ReactNode, initialPath = "/") {
  const rootRoute = createRootRoute({ component: Outlet });
  const homeRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: () => component,
  });
  const workRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/work/$slug",
    component: () => component,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([homeRoute, workRoute]),
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  });

  return render(<RouterProvider router={router} />);
}

function installIntersectionObserverStub() {
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("public portfolio rendering", () => {
  it("preserves the static homepage content and project filtering", async () => {
    installIntersectionObserverStub();
    const content = portfolioRepository.getPublishedContent();
    const { container } = renderWithRoutes(<PortfolioPage content={content} />);

    expect(
      await screen.findByRole("heading", { level: 1, name: /Where Strategy Becomes Identity/ }),
    ).toBeInTheDocument();
    expect(screen.getByText(`${content.projects.length} projects shipped`)).toBeInTheDocument();
    expect(
      screen.getByText(/Trusted by teams at RRP Group, Ruby Tech, Gheewaali/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Every project, one place to explore/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /From first brief to final file/ }),
    ).toBeInTheDocument();

    const workSection = container.querySelector<HTMLElement>("#work");
    if (!workSection) throw new Error("Expected the public work section.");
    const work = within(workSection);
    fireEvent.click(work.getByRole("tab", { name: /Brand Identity/ }));
    expect(work.getByRole("link", { name: /Nakano International/ })).toBeInTheDocument();
    expect(work.queryByRole("link", { name: /Garden Green Fresh Tea/ })).not.toBeInTheDocument();
  });

  it("renders intentionally when optional collections are empty", async () => {
    installIntersectionObserverStub();
    const current = portfolioRepository.getPublishedContent();
    const emptyContent = createStaticPortfolioRepository({
      ...current,
      categories: [],
      projects: [],
      featuredSlugs: [],
      services: [],
      experience: [],
      process: [],
      processOutcomes: [],
      faqs: [],
    }).getPublishedContent();
    const { container } = renderWithRoutes(<PortfolioPage content={emptyContent} />);

    expect(
      await screen.findByRole("heading", { level: 1, name: /Where Strategy Becomes Identity/ }),
    ).toBeInTheDocument();
    expect(screen.getByText("0 projects shipped")).toBeInTheDocument();
    expect(screen.queryByText(/Trusted by teams at/)).not.toBeInTheDocument();
    expect(container.querySelector("#experience")).not.toBeInTheDocument();
    expect(screen.queryByText("Ask me")).not.toBeInTheDocument();
    expect(screen.queryByText(/Process · 5 steps/)).not.toBeInTheDocument();
    expect(container.querySelector("#services")).not.toBeInTheDocument();
    expect(screen.getByText("No projects in this category yet.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Project highlights")).not.toBeInTheDocument();
    expect(screen.queryAllByRole("tab")).toHaveLength(0);
  });

  it("omits empty process outcomes without hiding populated steps", async () => {
    installIntersectionObserverStub();
    const current = portfolioRepository.getPublishedContent();
    const content = createStaticPortfolioRepository({
      ...current,
      processOutcomes: current.process.map(() => ""),
    }).getPublishedContent();

    renderWithRoutes(<PortfolioPage content={content} />);

    expect(await screen.findByRole("heading", { name: /From first brief to/ })).toBeInTheDocument();
    expect(screen.getAllByText(/Step \d+/)).toHaveLength(content.process.length);
    expect(screen.queryByText("You get")).not.toBeInTheDocument();
  });

  it("renders projects without sections or palette and resolves missing slugs safely", async () => {
    installIntersectionObserverStub();
    const original = portfolioRepository.getPublishedContent().projects[0];
    if (!original) throw new Error("Expected a static project fixture.");
    const project: Project = { ...original, sections: [], palette: [] };

    renderWithRoutes(
      <CaseStudyPage project={project} prev={project} next={project} />,
      `/work/${project.slug}`,
    );

    expect(
      await screen.findByRole("heading", { level: 1, name: project.title }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Color system")).not.toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Project navigation" })).toBeInTheDocument();
  });
});
