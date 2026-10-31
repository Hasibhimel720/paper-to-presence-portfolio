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
  legacyPortfolioContentSchema,
  type ContentSnapshot,
  type LegacyPortfolioContent,
  type Project,
  type Site,
} from "@/lib/cms/schema";

export interface PublicContentRepository {
  getPublishedSnapshot(): Promise<ContentSnapshot | null>;
  getPublishedProject(slug: string): Promise<ContentSnapshot["projects"][number] | null>;
}

export type DraftSaveInput = {
  expectedRevisionId: string | null;
  snapshot: ContentSnapshot;
};

export interface AdminContentRepository {
  getDraftSnapshot(): Promise<ContentSnapshot | null>;
  saveDraft(input: DraftSaveInput): Promise<ContentSnapshot>;
  listRevisions(): Promise<ContentSnapshot["revisions"]>;
  restoreRevision(revisionId: string): Promise<ContentSnapshot>;
  publish(revisionId: string): Promise<ContentSnapshot["publication"]>;
  unpublish(): Promise<ContentSnapshot["publication"]>;
}

export type CmsRepository = PublicContentRepository & AdminContentRepository;

export interface StaticPortfolioRepository extends PublicContentRepository {
  getPublishedContent(): LegacyPortfolioContent;
  getProject(slug: string): Project | undefined;
}

const currentProcessOutcomes = [
  "A one-page brief we both agree on",
  "A clear creative direction",
  "First concepts and key visuals",
  "A polished system, reviewed with you",
  "Final files, ready to use",
];

const currentToolkit = [
  { name: "Adobe Illustrator", use: "Logos, packaging, marks and vector systems" },
  { name: "Adobe Photoshop", use: "Profesonal retouching, Mockups and image work" },
  { name: "Adobe After Effect", use: "Animations and motion graphics" },
  { name: "Adobe Premiere Pro", use: "Video editing, assemble video clips and audio tracks" },
  { name: "Figma", use: "Brand guidelines, layouts and presentations" },
];

const currentNavigation = [
  { href: "work", label: "Work" },
  { href: "services", label: "Services" },
  { href: "about", label: "About" },
  { href: "experience", label: "Experience" },
  { href: "contact", label: "Contact" },
];

const currentHomeSections = {
  hero: {
    eyebrow: site.availability,
    title: "Where Strategy Becomes Identity",
    body: "I'm Hasibuzzaman, You can call me Hasib. I build distinctive brand identities through strategic thinking, purposeful design, and uncompromising attention to detail.",
  },
  projectHighlights: "Selected work",
  projects: {
    eyebrow: "Selected work",
    title: "Every project, one place to explore.",
    intro: "Filter by discipline, or open a project to see the full story behind it.",
  },
  services: {
    eyebrow: "Services",
    title: "What I make.",
    intro: "Two things I do best, and three that keep a brand consistent everywhere it shows up.",
  },
  profile: {
    eyebrow: "About",
    title: "The person behind the pixels.",
    biography: [
      "I'm Hasib Himel, a graphic designer specializing in brand identity, product packaging, and visual communication.",
      "My work brings together creative thinking and practical design execution — transforming visual concepts into cohesive identities, thoughtful packaging, and compelling product presentations.",
    ],
  },
  experience: {
    eyebrow: "Experience",
    title: "Three chapters, one timeline.",
    intro:
      "Read it like an edit: every role is a clip on my timeline. Pick a clip to see what I did there.",
  },
  process: {
    eyebrow: "Process · 5 steps",
    title: "From first brief to final file.",
    intro:
      "Every project travels the same road. Here is what you get at each stop, so you always know where we are.",
  },
  faqs: {
    eyebrow: "FAQ",
    title: "Ask me anything.",
    intro: "These are the questions clients ask most. Tap one and I'll answer it in the chat.",
  },
  contact: {
    eyebrow: "Contact",
    title: "Creativity is the voice that speaks without words.",
    intro: "Transforming your vision into creative reality.",
  },
};

const currentTheme = {
  colors: {
    background: "oklch(0.12 0.025 264)",
    surface: "oklch(0.16 0.03 264)",
    "surface-secondary": "oklch(0.2 0.035 264)",
    foreground: "oklch(0.96 0.008 264)",
    primary: "oklch(0.62 0.21 262)",
    "primary-foreground": "oklch(0.98 0.005 264)",
    hot: "oklch(0.78 0.14 210)",
    cobalt: "oklch(0.52 0.22 264)",
    tangerine: "oklch(0.68 0.19 290)",
    "muted-foreground": "oklch(0.68 0.02 264)",
    destructive: "oklch(0.68 0.19 25)",
    success: "oklch(0.8 0.17 155)",
    border: "oklch(1 0 0 / 9%)",
    input: "oklch(1 0 0 / 14%)",
    tea: "oklch(0.5 0.14 155)",
    ghee: "oklch(0.75 0.18 62)",
    black: "oklch(0.42 0.12 22)",
    lentil: "oklch(0.73 0.2 42)",
    gold: "oklch(0.54 0.13 325)",
    ink: "oklch(0.38 0.09 290)",
    motion: "oklch(0.57 0.2 350)",
  },
  typography: {
    displayFont: "Space Grotesk",
    bodyFont: "Manrope",
    displayWeight: 600,
    bodyWeight: 400,
  },
  spacing: {
    scale: [0, 4, 8, 12, 16, 24, 32, 40, 48, 64, 80, 112],
    sectionBlock: 80,
  },
  layout: {
    contentMaxWidth: 1200,
    projectGrid: "masonry",
    sectionVariants: {
      hero: "centered",
      profile: "identity-card",
      experience: "timeline",
      faqs: "chat",
    },
  },
  radius: 16,
};

function stableId(namespace: string, ...identityParts: string[]) {
  return `${namespace}:${encodeURIComponent(JSON.stringify(identityParts))}`;
}

function seoRecord(title: string, description: string) {
  return {
    title,
    description,
    robots: { index: true, follow: true },
    social: {
      openGraphTitle: title,
      openGraphDescription: description,
      twitterCard: "summary_large_image" as const,
      twitterTitle: title,
      twitterDescription: description,
    },
  };
}

export function migrateLegacyPortfolioContent(input: unknown): ContentSnapshot {
  const legacy = legacyPortfolioContentSchema.parse(input);
  const media: ContentSnapshot["media"] = [];

  const categoryRecords = legacy.categories
    .filter(
      (category): category is Exclude<typeof category, "All Projects"> =>
        category !== "All Projects",
    )
    .map((name, order) => ({
      id: stableId("category", name),
      slug: name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, ""),
      name,
      order,
    }));

  const projects = legacy.projects.map((project, order) => {
    const projectId = stableId("project", project.slug);
    const projectMedia = (project.gallery ?? []).map((reference) => {
      const mediaId = stableId("media", project.slug, "gallery", reference.id);
      media.push({
        id: mediaId,
        source: { kind: "url", url: reference.src },
        alt: reference.alt,
      });
      return { mediaId, alt: reference.alt };
    });

    let coverMedia: { mediaId: string; alt: string } | undefined;
    if (project.cover) {
      const mediaId = stableId("media", project.slug, "cover");
      const alt = `${project.title} — ${project.category}`;
      media.push({
        id: mediaId,
        source: { kind: "url", url: project.cover },
        alt,
      });
      coverMedia = { mediaId, alt };
    }

    return {
      id: projectId,
      order,
      slug: project.slug,
      title: project.title,
      categoryId: stableId("category", project.category),
      category: project.category,
      type: project.type,
      description: project.description,
      ...(project.year === undefined ? {} : { year: project.year }),
      tone: project.tone,
      ...(project.cover === undefined ? {} : { cover: project.cover }),
      ...(coverMedia === undefined ? {} : { coverMedia }),
      gallery: projectMedia,
      placeholder: project.placeholder,
      ...(project.behance === undefined ? {} : { behance: project.behance }),
      sections: project.sections.map((section, sectionOrder) => ({
        id: stableId("case-section", project.slug, section.title),
        order: sectionOrder,
        title: section.title,
        body: section.body,
        ...(section.visual === undefined ? {} : { visual: section.visual }),
        media: [],
      })),
      ...(project.palette === undefined ? {} : { palette: [...project.palette] }),
      visible: true,
    };
  });

  const serviceRecords = legacy.services.map((service, order) => ({
    id: stableId("service", service.n, service.title),
    order,
    ...service,
    items: [...service.items],
    visible: true,
  }));
  const experienceRecords = legacy.experience.map((entry, order) => ({
    id: stableId("experience", entry.company, entry.role, entry.type, entry.location, entry.dates),
    order,
    ...entry,
    visible: true,
  }));
  const processRecords = legacy.process.map((step, order) => ({
    id: stableId("process", step.n, step.title),
    order,
    ...step,
    outcomes: [legacy.processOutcomes[order]!],
    visible: true,
  }));
  const faqRecords = legacy.faqs.map((faq, order) => ({
    id: stableId("faq", faq.q),
    order,
    ...faq,
    visible: true,
  }));
  const navigation = legacy.navigation.map((item, order) => ({
    id: stableId("navigation", item.href),
    order,
    label: item.label,
    target: { kind: "section" as const, sectionId: stableId("section", "home", item.href) },
    visible: true,
  }));
  const footerNavigation = legacy.navigation.map((item, order) => ({
    id: stableId("footer-navigation", item.href),
    order,
    label: item.label,
    target: { kind: "section" as const, sectionId: stableId("section", "home", item.href) },
    visible: true,
  }));

  const profileId = stableId("profile", "owner");
  const pageSections: ContentSnapshot["pages"][number]["sections"] = [
    {
      id: stableId("section", "home", "hero"),
      order: 0,
      visible: true,
      type: "hero",
      data: {
        eyebrow: currentHomeSections.hero.eyebrow,
        title: currentHomeSections.hero.title,
        body: currentHomeSections.hero.body,
        primaryCta: {
          label: "Explore My Work",
          target: { kind: "section", sectionId: stableId("section", "home", "work") },
        },
        secondaryCta: {
          label: "Let's talk",
          target: { kind: "section", sectionId: stableId("section", "home", "contact") },
        },
      },
    },
    {
      id: stableId("section", "home", "project-highlights"),
      order: 1,
      visible: true,
      type: "project-highlights",
      data: {
        label: currentHomeSections.projectHighlights,
        projectIds: legacy.featuredSlugs.map((slug) => stableId("project", slug)),
      },
    },
    {
      id: stableId("section", "home", "work"),
      order: 2,
      visible: true,
      type: "project-grid",
      data: {
        ...currentHomeSections.projects,
        projectIds: projects.map(({ id }) => id),
        categoryIds: categoryRecords.map(({ id }) => id),
        layout: "masonry",
      },
    },
    {
      id: stableId("section", "home", "services"),
      order: 3,
      visible: true,
      type: "services",
      data: {
        ...currentHomeSections.services,
        serviceIds: serviceRecords.map(({ id }) => id),
      },
    },
    {
      id: stableId("section", "home", "about"),
      order: 4,
      visible: true,
      type: "profile",
      data: {
        eyebrow: currentHomeSections.profile.eyebrow,
        title: currentHomeSections.profile.title,
        profileId,
      },
    },
    {
      id: stableId("section", "home", "experience"),
      order: 5,
      visible: true,
      type: "experience",
      data: {
        ...currentHomeSections.experience,
        experienceIds: experienceRecords.map(({ id }) => id),
      },
    },
    {
      id: stableId("section", "home", "process"),
      order: 6,
      visible: true,
      type: "process",
      data: {
        ...currentHomeSections.process,
        processStepIds: processRecords.map(({ id }) => id),
      },
    },
    {
      id: stableId("section", "home", "faqs"),
      order: 7,
      visible: true,
      type: "faqs",
      data: {
        ...currentHomeSections.faqs,
        faqIds: faqRecords.map(({ id }) => id),
      },
    },
    {
      id: stableId("section", "home", "contact"),
      order: 8,
      visible: true,
      type: "contact",
      data: currentHomeSections.contact,
    },
  ];

  const title = "Hasib Himel — Brand Identity & Product Designer";
  const description =
    "Portfolio of Hasib Himel, a Bangladesh-based brand identity and product designer creating visual identities, packaging and product advertising.";
  return contentSnapshotSchema.parse({
    schemaVersion: CMS_SCHEMA_VERSION,
    origin: "static-baseline",
    siteId: stableId("site", "portfolio"),
    revisions: [],
    publication: {
      status: "static-baseline",
      publishedRevisionId: null,
      draftRevisionId: null,
      updatedAt: null,
    },
    identity: { ...legacy.site },
    profile: {
      id: profileId,
      fullName: legacy.site.fullName,
      role: legacy.site.role,
      location: legacy.site.location,
      biography: [...currentHomeSections.profile.biography],
      focus: "Brands & packaging",
      portraitPlaceholder: "Placeholder · replace with your portrait",
      toolkit: currentToolkit.map((item, order) => ({
        id: stableId("toolkit", item.name),
        order,
        ...item,
      })),
      stats: [
        {
          id: stableId("profile-stat", "Projects designed"),
          order: 0,
          value: `${legacy.projects.length}+`,
          label: "Projects designed",
        },
        {
          id: stableId("profile-stat", "Design disciplines"),
          order: 1,
          value: "5",
          label: "Design disciplines",
        },
        {
          id: stableId("profile-stat", "Studios & teams"),
          order: 2,
          value: "3",
          label: "Studios & teams",
        },
        {
          id: stableId("profile-stat", "Industries served"),
          order: 3,
          value: "6+",
          label: "Industries served",
        },
      ],
    },
    pages: [
      {
        id: stableId("page", "home"),
        slug: "/",
        title: "Home",
        order: 0,
        sections: pageSections,
        seo: seoRecord(title, description),
      },
    ],
    categories: categoryRecords,
    projects,
    featuredProjectIds: legacy.featuredSlugs.map((slug) => stableId("project", slug)),
    services: serviceRecords,
    experience: experienceRecords,
    process: processRecords,
    faqs: faqRecords,
    contact: {
      publicEmail: legacy.site.email,
      whatsapp: legacy.site.whatsapp,
      socialLinks: {
        behance: legacy.site.behance,
        linkedin: legacy.site.linkedin,
      },
      form: {
        enabled: true,
        delivery: legacy.site.email ? "mailto" : "none",
        projectTypes: [
          "a brand identity",
          "packaging design",
          "product advertising",
          "corporate branding",
          "motion design",
          "something else",
        ],
        timelines: ["as soon as possible", "within a month", "in 1–3 months", "flexible"],
        allowCompany: true,
        allowAdditionalDetails: true,
        additionalDetailsLabel: "Anything else? (optional)",
      },
    },
    navigation,
    footer: {
      identityLabel: "Hasib.Design",
      ctaEyebrow: "Got a brand or a product story?",
      ctaFallback: "Let's talk about your next project",
      socialHeading: "Elsewhere",
      navigationHeading: "Navigate",
      locationHeading: "Local time",
      locationText: "Dhaka, Bangladesh",
      timezone: "GMT+6",
      copyrightText: "Designed & built in Dhaka",
      backToTopLabel: "Back to top",
      navigation: footerNavigation,
    },
    seo: seoRecord(title, description),
    theme: currentTheme,
    media,
  });
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

export function createStaticPortfolioRepository(input: unknown): StaticPortfolioRepository {
  const legacy = legacyPortfolioContentSchema.parse(input);
  const snapshot = migrateLegacyPortfolioContent(legacy);

  return {
    getPublishedContent: () => clone(legacy),
    getProject: (slug) => {
      const project = legacy.projects.find((item) => item.slug === slug);
      return project ? clone(project) : undefined;
    },
    getPublishedSnapshot: async () => clone(snapshot),
    getPublishedProject: async (slug) => {
      const project = snapshot.projects.find((item) => item.slug === slug);
      return project ? clone(project) : null;
    },
  };
}

const staticLegacyContent = {
  site,
  categories,
  featuredSlugs,
  projects,
  services,
  experience,
  process,
  processOutcomes: currentProcessOutcomes,
  faqs,
  navigation: currentNavigation,
} satisfies LegacyPortfolioContent;

export const portfolioRepository = createStaticPortfolioRepository(staticLegacyContent);

export type { Project, Site };
