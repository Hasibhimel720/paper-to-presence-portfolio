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
import { createDemoContent } from "@/lib/cms/demo-content";
import { toLegacyPortfolioContent } from "@/lib/cms/public-content";
import type { ContentSnapshot, Project } from "@/lib/cms/schema";
import { SiteNav } from "@/components/site/Chrome";
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
  it("renders the configured navigation logo from the supplied media URL", async () => {
    const snapshot: ContentSnapshot = await createDemoContent();
    const logo = {
      id: "a1b2c3d4-e5f6-4789-a123-123456789abc",
      source: {
        kind: "storage" as const,
        key: "portfolio/a1b2c3d4-e5f6-4789-a123-123456789abc/logo.png",
      },
      alt: "Portfolio logo",
    };
    snapshot.media.push(logo);
    snapshot.navigationLogo = { mediaId: logo.id, alt: logo.alt };
    renderWithRoutes(
      <SiteNav
        snapshot={snapshot}
        mediaUrls={{ [logo.id]: "https://images.example.test/logo-signed.png" }}
      />,
    );

    const image = await screen.findByRole("img", { name: "Portfolio logo" });
    expect(image).toHaveAttribute("src", "https://images.example.test/logo-signed.png");
    expect(image).toHaveClass("max-h-10", "max-w-10", "object-contain");
    expect(screen.queryByText("H.", { exact: true })).not.toBeInTheDocument();
  });

  it("renders the configured profile photograph in the public About section", async () => {
    installIntersectionObserverStub();
    const snapshot = await createDemoContent();
    const portrait = {
      id: "profile-photo-test",
      source: {
        kind: "storage" as const,
        key: "portfolio/profile-photo-test/profile-photo-test.webp",
      },
      alt: "Portrait of Hasib",
    };
    const signedUrl = "https://images.example.test/profile-photo-signed.webp";
    snapshot.media.push(portrait);
    snapshot.profile.portrait = { mediaId: portrait.id, alt: portrait.alt };

    renderWithRoutes(
      <PortfolioPage
        content={portfolioRepository.getPublishedContent()}
        snapshot={snapshot}
        mediaUrls={{ [portrait.id]: signedUrl }}
      />,
    );

    const image = await screen.findByRole("img", { name: "Portrait of Hasib" });
    expect(image).toHaveAttribute("src", signedUrl);
    expect(image).toHaveClass("h-full", "w-full", "object-cover");
    expect(screen.queryByText(/Placeholder · replace with your portrait/)).not.toBeInTheDocument();
  });

  it("renders software icons accessibly without exposing tool descriptions", async () => {
    installIntersectionObserverStub();
    const snapshot = await createDemoContent();
    snapshot.profile.toolkit[0]!.use = "PRIVATE DESCRIPTION THAT MUST NOT APPEAR";
    snapshot.profile.toolkit[0]!.icon = "illustrator";

    renderWithRoutes(
      <PortfolioPage content={portfolioRepository.getPublishedContent()} snapshot={snapshot} />,
    );

    expect(await screen.findByRole("img", { name: "Adobe Illustrator" })).toBeInTheDocument();
    expect(screen.queryByText("Adobe Illustrator", { exact: true })).not.toBeInTheDocument();
    expect(screen.queryByText("PRIVATE DESCRIPTION THAT MUST NOT APPEAR")).not.toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Software icons" })).toBeInTheDocument();
  });

  it("renders an individually configured service image on the public homepage", async () => {
    installIntersectionObserverStub();
    const snapshot = await createDemoContent();
    const service = snapshot.services[0]!;
    const mediaId = "service-render-image";
    service.image = {
      mediaId,
      alt: "Brand identity custom image",
      focalPoint: { x: 0.25, y: 0.6 },
    };
    service.imageFit = "contain";
    snapshot.media.push({
      id: mediaId,
      source: { kind: "storage", key: `portfolio/${mediaId}/${mediaId}.webp` },
      mimeType: "image/webp",
      sizeBytes: 1200,
      alt: service.image.alt,
    });
    const mediaUrls = { [mediaId]: "https://images.example.test/service-render.webp" };

    renderWithRoutes(
      <PortfolioPage
        content={toLegacyPortfolioContent(snapshot, mediaUrls)}
        snapshot={snapshot}
        mediaUrls={mediaUrls}
      />,
    );

    const image = await screen.findByRole("img", { name: "Brand identity custom image" });
    expect(image).toHaveAttribute("src", mediaUrls[mediaId]);
    expect(image).toHaveStyle({ objectFit: "contain", objectPosition: "25% 60%" });
    expect(image.parentElement).toHaveClass("service-image-frame");
  });

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
    expect(screen.getByText("Placeholder · replace with your portrait")).toBeInTheDocument();
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

  it("keeps the Selected Work marquee horizontally duplicated", async () => {
    installIntersectionObserverStub();
    const content = portfolioRepository.getPublishedContent();
    const snapshot = await createDemoContent();
    renderWithRoutes(<PortfolioPage content={content} snapshot={snapshot} />);
    await screen.findByRole("heading", { name: /Where Strategy Becomes Identity/ });
    const viewport = document.querySelector(".marquee-viewport");
    const track = viewport?.querySelector(".animate-marquee");

    expect(viewport).toBeInTheDocument();
    expect(viewport).not.toHaveClass("marquee-tilt");
    expect(track?.querySelectorAll(".marquee-card")).toHaveLength(content.featuredSlugs.length * 2);
  });

  it("renders the Hero proof points from the snapshot content", async () => {
    installIntersectionObserverStub();
    const snapshot = await createDemoContent();
    const hero = snapshot.pages
      .find(({ slug }) => slug === "/")
      ?.sections.find((section) => section.type === "hero");
    if (!hero || hero.type !== "hero") throw new Error("Expected the homepage Hero section.");
    hero.data.projectsShippedCount = "200+";
    hero.data.projectsShippedText = "projects delivered";
    hero.data.trustedByIntro = "Chosen by";
    hero.data.trustedByClients = "North Studio, Bright Co.";
    hero.data.serviceCategories = "Identity · Packaging · Campaigns";

    renderWithRoutes(
      <PortfolioPage content={portfolioRepository.getPublishedContent()} snapshot={snapshot} />,
    );

    expect(await screen.findByText("200+ projects delivered")).toBeInTheDocument();
    expect(await screen.findByText("Chosen by North Studio, Bright Co.")).toBeInTheDocument();
    expect(await screen.findByText("Identity · Packaging · Campaigns")).toBeInTheDocument();
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

  it("renders CMS project galleries, captions, hero alt text, and visible section layouts", async () => {
    installIntersectionObserverStub();
    const snapshot = await createDemoContent();
    const projectRecord = snapshot.projects[0]!;
    const media = [
      { id: "hero-media", alt: "Hero artwork" },
      { id: "gallery-one", alt: "Gallery artwork one", caption: "Primary packaging" },
      { id: "gallery-two", alt: "Gallery artwork two" },
      { id: "section-one", alt: "Section detail one" },
      { id: "section-two", alt: "Section detail two" },
    ];
    snapshot.media.push(
      ...media.map(({ id, alt }) => ({
        id,
        source: { kind: "storage" as const, key: `portfolio/${id}/${id}.webp` },
        mimeType: "image/webp",
        alt,
      })),
    );
    const reference = ({ id, alt, caption }: (typeof media)[number]) => ({
      mediaId: id,
      alt,
      ...(caption === undefined ? {} : { caption }),
    });
    projectRecord.heroMedia = reference(media[0]!);
    projectRecord.gallery = [reference(media[1]!), reference(media[2]!)];
    projectRecord.galleryLayout = "two-column";
    projectRecord.sections = [
      {
        id: "story-section",
        order: 0,
        title: "Story",
        body: "Visible narrative",
        visible: true,
        galleryLayout: "carousel",
        media: [reference(media[3]!), reference(media[4]!)],
      },
      {
        id: "hidden-section",
        order: 1,
        title: "Private section",
        body: "Private narrative",
        visible: false,
        media: [],
      },
    ];
    const mediaUrls = Object.fromEntries(
      media.map(({ id }) => [id, `https://images.example.test/${id}.webp`]),
    );
    const projects = toLegacyPortfolioContent(snapshot, mediaUrls).projects;
    const project = projects.find(({ slug }) => slug === projectRecord.slug);
    if (!project) throw new Error("Expected the public CMS project.");

    renderWithRoutes(
      <CaseStudyPage
        project={project}
        prev={project}
        next={project}
        snapshot={snapshot}
        mediaUrls={mediaUrls}
      />,
      `/work/${project.slug}`,
    );

    expect(await screen.findByRole("img", { name: "Hero artwork" })).toHaveAttribute(
      "src",
      mediaUrls["hero-media"],
    );
    expect(screen.getByRole("img", { name: "Gallery artwork one" })).toBeInTheDocument();
    expect(screen.getByText("Primary packaging")).toBeInTheDocument();
    expect(screen.getByText("Visible narrative")).toBeInTheDocument();
    expect(screen.queryByText("Private narrative")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next Story section image" }));
    expect(screen.getByRole("img", { name: "Section detail two" })).toBeInTheDocument();
  });
});
