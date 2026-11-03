import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

const mediaMocks = vi.hoisted(() => ({
  uploadCmsMediaFile: vi.fn(),
}));

vi.mock("@/lib/cms/server-functions", () => cmsServerMocks);

vi.mock("@/lib/cms/media-storage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/cms/media-storage")>();
  return { ...actual, uploadCmsMediaFile: mediaMocks.uploadCmsMediaFile };
});

vi.mock("@/routes/index", () => ({
  PortfolioPage: () => null,
}));

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

beforeEach(() => {
  vi.clearAllMocks();
});

function openWorkspace(label: string) {
  const workspaceLabel: Record<string, string> = {
    Pages: "Homepage",
    "Design & SEO": "SEO & Metadata",
    "Media library": "Media Library",
    "Site settings": "Site Settings",
    About: "About",
  };
  fireEvent.click(
    within(screen.getByRole("navigation", { name: "Dashboard" })).getByRole("button", {
      name: workspaceLabel[label] ?? label,
    }),
  );
}

function installObjectUrlStub() {
  class TestURL extends URL {
    static override createObjectURL = vi.fn(() => "blob:profile-photo-preview");
    static override revokeObjectURL = vi.fn();
  }
  vi.stubGlobal("URL", TestURL);
}

async function renderDashboard() {
  render(<AdminShell onSignOut={vi.fn()} signingOut={false} />);
  await screen.findByRole("heading", { name: "Good to see you" });
}

async function renderAuthenticatedDashboard() {
  render(
    <AdminShell
      onSignOut={vi.fn()}
      signingOut={false}
      getAccessToken={async () => "authenticated-token"}
    />,
  );
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
  it("groups dashboard workspaces and supports a collapsible desktop sidebar", async () => {
    await renderDashboard();

    const navigation = screen.getByRole("navigation", { name: "Dashboard" });
    expect(navigation.querySelector('[aria-label="Website content"]')).not.toBeNull();
    expect(navigation.querySelector('[aria-label="Website design"]')).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Collapse sidebar" }));
    expect(screen.getByRole("button", { name: "Expand sidebar" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Homepage" })[0]!);
    expect(
      screen
        .getAllByRole("button", { name: "Homepage" })
        .find((button) => button.hasAttribute("aria-current")),
    ).toHaveAttribute("aria-current", "page");
  });

  it("saves an uploaded Hero background with its media asset in the validated snapshot", async () => {
    const asset = {
      id: "da618708-e242-4859-9349-7ffb71bbdd14",
      source: { kind: "url" as const, url: "https://example.test/hero-background.png" },
      alt: "Hero background",
      caption: "Hero background",
    };
    const file = new File(["image"], "hero-background.png", { type: "image/png" });
    const saveDraft = cmsServerMocks.saveAdminCmsDraftServerFn;
    const savedSnapshots: ContentSnapshot[] = [];
    cmsServerMocks.loadAdminCmsServerFn.mockResolvedValue(null);
    cmsServerMocks.listAdminCmsMediaServerFn.mockResolvedValue({
      assets: [],
      deletingIds: [],
    });
    mediaMocks.uploadCmsMediaFile.mockResolvedValue(asset);
    saveDraft.mockImplementation(({ data }) => {
      savedSnapshots.push(data.snapshot);
      return Promise.resolve(data.snapshot);
    });

    render(
      <AdminShell
        onSignOut={vi.fn()}
        signingOut={false}
        getAccessToken={async () => "authenticated-token"}
      />,
    );
    expect(await screen.findByRole("heading", { name: "Good to see you" })).toBeInTheDocument();

    openWorkspace("Pages");
    fireEvent.click(await screen.findByRole("button", { name: "Edit page" }));
    fireEvent.change(screen.getByLabelText("Upload Hero background image"), {
      target: { files: [file] },
    });
    fireEvent.click(await screen.findByRole("button", { name: "Upload and use as background" }));
    await screen.findByRole("button", { name: "Apply changes" });

    const backgroundSelect = screen.getByLabelText("Hero background image");
    expect(backgroundSelect).toHaveValue(asset.id);
    fireEvent.change(backgroundSelect, { target: { value: "" } });
    fireEvent.change(backgroundSelect, { target: { value: asset.id } });
    fireEvent.click(screen.getByRole("button", { name: "Apply changes" }));
    expect(await screen.findByText(/Page changes are applied/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(saveDraft).toHaveBeenCalledOnce());
    await waitFor(() => expect(screen.getAllByText(/Draft revision/).length).toBeGreaterThan(0));

    const savedSnapshot = savedSnapshots[0];
    expect(contentSnapshotSchema.safeParse(savedSnapshot).success).toBe(true);
    expect(savedSnapshot?.media.some(({ id }) => id === asset.id)).toBe(true);
    const savedHero = savedSnapshot?.pages
      .flatMap((page) => page.sections)
      .find((section) => section.type === "hero");
    expect(savedHero?.type === "hero" ? savedHero.data.backgroundImage?.mediaId : null).toBe(
      asset.id,
    );
  });

  it("saves Appearance settings as a draft without publishing them", async () => {
    const savedSnapshots: ContentSnapshot[] = [];
    cmsServerMocks.loadAdminCmsServerFn.mockResolvedValue(null);
    cmsServerMocks.listAdminCmsMediaServerFn.mockResolvedValue({
      assets: [],
      deletingIds: [],
    });
    cmsServerMocks.saveAdminCmsDraftServerFn.mockImplementation(({ data }) => {
      savedSnapshots.push(data.snapshot);
      return Promise.resolve(data.snapshot);
    });

    await renderAuthenticatedDashboard();
    openWorkspace("Appearance / Design Studio");
    expect(
      await screen.findByRole("heading", { name: "Appearance / Design Studio" }),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Page background HEX value"), {
      target: { value: "#f4f3ef" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply to dashboard draft" }));
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));

    await waitFor(() => expect(cmsServerMocks.saveAdminCmsDraftServerFn).toHaveBeenCalledOnce());
    expect(savedSnapshots[0]?.theme.appearance?.modes.light.colors.background).toBe("#f4f3ef");
    expect(cmsServerMocks.publishAdminCmsDraftServerFn).not.toHaveBeenCalled();
  }, 15_000);

  it("saves Contact workspace changes as a draft without publishing them", async () => {
    const savedSnapshots: ContentSnapshot[] = [];
    cmsServerMocks.loadAdminCmsServerFn.mockResolvedValue(null);
    cmsServerMocks.listAdminCmsMediaServerFn.mockResolvedValue({ assets: [], deletingIds: [] });
    cmsServerMocks.saveAdminCmsDraftServerFn.mockImplementation(({ data }) => {
      savedSnapshots.push(data.snapshot);
      return Promise.resolve(data.snapshot);
    });

    await renderAuthenticatedDashboard();
    openWorkspace("Contact");
    fireEvent.change(screen.getByLabelText("Public contact email"), {
      target: { value: "draft-contact@example.test" },
    });
    fireEvent.change(screen.getByLabelText("Contact section heading"), {
      target: { value: "Let's talk" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply changes" }));
    expect(await screen.findByText(/Contact applied/)).toBeInTheDocument();
    expect(cmsServerMocks.saveAdminCmsDraftServerFn).not.toHaveBeenCalled();
    expect(cmsServerMocks.publishAdminCmsDraftServerFn).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(cmsServerMocks.saveAdminCmsDraftServerFn).toHaveBeenCalledOnce());
    const savedContact = savedSnapshots[0]?.pages
      .find(({ slug }) => slug === "/")
      ?.sections.find((section) => section.type === "contact");
    expect(savedSnapshots[0]?.contact.publicEmail).toBe("draft-contact@example.test");
    expect(savedContact?.type === "contact" && savedContact.data.title).toBe("Let's talk");
    expect(cmsServerMocks.publishAdminCmsDraftServerFn).not.toHaveBeenCalled();
  }, 15_000);

  it("uploads a navigation logo and includes its reference and asset in Save Draft", async () => {
    const asset = {
      id: "a1b2c3d4-e5f6-4789-a123-123456789abc",
      source: { kind: "url" as const, url: "https://example.test/navigation-logo.png" },
      alt: "navigation-logo.png",
      caption: "navigation-logo.png",
    };
    const savedSnapshots: ContentSnapshot[] = [];
    cmsServerMocks.loadAdminCmsServerFn.mockResolvedValue(null);
    cmsServerMocks.listAdminCmsMediaServerFn.mockResolvedValue({ assets: [], deletingIds: [] });
    mediaMocks.uploadCmsMediaFile.mockResolvedValue(asset);
    cmsServerMocks.saveAdminCmsDraftServerFn.mockImplementation(({ data }) => {
      savedSnapshots.push(data.snapshot);
      return Promise.resolve(data.snapshot);
    });

    render(
      <AdminShell
        onSignOut={vi.fn()}
        signingOut={false}
        getAccessToken={async () => "authenticated-token"}
      />,
    );
    expect(await screen.findByRole("heading", { name: "Good to see you" })).toBeInTheDocument();

    openWorkspace("Site settings");
    fireEvent.change(screen.getByLabelText("Upload navigation logo"), {
      target: {
        files: [new File(["logo"], "navigation-logo.png", { type: "image/png" })],
      },
    });
    fireEvent.click(await screen.findByRole("button", { name: "Upload and use logo" }));
    expect(await screen.findByRole("img", { name: "navigation-logo.png" })).toHaveAttribute(
      "src",
      asset.source.url,
    );
    fireEvent.click(screen.getByRole("button", { name: "Apply changes" }));
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(cmsServerMocks.saveAdminCmsDraftServerFn).toHaveBeenCalledOnce());

    const saved = savedSnapshots[0];
    expect(saved?.navigationLogo).toEqual({ mediaId: asset.id, alt: asset.alt });
    expect(saved?.media.some(({ id }) => id === asset.id)).toBe(true);
  });

  it("previews, cancels, validates, and preserves the current profile photograph on upload failure", async () => {
    installObjectUrlStub();
    const snapshot = await createDemoContent();
    const existingPortrait = {
      id: "portrait-existing",
      source: { kind: "url" as const, url: "https://example.test/current-portrait.jpg" },
      alt: "Current profile photograph",
      caption: "Profile photograph",
    };
    snapshot.media.push(existingPortrait);
    snapshot.profile.portrait = { mediaId: existingPortrait.id, alt: existingPortrait.alt };
    cmsServerMocks.loadAdminCmsServerFn.mockResolvedValue(snapshot);
    cmsServerMocks.listAdminCmsMediaServerFn.mockResolvedValue({ assets: [], deletingIds: [] });
    mediaMocks.uploadCmsMediaFile.mockRejectedValue(new Error("Image upload failed."));

    await renderAuthenticatedDashboard();
    openWorkspace("About");

    const currentPhoto = await screen.findByRole("img", { name: existingPortrait.alt });
    expect(currentPhoto).toHaveAttribute("src", existingPortrait.source.url);

    const photoInput = screen.getByLabelText("Upload profile photograph");
    const validFile = new File(["photo"], "portrait.png", { type: "image/png" });
    fireEvent.change(photoInput, { target: { files: [validFile] } });
    expect(
      await screen.findByRole("img", { name: "Selected profile photograph preview" }),
    ).toHaveAttribute("src", "blob:profile-photo-preview");

    fireEvent.click(screen.getByRole("button", { name: "Cancel photo selection" }));
    expect(screen.queryByRole("img", { name: "Selected profile photograph preview" })).toBeNull();
    expect(screen.getByRole("img", { name: existingPortrait.alt })).toHaveAttribute(
      "src",
      existingPortrait.source.url,
    );
    expect(mediaMocks.uploadCmsMediaFile).not.toHaveBeenCalled();

    fireEvent.change(photoInput, {
      target: { files: [new File(["gif"], "unsupported.gif", { type: "image/gif" })] },
    });
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Choose a JPG, JPEG, PNG, or WebP profile photograph.",
    );
    expect(screen.getByRole("img", { name: existingPortrait.alt })).toHaveAttribute(
      "src",
      existingPortrait.source.url,
    );

    const oversizedFile = new File(
      [new Uint8Array(10 * 1024 * 1024 + 1)],
      "oversized-portrait.png",
      { type: "image/png" },
    );
    fireEvent.change(photoInput, { target: { files: [oversizedFile] } });
    expect(await screen.findByText("Images must be no larger than 10 MB.")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: existingPortrait.alt })).toHaveAttribute(
      "src",
      existingPortrait.source.url,
    );

    fireEvent.change(photoInput, { target: { files: [validFile] } });
    fireEvent.click(await screen.findByRole("button", { name: "Upload and use photo" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Image upload failed.");
    expect(screen.getByRole("img", { name: existingPortrait.alt })).toHaveAttribute(
      "src",
      existingPortrait.source.url,
    );
  });

  it("saves and publishes service and profile images through the existing CMS workflow", async () => {
    installObjectUrlStub();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const snapshot = await createDemoContent();
    const existingPortrait = {
      id: "portrait-existing-save",
      source: { kind: "url" as const, url: "https://example.test/current-portrait.jpg" },
      alt: "Current profile photograph",
      caption: "Profile photograph",
    };
    const uploadedPortrait = {
      id: "portrait-new",
      source: { kind: "url" as const, url: "https://example.test/new-portrait.webp" },
      alt: "Hasibuzzaman Himel profile photograph",
      caption: "Profile photograph",
    };
    const uploadedServiceImage = {
      id: "service-image-new",
      source: { kind: "url" as const, url: "https://example.test/service-image.webp" },
      alt: "Brand identity service image",
      caption: "Brand identity illustration",
    };
    snapshot.media.push(existingPortrait);
    snapshot.profile.portrait = { mediaId: existingPortrait.id, alt: existingPortrait.alt };
    cmsServerMocks.loadAdminCmsServerFn.mockResolvedValue(snapshot);
    cmsServerMocks.listAdminCmsMediaServerFn.mockResolvedValue({ assets: [], deletingIds: [] });
    let finishPortraitUpload: (() => void) | undefined;
    mediaMocks.uploadCmsMediaFile.mockImplementation((file: File) =>
      file.name === "service-image.webp"
        ? Promise.resolve(uploadedServiceImage)
        : new Promise((resolve) => {
            finishPortraitUpload = () => resolve(uploadedPortrait);
          }),
    );

    const savedSnapshots: ContentSnapshot[] = [];
    const revisionId = "revision:profile-photo";
    const draftRevision = {
      id: revisionId,
      number: 1,
      status: "draft" as const,
      createdAt: null,
      updatedAt: null,
      publishedAt: null,
      basedOnRevisionId: null,
      createdBy: null,
    };
    cmsServerMocks.saveAdminCmsDraftServerFn.mockImplementation(({ data }) => {
      savedSnapshots.push(data.snapshot);
      return Promise.resolve({
        ...data.snapshot,
        origin: "cms" as const,
        publication: {
          ...data.snapshot.publication,
          status: "unpublished" as const,
          draftRevisionId: revisionId,
        },
        revisions: [draftRevision],
      });
    });
    cmsServerMocks.publishAdminCmsDraftServerFn.mockImplementation(() =>
      Promise.resolve({
        ...savedSnapshots[0]!,
        origin: "cms" as const,
        publication: {
          ...savedSnapshots[0]!.publication,
          status: "published" as const,
          publishedRevisionId: revisionId,
          draftRevisionId: null,
        },
        revisions: [{ ...draftRevision, status: "published" as const }],
      }),
    );

    await renderAuthenticatedDashboard();
    openWorkspace("Services");
    fireEvent.click(screen.getByRole("button", { name: "Add service" }));
    fireEvent.change(screen.getByLabelText("Number or label"), {
      target: { value: "06" },
    });
    fireEvent.change(screen.getByLabelText("Service title"), {
      target: { value: "New custom service" },
    });
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "A service added in the dashboard." },
    });
    fireEvent.change(screen.getByLabelText("Choose service image"), {
      target: {
        files: [new File(["service image"], "service-image.webp", { type: "image/webp" })],
      },
    });
    expect(
      await screen.findByRole("img", { name: "Selected service image preview" }),
    ).toHaveAttribute("src", "blob:profile-photo-preview");
    fireEvent.click(screen.getByRole("button", { name: "Upload image" }));
    expect(await screen.findByText(/Image uploaded to the dashboard session/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Apply changes" }));
    expect(await screen.findByText(/Service added/)).toBeInTheDocument();

    openWorkspace("About");
    fireEvent.change(screen.getByLabelText("Upload profile photograph"), {
      target: { files: [new File(["photo"], "portrait.webp", { type: "image/webp" })] },
    });
    expect(
      await screen.findByRole("img", { name: "Selected profile photograph preview" }),
    ).toHaveAttribute("src", "blob:profile-photo-preview");
    fireEvent.click(await screen.findByRole("button", { name: "Upload and use photo" }));
    expect(await screen.findByRole("button", { name: "Uploading photo…" })).toBeDisabled();
    if (!finishPortraitUpload) throw new Error("Expected the photo upload to be pending.");
    finishPortraitUpload();
    expect(await screen.findByRole("img", { name: uploadedPortrait.alt })).toHaveAttribute(
      "src",
      uploadedPortrait.source.url,
    );

    fireEvent.click(screen.getByRole("button", { name: "Apply changes" }));
    expect(await screen.findByText(/About applied/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(cmsServerMocks.saveAdminCmsDraftServerFn).toHaveBeenCalledOnce());

    const saved = savedSnapshots[0];
    expect(saved?.profile.portrait).toEqual({
      mediaId: uploadedPortrait.id,
      alt: uploadedPortrait.alt,
    });
    expect(saved?.media.some(({ id }) => id === uploadedPortrait.id)).toBe(true);
    const savedService = saved?.services.find(({ title }) => title === "New custom service");
    expect(savedService).toMatchObject({
      n: "06",
      body: "A service added in the dashboard.",
      image: { mediaId: uploadedServiceImage.id },
    });
    expect(savedService?.id).toMatch(/^service:/);
    expect(saved?.media.some(({ id }) => id === uploadedServiceImage.id)).toBe(true);
    const homepageServices = saved?.pages
      .find(({ slug }) => slug === "/")
      ?.sections.find((section) => section.type === "services");
    expect(homepageServices?.type === "services" && homepageServices.data.serviceIds).toContain(
      savedService?.id,
    );

    fireEvent.click(screen.getByRole("button", { name: "Publish" }));
    await waitFor(() =>
      expect(cmsServerMocks.publishAdminCmsDraftServerFn).toHaveBeenCalledWith({
        data: { accessToken: "authenticated-token", revisionId },
      }),
    );
    expect(await screen.findByText("The saved revision is now published.")).toBeInTheDocument();
  });

  it("keeps the editing workspace available when the authenticated CMS cannot be loaded", async () => {
    cmsServerMocks.listAdminCmsMediaServerFn.mockClear();
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
  }, 15_000);

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
  }, 15_000);

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
    expect(
      screen
        .getAllByRole("img", { name: fixtureMedia.alt })
        .some((image) => image.getAttribute("src") === fixtureMedia.source.url),
    ).toBe(true);
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
