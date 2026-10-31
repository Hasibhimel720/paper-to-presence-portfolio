import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminShell } from "@/components/admin/AdminShell";
import { ProjectsWorkspace } from "@/components/admin/ProjectsWorkspace";
import { createDemoContent } from "@/lib/cms/demo-content";
import { contentSnapshotSchema, type ContentSnapshot } from "@/lib/cms/schema";

const cmsServerMocks = vi.hoisted(() => ({
  listAdminCmsMediaServerFn: vi.fn(),
  loadAdminCmsServerFn: vi.fn(),
  publishAdminCmsDraftServerFn: vi.fn(),
  restoreAdminCmsRevisionServerFn: vi.fn(),
  saveAdminCmsDraftServerFn: vi.fn(),
  unpublishAdminCmsServerFn: vi.fn(),
}));

vi.mock("@/lib/cms/server-functions", () => cmsServerMocks);

vi.mock("@/routes/index", () => ({
  PortfolioPage: () => null,
}));

afterEach(() => {
  vi.restoreAllMocks();
});

function openWorkspace(label: string) {
  fireEvent.click(screen.getAllByRole("button", { name: label })[0]!);
}

async function renderDashboard() {
  render(<AdminShell onSignOut={vi.fn()} signingOut={false} />);
  await screen.findByRole("heading", { name: "Good to see you" });
}

function projectCard(title: string) {
  const card = screen
    .getAllByRole("article")
    .find((article) => article.textContent?.includes(title));
  if (!card) throw new Error(`Expected project card "${title}".`);
  return card;
}

function pageList() {
  const aside = screen
    .getAllByRole("complementary")
    .find((element) => element.textContent?.includes("Site pages"));
  if (!aside) throw new Error("Expected the site pages navigation list.");
  return aside;
}

function pageEditor() {
  return screen.getByRole("region", { name: /page details/ });
}

function sectionList() {
  const list = screen
    .getAllByRole("list")
    .find((element) => element.querySelectorAll("li").length > 8);
  if (!list) throw new Error("Expected the page section list.");
  return list;
}

function ProjectsHarness({ initial }: { initial: ContentSnapshot }) {
  const [snapshot, setSnapshot] = useState(initial);
  return <ProjectsWorkspace snapshot={snapshot} onChange={setSnapshot} />;
}

async function createPage(title: string, slug: string) {
  fireEvent.click(screen.getByRole("button", { name: "Add page" }));
  fireEvent.change(within(pageEditor()).getByLabelText("Page title"), {
    target: { value: title },
  });
  fireEvent.change(within(pageEditor()).getByLabelText("Path / slug"), { target: { value: slug } });
  fireEvent.click(screen.getByRole("button", { name: "Apply changes" }));
  await screen.findByRole("heading", { name: title });
}

describe("local CMS demo content", () => {
  it("loads a validated static baseline without implying CMS publication", async () => {
    const snapshot = await createDemoContent();

    expect(snapshot.origin).toBe("static-baseline");
    expect(snapshot.publication).toEqual({
      status: "static-baseline",
      publishedRevisionId: null,
      draftRevisionId: null,
      updatedAt: null,
    });
    expect(snapshot.revisions).toEqual([]);
    expect(contentSnapshotSchema.safeParse(snapshot).success).toBe(true);
  });

  it("returns defensive copies so demo edits cannot mutate repository content", async () => {
    const first = await createDemoContent();
    const originalTitle = first.projects[0]?.title;
    if (!first.projects[0])
      throw new Error("Expected the portfolio baseline to include a project.");
    first.projects[0].title = "Temporary demo edit";

    const second = await createDemoContent();
    expect(second.projects[0]?.title).toBe(originalTitle);
  });
});

describe("admin dashboard shared state", () => {
  it("keeps the editing workspace available when the authenticated CMS cannot be loaded", async () => {
    cmsServerMocks.loadAdminCmsServerFn.mockRejectedValue(
      new Error("CMS server configuration is incomplete."),
    );

    render(
      <AdminShell
        onSignOut={vi.fn()}
        signingOut={false}
        getAccessToken={async () => "authenticated-token"}
      />,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "CMS server configuration is incomplete.",
    );
    expect(screen.getByRole("heading", { name: "Good to see you" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Preview edits" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Save draft" })).toBeEnabled();
    expect(screen.getByText(/changes will not reach the live website/i)).toBeInTheDocument();
    expect(screen.queryByText(/Demo mode/)).not.toBeInTheDocument();
    expect(cmsServerMocks.listAdminCmsMediaServerFn).not.toHaveBeenCalled();

    openWorkspace("Pages");
    expect(await screen.findByRole("heading", { name: "Pages" })).toBeInTheDocument();
    await createPage("Available page", "/available-page");
  });

  it("keeps the existing overview and authentication sign-out action", async () => {
    const onSignOut = vi.fn();
    render(<AdminShell onSignOut={onSignOut} signingOut={false} />);

    expect(await screen.findByRole("heading", { name: "Good to see you" })).toBeInTheDocument();
    expect(screen.getByText("Static content baseline")).toBeInTheDocument();
    expect(screen.getByText(/changes reset on refresh/i)).toBeInTheDocument();
    expect(screen.getByText(/No database reads or writes/)).toBeInTheDocument();

    const signOutButton = screen
      .getAllByRole("button", { name: "Sign out" })
      .find((button) => button.closest("aside"));
    if (!signOutButton) throw new Error("Expected the desktop sign-out control.");
    fireEvent.click(signOutButton);
    expect(onSignOut).toHaveBeenCalledOnce();
  });

  it("opens and closes an inline draft preview without claiming publication", async () => {
    await renderDashboard();
    fireEvent.click(screen.getByRole("button", { name: "Preview edits" }));

    expect(screen.getByRole("dialog", { name: "Draft preview" })).toBeInTheDocument();
    expect(screen.getByText(/Private to this signed-in session/)).toBeInTheDocument();
    expect(screen.getByText(/previewing does not save or publish/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Close preview" }));
    expect(screen.queryByRole("dialog", { name: "Draft preview" })).not.toBeInTheDocument();
  });

  it("commits page edits to shared state and retains them across workspace navigation", async () => {
    await renderDashboard();
    openWorkspace("Pages");
    expect(await screen.findByRole("heading", { name: "Pages" })).toBeInTheDocument();

    await createPage("Demo page", "/demo-page");
    fireEvent.click(screen.getByRole("button", { name: "Edit page" }));
    fireEvent.change(screen.getByLabelText("Section type"), { target: { value: "contact" } });
    fireEvent.click(screen.getByRole("button", { name: "Add section" }));
    fireEvent.click(screen.getByRole("button", { name: "Apply changes" }));
    expect(await screen.findByText(/Page changes are applied/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Edit page" }));
    fireEvent.change(within(pageEditor()).getByLabelText("Page title"), {
      target: { value: "Updated demo page" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply changes" }));
    expect(await screen.findByRole("heading", { name: "Updated demo page" })).toBeInTheDocument();

    openWorkspace("Projects");
    expect(await screen.findByRole("heading", { name: "Projects" })).toBeInTheDocument();
    openWorkspace("Pages");
    expect(await screen.findByRole("heading", { name: "Updated demo page" })).toBeInTheDocument();
    expect(screen.getAllByText("/demo-page").length).toBeGreaterThan(0);
  });

  it("cancels edits and rejects duplicate page paths with validation feedback", async () => {
    await renderDashboard();
    openWorkspace("Pages");
    await screen.findByRole("heading", { name: "Pages" });
    await createPage("Cancel candidate", "/cancel-candidate");

    fireEvent.click(screen.getByRole("button", { name: "Edit page" }));
    fireEvent.change(within(pageEditor()).getByLabelText("Page title"), {
      target: { value: "Unsaved title" },
    });
    openWorkspace("Projects");
    openWorkspace("Pages");
    expect(within(pageEditor()).getByLabelText("Page title")).toHaveValue("Unsaved title");
    fireEvent.click(screen.getByRole("button", { name: "Cancel changes" }));
    expect(await screen.findByRole("heading", { name: "Cancel candidate" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Unsaved title" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Add page" }));
    fireEvent.change(within(pageEditor()).getByLabelText("Page title"), {
      target: { value: "Duplicate path" },
    });
    fireEvent.change(within(pageEditor()).getByLabelText("Path / slug"), {
      target: { value: "/cancel-candidate" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply changes" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(
      within(pageList()).queryByRole("button", { name: /Duplicate path/ }),
    ).not.toBeInTheDocument();
  });

  it("moves the page whose control was clicked and keeps its selected editor correct", async () => {
    await renderDashboard();
    openWorkspace("Pages");
    await screen.findByRole("heading", { name: "Pages" });
    await createPage("Second page", "/second-page");

    const list = pageList();
    fireEvent.click(within(list).getByRole("button", { name: "Move Second page up" }));

    const pageButtons = within(list)
      .getAllByRole("button")
      .filter((button) => !button.hasAttribute("aria-label"));
    expect(pageButtons[0]).toHaveTextContent("Second page");
    expect(pageButtons[1]).toHaveTextContent("Home");
    expect(screen.getByRole("heading", { name: "Second page" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/Page order updated/);
  });

  it("adds, edits, hides, reorders, and deletes sections after confirmation", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    await renderDashboard();
    openWorkspace("Pages");
    await screen.findByRole("heading", { name: "Pages" });
    fireEvent.click(screen.getByRole("button", { name: "Edit page" }));

    fireEvent.change(screen.getByLabelText("Section type"), { target: { value: "contact" } });
    fireEvent.click(screen.getByRole("button", { name: "Add section" }));
    fireEvent.change(
      within(sectionList().querySelectorAll("li").item(8) as HTMLElement).getByLabelText("Heading"),
      {
        target: { value: "Contact section demo" },
      },
    );
    fireEvent.click(screen.getByRole("button", { name: "Apply changes" }));
    expect(await screen.findByText(/Page changes are applied/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Edit page" }));
    fireEvent.change(screen.getByLabelText("Section type"), { target: { value: "contact" } });
    fireEvent.click(screen.getByRole("button", { name: "Add section" }));
    fireEvent.click(screen.getByRole("button", { name: "Apply changes" }));

    fireEvent.click(screen.getByRole("button", { name: "Edit page" }));
    const list = sectionList();
    const initialItems = within(list).getAllByRole("listitem");
    expect(initialItems).toHaveLength(11);

    fireEvent.click(within(initialItems[0]!).getByRole("button", { name: "Hide section" }));
    expect(within(initialItems[0]!).getByText("Hidden from preview")).toBeInTheDocument();
    fireEvent.click(within(initialItems[0]!).getByRole("button", { name: "Move section 1 down" }));
    expect(within(list).getAllByRole("listitem")[1]).toHaveTextContent("hero");
    fireEvent.click(within(list).getAllByRole("button", { name: "Remove section" }).at(-1)!);
    expect(confirm).toHaveBeenCalled();
    expect(within(list).getAllByRole("listitem")).toHaveLength(10);

    fireEvent.click(screen.getByRole("button", { name: "Apply changes" }));
    openWorkspace("Projects");
    openWorkspace("Pages");
    fireEvent.click(screen.getByRole("button", { name: "Edit page" }));
    const savedList = sectionList();
    expect(within(savedList).getAllByRole("listitem")).toHaveLength(10);
    expect(within(savedList).getAllByText("Hidden from preview")).toHaveLength(1);
  });

  it("requires confirmation before deleting a page and then removes the selected page", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    await renderDashboard();
    openWorkspace("Pages");
    await screen.findByRole("heading", { name: "Pages" });
    await createPage("Removable page", "/removable-page");
    fireEvent.click(screen.getByRole("button", { name: "Edit page" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));

    expect(confirm).toHaveBeenCalled();
    expect(await screen.findByRole("heading", { name: "Home" })).toBeInTheDocument();
    expect(screen.queryByText("/removable-page")).not.toBeInTheDocument();
  });
});

describe("projects workspace interactions", () => {
  it("creates and edits projects, validates before commit, and discards canceled edits", async () => {
    await renderDashboard();
    openWorkspace("Projects");
    expect(await screen.findByRole("heading", { name: "Projects" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "New project" }));
    fireEvent.change(screen.getByLabelText("Project title *"), {
      target: { value: "Local demo project" },
    });
    fireEvent.change(screen.getByLabelText("URL slug *"), {
      target: { value: "local-demo-project" },
    });
    fireEvent.change(screen.getByLabelText("Project type *"), {
      target: { value: "Brand identity" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply changes" }));

    const card = projectCard("Local demo project");
    fireEvent.click(within(card).getAllByRole("button")[0]!);
    expect(screen.getByLabelText("Project title *")).toHaveValue("Local demo project");
    fireEvent.change(screen.getByLabelText("Project title *"), {
      target: { value: "Saved project edit" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply changes" }));
    expect(await screen.findByRole("heading", { name: "Saved project edit" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/Project changes applied/);

    fireEvent.click(within(projectCard("Saved project edit")).getAllByRole("button")[0]!);
    fireEvent.change(screen.getByLabelText("Project title *"), {
      target: { value: "Discarded project edit" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Discard" }));
    expect(projectCard("Saved project edit")).toBeInTheDocument();
    expect(screen.queryByText("Discarded project edit")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "New project" }));
    fireEvent.change(screen.getByLabelText("Project title *"), {
      target: { value: "Invalid slug" },
    });
    fireEvent.change(screen.getByLabelText("URL slug *"), { target: { value: "Not A Slug!" } });
    fireEvent.change(screen.getByLabelText("Project type *"), { target: { value: "Brand" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply changes" }));
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(
      screen
        .getAllByRole("article")
        .some((article) => article.textContent?.includes("Invalid slug")),
    ).toBe(false);
  });

  it("filters by search and category, and commits featured, visibility, and ordering", async () => {
    await renderDashboard();
    openWorkspace("Projects");
    await screen.findByPlaceholderText(/Search title, slug, category/);

    const baseline = await createDemoContent();
    const projects = [...baseline.projects].sort((a, b) => a.order - b.order);
    const firstIndex = projects.findIndex(
      (project, index) =>
        index < projects.length - 1 && !baseline.featuredProjectIds.includes(project.id),
    );
    const first = projects[firstIndex]!;
    const other = projects.find((project) => project.id !== first.id)!;
    const query = screen.getByPlaceholderText(/Search title, slug, category/);
    fireEvent.change(query, { target: { value: first.title } });
    expect(projectCard(first.title)).toBeInTheDocument();
    expect(screen.queryByText(other.title)).not.toBeInTheDocument();

    fireEvent.change(query, { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Filter by category"), {
      target: { value: first.categoryId },
    });
    expect(projectCard(first.title)).toBeInTheDocument();
    expect(
      screen.getByText(
        `${screen.getAllByRole("article").length} of ${baseline.projects.length} projects`,
      ),
    ).toBeInTheDocument();

    const card = projectCard(first.title);
    const featureButton = within(card).getByRole("button", { name: "Feature" });
    fireEvent.click(featureButton);
    expect(within(card).getByRole("button", { name: "Featured" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    fireEvent.click(within(card).getByRole("button", { name: `Hide ${first.title}` }));
    expect(within(card).getByText("Hidden")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Filter by category"), { target: { value: "all" } });
    fireEvent.click(screen.getByRole("button", { name: `Move ${first.title} down` }));
    expect(screen.getAllByRole("article")[firstIndex + 1]).toHaveTextContent(first.title);
    expect(screen.getByRole("status")).toHaveTextContent(/Project order updated/);

    openWorkspace("Pages");
    openWorkspace("Projects");
    expect(projectCard(first.title)).toBeInTheDocument();
    expect(within(projectCard(first.title)).getByText("Hidden")).toBeInTheDocument();
    expect(
      within(projectCard(first.title)).getByRole("button", { name: "Featured" }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("selects existing cover and gallery media and retains their references after saving", async () => {
    const baseline = await createDemoContent();
    const fixtureMedia = {
      id: "media:test-cover",
      source: { kind: "url" as const, url: "https://example.test/test-cover.png" },
      alt: "Test cover",
      caption: "Test cover image",
    };
    const secondFixtureMedia = {
      id: "media:test-gallery-two",
      source: { kind: "url" as const, url: "https://example.test/test-gallery-two.png" },
      alt: "Second gallery image",
      caption: "Second gallery image",
    };
    const withMedia = contentSnapshotSchema.parse({
      ...baseline,
      media: [...baseline.media, fixtureMedia, secondFixtureMedia],
    });
    render(<ProjectsHarness initial={withMedia} />);
    const project = screen.getAllByRole("article")[0]!;
    const title = project.querySelector("h2")?.textContent;
    if (!title) throw new Error("Expected a project title.");

    fireEvent.click(within(project).getAllByRole("button")[0]!);
    fireEvent.change(screen.getByLabelText("Cover image from existing media"), {
      target: { value: fixtureMedia.id },
    });
    const galleryCheckbox = screen.getByRole("checkbox", { name: fixtureMedia.caption });
    fireEvent.click(galleryCheckbox);
    fireEvent.click(screen.getByRole("checkbox", { name: secondFixtureMedia.caption }));
    const galleryOrder = screen.getByRole("list", { name: "Gallery order" });
    const beforeOrder = within(galleryOrder)
      .getAllByRole("listitem")
      .map((item) => item.textContent ?? "");
    const coverIndex = beforeOrder.findIndex((value) => value.includes(fixtureMedia.caption));
    const secondIndex = beforeOrder.findIndex((value) =>
      value.includes(secondFixtureMedia.caption),
    );
    expect(secondIndex).toBe(coverIndex + 1);
    fireEvent.click(screen.getByRole("button", { name: `Move ${fixtureMedia.caption} down` }));
    const afterOrder = within(galleryOrder)
      .getAllByRole("listitem")
      .map((item) => item.textContent ?? "");
    expect(afterOrder.findIndex((value) => value.includes(secondFixtureMedia.caption))).toBe(
      coverIndex,
    );
    expect(screen.getByRole("img", { name: fixtureMedia.alt })).toHaveAttribute(
      "src",
      fixtureMedia.source.url,
    );
    fireEvent.click(screen.getByRole("button", { name: "Apply changes" }));

    const savedCard = projectCard(title);
    fireEvent.click(within(savedCard).getAllByRole("button")[0]!);
    expect(screen.getByLabelText("Cover image from existing media")).toHaveValue(fixtureMedia.id);
    expect(screen.getByRole("checkbox", { name: fixtureMedia.caption })).toBeChecked();
    expect(within(savedCard).getByRole("img", { name: fixtureMedia.alt })).toHaveAttribute(
      "src",
      fixtureMedia.source.url,
    );
  });

  it("confirms project removal and removes the correct card", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    await renderDashboard();
    openWorkspace("Projects");
    await screen.findByRole("heading", { name: "Projects" });
    const target = screen.getAllByRole("article")[0]!;
    const title = target.querySelector("h2")?.textContent;
    if (!title) throw new Error("Expected a project to delete.");

    fireEvent.click(within(target).getByRole("button", { name: `Remove ${title}` }));

    expect(confirm).toHaveBeenCalledWith(`Remove "${title}"?`);
    expect(screen.queryByRole("heading", { name: title })).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/Project removed/);
  });
});
