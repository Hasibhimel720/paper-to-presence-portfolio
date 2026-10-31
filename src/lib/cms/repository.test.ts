import { describe, expect, it } from "vitest";

import {
  categories,
  experience,
  faqs,
  featuredSlugs,
  process,
  projects,
  services,
  site,
} from "@/data/portfolio";
import {
  CMS_SCHEMA_VERSION,
  contentSnapshotSchema,
  type LegacyPortfolioContent,
} from "@/lib/cms/schema";
import {
  createStaticPortfolioRepository,
  migrateLegacyPortfolioContent,
  portfolioRepository,
} from "@/lib/cms/repository";

const currentLegacyContent: LegacyPortfolioContent = {
  site,
  categories,
  featuredSlugs,
  projects,
  services,
  experience,
  process,
  processOutcomes: [
    "A one-page brief we both agree on",
    "A clear creative direction",
    "First concepts and key visuals",
    "A polished system, reviewed with you",
    "Final files, ready to use",
  ],
  faqs,
  navigation: [
    { href: "work", label: "Work" },
    { href: "services", label: "Services" },
    { href: "about", label: "About" },
    { href: "experience", label: "Experience" },
    { href: "contact", label: "Contact" },
  ],
};

const encodedId = (namespace: string, ...parts: string[]) =>
  `${namespace}:${encodeURIComponent(JSON.stringify(parts))}`;

describe("portfolio content repository", () => {
  it("preserves the current public content through the legacy read surface", () => {
    const content = portfolioRepository.getPublishedContent();

    expect(content.site).toEqual(site);
    expect(content.categories).toEqual(categories);
    expect(content.featuredSlugs).toEqual(featuredSlugs);
    expect(content.projects).toEqual(projects);
    expect(content.services).toEqual(services);
    expect(content.experience).toEqual(experience);
    expect(content.process).toEqual(process);
    expect(content.processOutcomes).toEqual(currentLegacyContent.processOutcomes);
    expect(content.faqs).toEqual(faqs);
    expect(content.navigation).toEqual(currentLegacyContent.navigation);
  });

  it("migrates every project field and value in its original ordering", () => {
    const snapshot = migrateLegacyPortfolioContent(currentLegacyContent);

    expect(
      snapshot.projects.map(
        ({
          order,
          slug,
          title,
          category,
          type,
          description,
          year,
          tone,
          cover,
          placeholder,
          behance,
          palette,
          sections,
        }) => ({
          order,
          slug,
          title,
          category,
          type,
          description,
          year,
          tone,
          cover,
          placeholder,
          behance,
          palette,
          sections: sections.map(({ title, body, visual }) => ({ title, body, visual })),
        }),
      ),
    ).toEqual(
      projects.map((project, order) => ({
        order,
        slug: project.slug,
        title: project.title,
        category: project.category,
        type: project.type,
        description: project.description,
        year: project.year,
        tone: project.tone,
        cover: project.cover,
        placeholder: project.placeholder,
        behance: project.behance,
        palette: project.palette,
        sections: project.sections,
      })),
    );
    expect(snapshot.categories.map(({ name }) => name)).toEqual(
      categories.filter((category) => category !== "All Projects"),
    );
    expect(snapshot.featuredProjectIds).toEqual(
      featuredSlugs.map((slug) => encodedId("project", slug)),
    );
  });

  it("generates deterministic IDs and explicit source ordering", () => {
    const first = migrateLegacyPortfolioContent(currentLegacyContent);
    const second = migrateLegacyPortfolioContent(currentLegacyContent);

    expect(first).toEqual(second);
    expect(first.projects.map(({ id, order }) => [id, order])).toEqual(
      projects.map((project, order) => [encodedId("project", project.slug), order]),
    );
    expect(first.services.map(({ order }) => order)).toEqual(services.map((_, order) => order));
    expect(first.process.map(({ outcomes }) => outcomes)).toEqual(
      currentLegacyContent.processOutcomes.map((outcome) => [outcome]),
    );
  });

  it("keeps IDs stable across reorderings and distinguishes normalized-looking identities", () => {
    const reordered = migrateLegacyPortfolioContent({
      ...currentLegacyContent,
      projects: [...projects].reverse(),
      services: [
        { n: "01", title: "A B", body: "", items: [] },
        { n: "01", title: "A-B", body: "", items: [] },
      ],
    });
    const original = migrateLegacyPortfolioContent(currentLegacyContent);

    expect(new Map(original.projects.map(({ slug, id }) => [slug, id]))).toEqual(
      new Map(reordered.projects.map(({ slug, id }) => [slug, id])),
    );
    expect(new Set(reordered.services.map(({ id }) => id)).size).toBe(2);
    expect(reordered.services[0]!.id).not.toBe(reordered.services[1]!.id);
  });

  it("rejects ambiguous duplicate identities in legacy content", () => {
    expect(() =>
      migrateLegacyPortfolioContent({
        ...currentLegacyContent,
        projects: [...projects, projects[0]!],
      }),
    ).toThrow(/Duplicate project slug/);

    expect(() =>
      migrateLegacyPortfolioContent({
        ...currentLegacyContent,
        services: [services[0]!, services[0]!],
      }),
    ).toThrow(/Duplicate service identity/);
  });

  it("migrates provided covers and galleries without inventing media", () => {
    const fixture: LegacyPortfolioContent = {
      ...currentLegacyContent,
      projects: [
        {
          ...projects[0]!,
          cover: "https://assets.example.test/project-cover.png",
          gallery: [
            {
              id: "gallery-one",
              src: "https://assets.example.test/gallery-one.png",
              alt: "First view",
            },
            {
              id: "gallery-two",
              src: "https://assets.example.test/gallery-two.png",
              alt: "Second view",
            },
          ],
        },
        { ...projects[1]!, cover: undefined, gallery: [] },
      ],
      featuredSlugs: [],
    };
    const snapshot = migrateLegacyPortfolioContent(fixture);
    const coveredProject = snapshot.projects[0]!;
    const emptyProject = snapshot.projects[1]!;

    expect(coveredProject.coverMedia).toBeDefined();
    expect(coveredProject.gallery.map(({ alt }) => alt)).toEqual(["First view", "Second view"]);
    expect(emptyProject.coverMedia).toBeUndefined();
    expect(emptyProject.gallery).toEqual([]);
    expect(
      new Set([
        coveredProject.coverMedia!.mediaId,
        ...coveredProject.gallery.map(({ mediaId }) => mediaId),
      ]).size,
    ).toBe(3);
    expect(
      snapshot.media.map(({ source }) => (source.kind === "url" ? source.url : source.key)),
    ).toEqual([
      "https://assets.example.test/gallery-one.png",
      "https://assets.example.test/gallery-two.png",
      "https://assets.example.test/project-cover.png",
    ]);
    expect(snapshot.media).toHaveLength(3);
  });

  it("creates a static baseline without claiming CMS persistence or publication", () => {
    const snapshot = migrateLegacyPortfolioContent(currentLegacyContent);
    const home = snapshot.pages.find(({ slug }) => slug === "/");

    expect(snapshot.schemaVersion).toBe(CMS_SCHEMA_VERSION);
    expect(snapshot.origin).toBe("static-baseline");
    expect(snapshot.revisions).toEqual([]);
    expect(snapshot.publication).toEqual({
      status: "static-baseline",
      publishedRevisionId: null,
      draftRevisionId: null,
      updatedAt: null,
    });
    expect(home?.sections.map(({ id }) => id)).toEqual(
      [
        "hero",
        "project-highlights",
        "work",
        "services",
        "about",
        "experience",
        "process",
        "faqs",
        "contact",
      ].map((id) => encodedId("section", "home", id)),
    );
    expect(home?.sections.find(({ type }) => type === "hero")).toMatchObject({
      type: "hero",
      data: {
        eyebrow: site.availability,
        title: "Where Strategy Becomes Identity",
        body: "I'm Hasibuzzaman, You can call me Hasib. I build distinctive brand identities through strategic thinking, purposeful design, and uncompromising attention to detail.",
      },
    });
  });

  it("preserves legacy and async read behavior and returns defensive copies", async () => {
    const repository = createStaticPortfolioRepository(currentLegacyContent);
    const slug = projects[0]!.slug;
    const legacyProject = repository.getProject(slug);
    const asyncProject = await repository.getPublishedProject(slug);

    expect(legacyProject).toEqual(projects[0]);
    expect(asyncProject?.slug).toBe(slug);
    expect(await repository.getPublishedProject("missing-project")).toBeNull();
    expect(repository.getProject("missing-project")).toBeUndefined();
    if (!legacyProject || !asyncProject) throw new Error("Expected project fixture.");

    legacyProject.title = "Mutated legacy copy";
    asyncProject.title = "Mutated CMS copy";
    expect(repository.getProject(slug)?.title).toBe(projects[0]!.title);
    expect((await repository.getPublishedProject(slug))?.title).toBe(projects[0]!.title);

    const firstSnapshot = await repository.getPublishedSnapshot();
    const firstLegacyContent = repository.getPublishedContent();
    if (!firstSnapshot) throw new Error("Expected published snapshot.");
    firstSnapshot.projects[0]!.title = "Mutated snapshot";
    firstSnapshot.profile.toolkit[0]!.name = "Mutated toolkit";
    firstLegacyContent.projects[0]!.placeholder = "Mutated placeholder";

    const secondSnapshot = await repository.getPublishedSnapshot();
    expect(secondSnapshot?.projects[0]?.title).toBe(projects[0]!.title);
    expect(secondSnapshot?.profile.toolkit[0]?.name).toBe("Adobe Illustrator");
    expect(repository.getPublishedContent().projects[0]?.placeholder).toBe(
      projects[0]!.placeholder,
    );
  });

  it("rejects unsupported schema versions and invalid legacy references", () => {
    const snapshot = migrateLegacyPortfolioContent(currentLegacyContent);
    const unsupportedVersion = contentSnapshotSchema.safeParse({
      ...snapshot,
      schemaVersion: CMS_SCHEMA_VERSION + 1,
    });
    expect(unsupportedVersion.success).toBe(false);
    if (!unsupportedVersion.success) {
      expect(unsupportedVersion.error.issues[0]?.path).toEqual(["schemaVersion"]);
    }

    expect(() =>
      migrateLegacyPortfolioContent({
        ...currentLegacyContent,
        featuredSlugs: [...featuredSlugs, "missing-project"],
      }),
    ).toThrow(/Featured project does not exist/);
  });

  it("validates global IDs, including cross-page section IDs", () => {
    const snapshot = migrateLegacyPortfolioContent(currentLegacyContent);
    const home = snapshot.pages[0]!;
    const duplicateWithinCollection = contentSnapshotSchema.safeParse({
      ...snapshot,
      categories: [...snapshot.categories, snapshot.categories[0]!],
    });
    const duplicateAcrossCollections = contentSnapshotSchema.safeParse({
      ...snapshot,
      profile: { ...snapshot.profile, id: snapshot.projects[0]!.id },
    });
    const duplicateAcrossPages = contentSnapshotSchema.safeParse({
      ...snapshot,
      pages: [
        ...snapshot.pages,
        { ...home, id: "page:second", slug: "/second", order: 1, sections: [home.sections[0]!] },
      ],
    });

    expect(duplicateWithinCollection.success).toBe(false);
    expect(duplicateAcrossCollections.success).toBe(false);
    expect(duplicateAcrossPages.success).toBe(false);
    if (!duplicateAcrossPages.success) {
      expect(
        duplicateAcrossPages.error.issues.some((issue) =>
          issue.message.includes("unique across the entire content snapshot"),
        ),
      ).toBe(true);
    }
  });

  it("rejects repeated ordered references and dangling media references", () => {
    const snapshot = migrateLegacyPortfolioContent(currentLegacyContent);
    const highlights = snapshot.pages[0]!.sections.find(
      (section) => section.type === "project-highlights",
    );
    if (!highlights || highlights.type !== "project-highlights") {
      throw new Error("Expected project highlights fixture.");
    }
    const duplicateReferences = contentSnapshotSchema.safeParse({
      ...snapshot,
      pages: snapshot.pages.map((page) => ({
        ...page,
        sections: page.sections.map((section) =>
          section.id === highlights.id
            ? {
                ...section,
                data: {
                  ...section.data,
                  projectIds: [snapshot.projects[0]!.id, snapshot.projects[0]!.id],
                },
              }
            : section,
        ),
      })),
    });
    const duplicateNavigationTarget = contentSnapshotSchema.safeParse({
      ...snapshot,
      navigation: snapshot.navigation.map((item, index) =>
        index === 1 ? { ...item, target: snapshot.navigation[0]!.target } : item,
      ),
    });
    const mediaSnapshot = migrateLegacyPortfolioContent({
      ...currentLegacyContent,
      projects: [
        {
          ...projects[0]!,
          cover: "https://assets.example.test/cover.png",
          gallery: [{ id: "image", src: "https://assets.example.test/gallery.png", alt: "Image" }],
        },
        ...projects.slice(1),
      ],
    });
    const danglingMedia = contentSnapshotSchema.safeParse({
      ...mediaSnapshot,
      projects: mediaSnapshot.projects.map((project, index) =>
        index === 0
          ? { ...project, gallery: [{ ...project.gallery[0]!, mediaId: "media:missing" }] }
          : project,
      ),
    });

    expect(duplicateReferences.success).toBe(false);
    expect(duplicateNavigationTarget.success).toBe(false);
    expect(danglingMedia.success).toBe(false);
    if (!danglingMedia.success) {
      expect(
        danglingMedia.error.issues.some((issue) =>
          issue.message.includes("Project gallery references unknown media"),
        ),
      ).toBe(true);
    }
  });

  it("allows empty CMS collections but records existing public renderer prerequisites", () => {
    const snapshot = migrateLegacyPortfolioContent({
      ...currentLegacyContent,
      categories: ["All Projects"],
      projects: [],
      featuredSlugs: [],
      services: [],
      experience: [],
      process: [],
      processOutcomes: [],
      faqs: [],
      navigation: [],
    });

    const emptySectionsSnapshot = {
      ...snapshot,
      media: [],
      pages: snapshot.pages.map((page) => ({ ...page, sections: [] })),
      footer: { ...snapshot.footer, navigation: [] },
    };
    expect(snapshot.projects).toEqual([]);
    expect(snapshot.categories).toEqual([]);
    expect(snapshot.services).toEqual([]);
    expect(snapshot.experience).toEqual([]);
    expect(snapshot.process).toEqual([]);
    expect(snapshot.faqs).toEqual([]);
    expect(contentSnapshotSchema.safeParse(emptySectionsSnapshot).success).toBe(true);
    const processWithEmptyOutcomes = migrateLegacyPortfolioContent(currentLegacyContent);
    expect(
      contentSnapshotSchema.safeParse({
        ...processWithEmptyOutcomes,
        process: processWithEmptyOutcomes.process.map((step) => ({ ...step, outcomes: [] })),
      }).success,
    ).toBe(true);
    // The existing homepage indexes experience and FAQs, so those two empty states need a later UI guard.
    // Process outcomes are aligned with process steps by the legacy schema; both may be empty together.
    expect(snapshot.process.every(({ outcomes }) => outcomes.length > 0)).toBe(true);
  });

  it("rejects dangling publication and revision ancestry pointers", () => {
    const snapshot = migrateLegacyPortfolioContent(currentLegacyContent);
    const danglingPublishedPointer = contentSnapshotSchema.safeParse({
      ...snapshot,
      origin: "cms",
      publication: {
        ...snapshot.publication,
        status: "published",
        publishedRevisionId: "revision:missing",
      },
    });
    const danglingDraftPointer = contentSnapshotSchema.safeParse({
      ...snapshot,
      origin: "cms",
      publication: {
        ...snapshot.publication,
        status: "unpublished",
        draftRevisionId: "revision:missing",
      },
    });
    const danglingAncestryPointer = contentSnapshotSchema.safeParse({
      ...snapshot,
      origin: "cms",
      revisions: [
        {
          id: "revision:known",
          number: 1,
          status: "draft",
          createdAt: null,
          updatedAt: null,
          publishedAt: null,
          basedOnRevisionId: "revision:missing",
          createdBy: null,
        },
      ],
      publication: { ...snapshot.publication, status: "unpublished" },
    });

    expect(danglingPublishedPointer.success).toBe(false);
    expect(danglingDraftPointer.success).toBe(false);
    expect(danglingAncestryPointer.success).toBe(false);
    if (!danglingPublishedPointer.success) {
      expect(
        danglingPublishedPointer.error.issues.some((issue) =>
          issue.message.includes("unknown revision"),
        ),
      ).toBe(true);
    }
  });

  it("rejects process outcome counts that differ from process steps", () => {
    expect(() =>
      migrateLegacyPortfolioContent({
        ...currentLegacyContent,
        processOutcomes: currentLegacyContent.processOutcomes.slice(1),
      }),
    ).toThrow(/exactly one outcome/);
  });
});
