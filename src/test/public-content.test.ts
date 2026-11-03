import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDemoContent } from "@/lib/cms/demo-content";
import { defaultAppearanceSettings } from "@/lib/cms/appearance-settings";
import {
  loadPublicPortfolio,
  getPublicThemeStyle,
  toLegacyPortfolioContent,
} from "@/lib/cms/public-content";
import { migrateLegacyPortfolioContent, portfolioRepository } from "@/lib/cms/repository";
import {
  appearanceSettingsSchema,
  contentSnapshotSchema,
  experienceRecordSchema,
} from "@/lib/cms/schema";

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

  it("accepts default appearance settings and maps mode-specific design tokens", async () => {
    expect(appearanceSettingsSchema.safeParse(defaultAppearanceSettings).success).toBe(true);

    const snapshot = await createDemoContent();
    snapshot.theme.appearance = structuredClone(defaultAppearanceSettings);
    snapshot.theme.appearance.modes.light.colors.accent = "#52677b";
    snapshot.theme.appearance.modes.light.background.gradientOpacity = 37;
    snapshot.theme.appearance.modes.dark.colors.accent = "#68a7cc";
    snapshot.theme.appearance.modes.dark.background.ambientIntensity = 45;
    snapshot.theme.appearance.modes.dark.glass.blur = 9;
    snapshot.theme.layout.cardGap = 28;
    snapshot.theme.typography.headingScale = 1.15;

    expect(getPublicThemeStyle(snapshot, true)).toMatchObject({
      "--theme-light-hot": "#52677b",
      "--theme-dark-hot": "#68a7cc",
      "--cms-light-gradient-opacity": "37%",
      "--cms-dark-ambient-intensity": "45%",
      "--cms-dark-glass-blur": "9px",
      "--cms-card-gap": "28px",
      "--cms-heading-scale": "1.15",
    });
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

  it("migrates project hero images and gallery captions without losing their references", async () => {
    const baseline = portfolioRepository.getPublishedContent();
    const selected = baseline.projects[0];
    if (!selected) throw new Error("Expected a project in the static portfolio.");
    const legacy = {
      ...baseline,
      projects: baseline.projects.map((project) =>
        project.slug === selected.slug
          ? {
              ...project,
              cover: "https://images.example.test/cover.webp",
              heroImage: "https://images.example.test/hero.webp",
              gallery: [
                {
                  id: "gallery-image",
                  src: "https://images.example.test/gallery.webp",
                  alt: "Gallery artwork",
                  caption: "Final packaging detail",
                },
              ],
            }
          : project,
      ),
    };

    const snapshot = migrateLegacyPortfolioContent(legacy);
    const migrated = snapshot.projects.find(({ slug }) => slug === selected.slug);
    if (!migrated) throw new Error("Expected the migrated project.");

    expect(snapshot.media.find(({ id }) => id === migrated.heroMedia?.mediaId)?.source).toEqual({
      kind: "url",
      url: "https://images.example.test/hero.webp",
    });
    expect(migrated.gallery[0]).toMatchObject({
      alt: "Gallery artwork",
      caption: "Final packaging detail",
    });
    expect(snapshot.media.find(({ id }) => id === migrated.gallery[0]?.mediaId)).toMatchObject({
      caption: "Final packaging detail",
    });
  });

  it("maps each service's published image and display settings", async () => {
    const snapshot = await createDemoContent();
    const service = snapshot.services[0]!;
    const secondService = snapshot.services[1]!;
    const mediaId = "service-image-test";
    const secondMediaId = "service-image-test-two";
    service.image = {
      mediaId,
      alt: "Custom packaging artwork",
      focalPoint: { x: 0.3, y: 0.7 },
    };
    service.imageFit = "contain";
    secondService.image = { mediaId: secondMediaId, alt: "Second custom service image" };
    snapshot.media.push(
      {
        id: mediaId,
        source: { kind: "storage", key: `portfolio/${mediaId}/${mediaId}.webp` },
        mimeType: "image/webp",
        sizeBytes: 1200,
        alt: "Custom packaging artwork",
      },
      {
        id: secondMediaId,
        source: { kind: "storage", key: `portfolio/${secondMediaId}/${secondMediaId}.webp` },
        mimeType: "image/webp",
        sizeBytes: 1400,
        alt: "Second custom service image",
      },
    );

    const content = toLegacyPortfolioContent(snapshot, {
      [mediaId]: "https://images.example.test/service.webp",
      [secondMediaId]: "https://images.example.test/service-two.webp",
    });

    expect(content.services[0]).toMatchObject({
      image: "https://images.example.test/service.webp",
      imageAlt: "Custom packaging artwork",
      imageFit: "contain",
      imagePosition: { x: 0.3, y: 0.7 },
    });
    expect(content.services[1]).toMatchObject({
      image: "https://images.example.test/service-two.webp",
      imageAlt: "Second custom service image",
    });
  });

  it("publishes new categories and homepage-linked experience, process, and FAQ entries", async () => {
    const snapshot = await createDemoContent();
    const category = {
      id: "category-art-direction",
      slug: "art-direction",
      name: "Art Direction",
      order: snapshot.categories.length,
    };
    snapshot.categories.push(category);
    const project = snapshot.projects[0]!;
    project.categoryId = category.id;
    project.category = category.name;

    const home = snapshot.pages.find(({ slug }) => slug === "/");
    const projectGrid = home?.sections.find((section) => section.type === "project-grid");
    const experienceSection = home?.sections.find((section) => section.type === "experience");
    const processSection = home?.sections.find((section) => section.type === "process");
    const faqSection = home?.sections.find((section) => section.type === "faqs");
    if (
      !projectGrid ||
      projectGrid.type !== "project-grid" ||
      !experienceSection ||
      experienceSection.type !== "experience" ||
      !processSection ||
      processSection.type !== "process" ||
      !faqSection ||
      faqSection.type !== "faqs"
    ) {
      throw new Error("Expected homepage collection sections.");
    }
    projectGrid.data.categoryIds = [category.id];

    const experience = {
      ...snapshot.experience[0]!,
      id: "experience-current-studio",
      order: snapshot.experience.length,
      company: "Current Studio",
      dates: "",
      startDate: "2025-01-01",
      isCurrent: true,
      visible: true,
    };
    const processStep = {
      ...snapshot.process[0]!,
      id: "process-added-step",
      order: snapshot.process.length,
      title: "Added process step",
      visible: true,
    };
    const faq = {
      ...snapshot.faqs[0]!,
      id: "faq-added-entry",
      q: "Added FAQ question?",
      visible: true,
    };
    snapshot.experience.push(experience);
    snapshot.process.push(processStep);
    snapshot.faqs.push(faq);
    experienceSection.data.experienceIds.push(experience.id);
    processSection.data.processStepIds.push(processStep.id);
    faqSection.data.faqIds.push(faq.id);

    const content = toLegacyPortfolioContent(snapshot, {});

    expect(content.categories).toContain("Art Direction");
    expect(content.projects.find(({ slug }) => slug === project.slug)?.category).toBe(
      "Art Direction",
    );
    expect(content.experience).toContainEqual(
      expect.objectContaining({ company: "Current Studio", dates: "January 2025 – Present" }),
    );
    expect(content.process.some(({ title }) => title === "Added process step")).toBe(true);
    expect(content.faqs.some(({ q }) => q === "Added FAQ question?")).toBe(true);
  });

  it("validates structured experience date ranges while preserving legacy date text", async () => {
    const snapshot = await createDemoContent();
    const legacy = snapshot.experience[0]!;
    expect(experienceRecordSchema.parse(legacy).dates).toBe(legacy.dates);

    expect(
      experienceRecordSchema.safeParse({
        ...legacy,
        startDate: "2025-05-01",
        endDate: "2025-04-01",
        isCurrent: false,
      }).success,
    ).toBe(false);
    expect(
      experienceRecordSchema.safeParse({
        ...legacy,
        startDate: undefined,
        endDate: undefined,
        isCurrent: true,
      }).success,
    ).toBe(false);
    expect(
      experienceRecordSchema.safeParse({
        ...legacy,
        startDate: "2025-05-01",
        endDate: undefined,
        isCurrent: true,
      }).success,
    ).toBe(true);
  });

  it("validates custom software icon media references independently of service images", async () => {
    const snapshot = await createDemoContent();
    snapshot.profile.toolkit[0]!.iconMedia = {
      mediaId: "unregistered-software-icon",
      alt: "Custom software icon",
    };

    const result = contentSnapshotSchema.safeParse(snapshot);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toContainEqual(
        expect.objectContaining({
          path: ["profile", "toolkit", 0, "iconMedia", "mediaId"],
        }),
      );
    }
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
