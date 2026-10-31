import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDemoContent } from "@/lib/cms/demo-content";
import { loadPublicPortfolio, toLegacyPortfolioContent } from "@/lib/cms/public-content";
import { portfolioRepository } from "@/lib/cms/repository";

const mocks = vi.hoisted(() => ({
  getPublishedCmsServerFn: vi.fn(),
}));

vi.mock("@/lib/cms/server-functions", () => ({
  getPublishedCmsServerFn: mocks.getPublishedCmsServerFn,
}));

describe("public CMS content mapping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses validated published media URLs and respects public visibility", async () => {
    const snapshot = await createDemoContent();
    const project = snapshot.projects[0]!;
    const mediaId = "f9c12d6f-126e-4e31-bd8f-166c2a15cc41";
    project.coverMedia = { mediaId, alt: project.title };
    snapshot.media.push({
      id: mediaId,
      source: { kind: "storage", key: `portfolio/${mediaId}/${mediaId}.webp` },
      mimeType: "image/webp",
      sizeBytes: 1200,
      alt: project.title,
    });
    const mediaUrls = { [mediaId]: "https://images.example.test/published.webp" };
    const hiddenProject = snapshot.projects[1]!;
    hiddenProject.visible = false;
    snapshot.featuredProjectIds = [project.id, hiddenProject.id];

    const content = toLegacyPortfolioContent(snapshot, mediaUrls);

    expect(content.projects[0]?.cover).toBe(mediaUrls[mediaId]);
    expect(content.projects.some(({ slug }) => slug === hiddenProject.slug)).toBe(false);
    expect(content.featuredSlugs).toContain(project.slug);
    expect(content.featuredSlugs).not.toContain(hiddenProject.slug);
  });

  it("serves the static portfolio when no published CMS snapshot exists", async () => {
    mocks.getPublishedCmsServerFn.mockResolvedValue(null);

    const publicContent = await loadPublicPortfolio();

    expect(publicContent.content).toEqual(portfolioRepository.getPublishedContent());
    expect(publicContent.snapshot.origin).toBe("static-baseline");
    expect(mocks.getPublishedCmsServerFn).toHaveBeenCalledOnce();
  });

  it("rejects an invalid published snapshot and safely falls back to static content", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.getPublishedCmsServerFn.mockResolvedValue({
      snapshot: { schemaVersion: 999 },
      mediaUrls: {},
    });

    const publicContent = await loadPublicPortfolio();

    expect(publicContent.snapshot.origin).toBe("static-baseline");
    expect(consoleError).toHaveBeenCalledOnce();
    consoleError.mockRestore();
  });
});
