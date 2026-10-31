import { z } from "zod";

export const CMS_SCHEMA_VERSION = 1 as const;

export const categorySchema = z.enum([
  "Brand Identity",
  "Packaging Design",
  "Product Advertising",
  "Corporate Branding",
  "Motion & Visual Design",
]);

export const toneSchema = z.enum([
  "tea",
  "ghee",
  "black",
  "lentil",
  "steel",
  "gold",
  "ink",
  "motion",
]);

const idSchema = z.string().min(1);
const slugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
  message: "Use lowercase letters, numbers, and single hyphens in slugs.",
});
const orderSchema = z.number().int().nonnegative();
const emailSchema = z
  .string()
  .refine((value) => value === "" || z.string().email().safeParse(value).success, {
    message: "Expected a valid email address or an empty string.",
  });
const httpUrlSchema = z
  .string()
  .url()
  .refine(
    (value) => {
      try {
        const protocol = new URL(value).protocol;
        return protocol === "http:" || protocol === "https:";
      } catch {
        return false;
      }
    },
    { message: "URL must use http or https." },
  );
const cssTokenValueSchema = z
  .string()
  .min(1)
  .refine(
    (value) =>
      /^#[\da-f]{3,8}$/i.test(value) ||
      /^oklch\([\d.\s/%+-]+\)$/i.test(value) ||
      /^var\(--[a-z][a-z0-9-]*\)$/i.test(value),
    { message: "Use a hex, OKLCH, or semantic CSS variable color token." },
  );
const fontFamilySchema = z.enum(["Space Grotesk", "Manrope", "system-ui", "sans-serif", "serif"]);

export const legacyMediaReferenceSchema = z.object({
  id: idSchema,
  src: z.string().min(1),
  alt: z.string(),
});

export const caseSectionSchema = z.object({
  title: z.string().min(1),
  body: z.string(),
  visual: z.string().optional(),
});

export const legacyProjectSchema = z.object({
  slug: slugSchema,
  title: z.string().min(1),
  category: categorySchema,
  type: z.string().min(1),
  description: z.string(),
  year: z.string().optional(),
  tone: toneSchema,
  cover: z.string().min(1).optional(),
  placeholder: z.string(),
  behance: httpUrlSchema.optional(),
  sections: z.array(caseSectionSchema),
  palette: z.array(z.string()).optional(),
  gallery: z.array(legacyMediaReferenceSchema).optional(),
});

export const siteSchema = z.object({
  name: z.string().min(1),
  fullName: z.string().min(1),
  role: z.string(),
  location: z.string(),
  availability: z.string(),
  available: z.boolean(),
  email: emailSchema,
  whatsapp: z.string(),
  behance: httpUrlSchema,
  linkedin: httpUrlSchema,
});

export const legacyServiceSchema = z.object({
  n: z.string().min(1),
  title: z.string().min(1),
  body: z.string(),
  items: z.array(z.string()),
});

export const legacyExperienceSchema = z.object({
  company: z.string().min(1),
  role: z.string(),
  type: z.string(),
  location: z.string(),
  dates: z.string(),
  body: z.string(),
});

export const legacyProcessStepSchema = z.object({
  n: z.string().min(1),
  title: z.string().min(1),
  body: z.string(),
});

export const legacyFaqSchema = z.object({
  q: z.string().min(1),
  a: z.string(),
});

export const legacyNavigationItemSchema = z.object({
  href: z.string().min(1),
  label: z.string().min(1),
});

export const legacyPortfolioContentSchema = z
  .object({
    site: siteSchema,
    categories: z.array(z.union([z.literal("All Projects"), categorySchema])),
    featuredSlugs: z.array(slugSchema),
    projects: z.array(legacyProjectSchema),
    services: z.array(legacyServiceSchema),
    experience: z.array(legacyExperienceSchema),
    process: z.array(legacyProcessStepSchema),
    processOutcomes: z.array(z.string()),
    faqs: z.array(legacyFaqSchema),
    navigation: z.array(legacyNavigationItemSchema),
  })
  .superRefine((content, context) => {
    const projectSlugs = new Set<string>();

    content.projects.forEach((project, index) => {
      if (projectSlugs.has(project.slug)) {
        context.addIssue({
          code: "custom",
          message: `Duplicate project slug: ${project.slug}`,
          path: ["projects", index, "slug"],
        });
      }
      projectSlugs.add(project.slug);

      if (!content.categories.includes(project.category)) {
        context.addIssue({
          code: "custom",
          message: `Unknown project category: ${project.category}`,
          path: ["projects", index, "category"],
        });
      }
    });

    content.featuredSlugs.forEach((slug, index) => {
      if (!projectSlugs.has(slug)) {
        context.addIssue({
          code: "custom",
          message: `Featured project does not exist: ${slug}`,
          path: ["featuredSlugs", index],
        });
      }
    });

    if (content.processOutcomes.length !== content.process.length) {
      context.addIssue({
        code: "custom",
        message: "Each process step must have exactly one outcome.",
        path: ["processOutcomes"],
      });
    }

    const checkUnique = (values: string[], path: (string | number)[], label: string) => {
      const seen = new Set<string>();
      values.forEach((value, index) => {
        if (seen.has(value)) {
          context.addIssue({
            code: "custom",
            message: `Duplicate ${label}: ${value}. Legacy data has no stable identity for these records.`,
            path: [...path, index],
          });
        }
        seen.add(value);
      });
    };

    checkUnique(
      content.categories.filter((value) => value !== "All Projects"),
      ["categories"],
      "category",
    );
    checkUnique(
      content.projects.map(({ slug }) => slug),
      ["projects"],
      "project slug",
    );
    checkUnique(content.featuredSlugs, ["featuredSlugs"], "featured project reference");
    checkUnique(
      content.services.map(({ n, title }) => JSON.stringify([n, title])),
      ["services"],
      "service identity",
    );
    checkUnique(
      content.experience.map(({ company, role, type, location, dates }) =>
        JSON.stringify([company, role, type, location, dates]),
      ),
      ["experience"],
      "experience identity",
    );
    checkUnique(
      content.process.map(({ n, title }) => JSON.stringify([n, title])),
      ["process"],
      "process identity",
    );
    checkUnique(
      content.faqs.map(({ q }) => q),
      ["faqs"],
      "FAQ question",
    );
    checkUnique(
      content.navigation.map(({ href }) => href),
      ["navigation"],
      "navigation target",
    );

    content.projects.forEach((project, projectIndex) => {
      checkUnique(
        project.sections.map(({ title }) => title),
        ["projects", projectIndex, "sections"],
        "case-study section title",
      );
      checkUnique(
        (project.gallery ?? []).map(({ id }) => id),
        ["projects", projectIndex, "gallery"],
        "gallery media reference",
      );
    });
  });

export const mediaReferenceSchema = z.object({
  mediaId: idSchema,
  alt: z.string(),
  focalPoint: z
    .object({
      x: z.number().min(0).max(1),
      y: z.number().min(0).max(1),
    })
    .optional(),
});

export const mediaAssetSchema = z.object({
  id: idSchema,
  source: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("url"), url: z.string().min(1) }),
    z.object({ kind: z.literal("storage"), key: idSchema }),
  ]),
  mimeType: z.string().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  sizeBytes: z.number().int().nonnegative().optional(),
  alt: z.string(),
  caption: z.string().optional(),
});

export const categoryRecordSchema = z.object({
  id: idSchema,
  slug: slugSchema,
  name: categorySchema,
  order: orderSchema,
});

export const caseStudySectionSchema = z.object({
  id: idSchema,
  order: orderSchema,
  title: z.string().min(1),
  body: z.string(),
  visual: z.string().optional(),
  media: z.array(mediaReferenceSchema),
});

export const projectRecordSchema = z.object({
  id: idSchema,
  order: orderSchema,
  slug: slugSchema,
  title: z.string().min(1),
  categoryId: idSchema,
  category: categorySchema,
  type: z.string().min(1),
  description: z.string(),
  year: z.string().optional(),
  tone: toneSchema,
  cover: z.string().min(1).optional(),
  coverMedia: mediaReferenceSchema.optional(),
  gallery: z.array(mediaReferenceSchema),
  placeholder: z.string(),
  behance: httpUrlSchema.optional(),
  sections: z.array(caseStudySectionSchema),
  palette: z.array(z.string()).optional(),
  visible: z.boolean(),
});

export const serviceRecordSchema = z.object({
  id: idSchema,
  order: orderSchema,
  n: z.string().min(1),
  title: z.string().min(1),
  body: z.string(),
  items: z.array(z.string()),
  visible: z.boolean(),
});

export const experienceRecordSchema = z.object({
  id: idSchema,
  order: orderSchema,
  company: z.string().min(1),
  role: z.string(),
  type: z.string(),
  location: z.string(),
  dates: z.string(),
  body: z.string(),
  visible: z.boolean(),
});

export const processStepSchema = z.object({
  id: idSchema,
  order: orderSchema,
  n: z.string().min(1),
  title: z.string().min(1),
  body: z.string(),
  outcomes: z.array(z.string()),
  visible: z.boolean(),
});

export const faqRecordSchema = z.object({
  id: idSchema,
  order: orderSchema,
  q: z.string().min(1),
  a: z.string(),
  visible: z.boolean(),
});

export const profileSchema = z.object({
  id: idSchema,
  fullName: z.string().min(1),
  role: z.string(),
  location: z.string(),
  biography: z.array(z.string()),
  focus: z.string(),
  portrait: mediaReferenceSchema.optional(),
  portraitPlaceholder: z.string(),
  toolkit: z.array(
    z.object({
      id: idSchema,
      order: orderSchema,
      name: z.string().min(1),
      use: z.string(),
    }),
  ),
  stats: z.array(
    z.object({
      id: idSchema,
      order: orderSchema,
      value: z.string(),
      label: z.string(),
    }),
  ),
});

export const ctaSchema = z.object({
  label: z.string().min(1),
  target: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("section"), sectionId: idSchema }),
    z.object({ kind: z.literal("page"), path: z.string().min(1) }),
    z.object({ kind: z.literal("external"), url: httpUrlSchema }),
  ]),
});

const sectionBase = {
  id: idSchema,
  order: orderSchema,
  visible: z.boolean(),
};

export const pageSectionSchema = z.discriminatedUnion("type", [
  z.object({
    ...sectionBase,
    type: z.literal("hero"),
    data: z.object({
      eyebrow: z.string(),
      title: z.string().min(1),
      body: z.string(),
      primaryCta: ctaSchema,
      secondaryCta: ctaSchema.optional(),
    }),
  }),
  z.object({
    ...sectionBase,
    type: z.literal("project-highlights"),
    data: z.object({
      label: z.string(),
      projectIds: z.array(idSchema),
    }),
  }),
  z.object({
    ...sectionBase,
    type: z.literal("project-grid"),
    data: z.object({
      eyebrow: z.string(),
      title: z.string(),
      intro: z.string(),
      projectIds: z.array(idSchema),
      categoryIds: z.array(idSchema),
      layout: z.enum(["grid", "masonry", "editorial"]),
    }),
  }),
  z.object({
    ...sectionBase,
    type: z.literal("services"),
    data: z.object({
      eyebrow: z.string(),
      title: z.string(),
      intro: z.string(),
      serviceIds: z.array(idSchema),
    }),
  }),
  z.object({
    ...sectionBase,
    type: z.literal("profile"),
    data: z.object({
      eyebrow: z.string(),
      title: z.string(),
      profileId: idSchema,
    }),
  }),
  z.object({
    ...sectionBase,
    type: z.literal("experience"),
    data: z.object({
      eyebrow: z.string(),
      title: z.string(),
      intro: z.string(),
      experienceIds: z.array(idSchema),
    }),
  }),
  z.object({
    ...sectionBase,
    type: z.literal("process"),
    data: z.object({
      eyebrow: z.string(),
      title: z.string(),
      intro: z.string(),
      processStepIds: z.array(idSchema),
    }),
  }),
  z.object({
    ...sectionBase,
    type: z.literal("faqs"),
    data: z.object({
      eyebrow: z.string(),
      title: z.string(),
      intro: z.string(),
      faqIds: z.array(idSchema),
    }),
  }),
  z.object({
    ...sectionBase,
    type: z.literal("contact"),
    data: z.object({
      eyebrow: z.string(),
      title: z.string(),
      intro: z.string(),
    }),
  }),
]);

export const seoSchema = z.object({
  title: z.string(),
  description: z.string(),
  canonicalPath: z.string().optional(),
  robots: z.object({
    index: z.boolean(),
    follow: z.boolean(),
  }),
  social: z.object({
    openGraphTitle: z.string(),
    openGraphDescription: z.string(),
    openGraphImage: mediaReferenceSchema.optional(),
    twitterCard: z.enum(["summary", "summary_large_image"]),
    twitterTitle: z.string(),
    twitterDescription: z.string(),
    twitterImage: mediaReferenceSchema.optional(),
  }),
});

export const pageSchema = z.object({
  id: idSchema,
  slug: z.string().min(1),
  title: z.string().min(1),
  order: orderSchema,
  sections: z.array(pageSectionSchema),
  seo: seoSchema,
});

export const contactSettingsSchema = z.object({
  publicEmail: emailSchema,
  whatsapp: z.string(),
  socialLinks: z.record(z.string(), httpUrlSchema),
  form: z.object({
    enabled: z.boolean(),
    delivery: z.enum(["mailto", "none"]),
    projectTypes: z.array(z.string()),
    timelines: z.array(z.string()),
    allowCompany: z.boolean(),
    allowAdditionalDetails: z.boolean(),
    additionalDetailsLabel: z.string(),
  }),
});

export const navigationTargetSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("section"), sectionId: idSchema }),
  z.object({ kind: z.literal("page"), path: z.string().min(1) }),
  z.object({ kind: z.literal("external"), url: httpUrlSchema }),
]);

export const navigationItemSchema = z.object({
  id: idSchema,
  order: orderSchema,
  label: z.string().min(1),
  target: navigationTargetSchema,
  visible: z.boolean(),
});

export const footerSchema = z.object({
  identityLabel: z.string(),
  ctaEyebrow: z.string(),
  ctaFallback: z.string(),
  socialHeading: z.string(),
  navigationHeading: z.string(),
  locationHeading: z.string(),
  locationText: z.string(),
  timezone: z.string(),
  copyrightText: z.string(),
  backToTopLabel: z.string(),
  navigation: z.array(navigationItemSchema),
});

export const themeSchema = z.object({
  colors: z.record(z.string().regex(/^[a-z][a-z0-9-]*$/), cssTokenValueSchema),
  typography: z.object({
    displayFont: fontFamilySchema,
    bodyFont: fontFamilySchema,
    displayWeight: z.number().int().min(100).max(900).multipleOf(100),
    bodyWeight: z.number().int().min(100).max(900).multipleOf(100),
  }),
  spacing: z.object({
    scale: z.array(z.number().nonnegative()),
    sectionBlock: z.number().positive(),
  }),
  layout: z.object({
    contentMaxWidth: z.number().positive(),
    projectGrid: z.enum(["grid", "masonry", "editorial"]),
    sectionVariants: z.record(z.string(), z.string()),
  }),
  radius: z.number().nonnegative(),
});

export const revisionMetadataSchema = z.object({
  id: idSchema,
  number: z.number().int().positive(),
  status: z.enum(["draft", "published", "unpublished"]),
  createdAt: z.string().datetime().nullable(),
  updatedAt: z.string().datetime().nullable(),
  publishedAt: z.string().datetime().nullable(),
  basedOnRevisionId: idSchema.nullable(),
  createdBy: idSchema.nullable(),
});

export const publicationMetadataSchema = z.object({
  status: z.enum(["static-baseline", "published", "unpublished"]),
  publishedRevisionId: idSchema.nullable(),
  draftRevisionId: idSchema.nullable(),
  updatedAt: z.string().datetime().nullable(),
});

export const contentSnapshotSchema = z
  .object({
    schemaVersion: z.literal(CMS_SCHEMA_VERSION),
    origin: z.enum(["static-baseline", "cms"]),
    siteId: idSchema,
    revisions: z.array(revisionMetadataSchema),
    publication: publicationMetadataSchema,
    identity: siteSchema,
    profile: profileSchema,
    pages: z.array(pageSchema),
    categories: z.array(categoryRecordSchema),
    projects: z.array(projectRecordSchema),
    featuredProjectIds: z.array(idSchema),
    services: z.array(serviceRecordSchema),
    experience: z.array(experienceRecordSchema),
    process: z.array(processStepSchema),
    faqs: z.array(faqRecordSchema),
    contact: contactSettingsSchema,
    navigation: z.array(navigationItemSchema),
    footer: footerSchema,
    seo: seoSchema,
    theme: themeSchema,
    media: z.array(mediaAssetSchema),
  })
  .superRefine((snapshot, context) => {
    // All entity IDs share one snapshot-wide namespace; ordered relationship lists
    // may reuse IDs only across separate relationships, never within one list.
    const checkUniqueIds = (entries: readonly { id: string }[], path: (string | number)[]) => {
      const seen = new Set<string>();
      entries.forEach((entry, index) => {
        if (seen.has(entry.id)) {
          context.addIssue({
            code: "custom",
            message: `Duplicate id: ${entry.id}`,
            path: [...path, index, "id"],
          });
        }
        seen.add(entry.id);
      });
    };

    const checkUniqueOrder = (entries: readonly { order: number }[], path: (string | number)[]) => {
      const seen = new Set<number>();
      entries.forEach((entry, index) => {
        if (seen.has(entry.order)) {
          context.addIssue({
            code: "custom",
            message: `Duplicate order value: ${entry.order}`,
            path: [...path, index, "order"],
          });
        }
        seen.add(entry.order);
      });
    };

    const categoryIds = new Set(snapshot.categories.map(({ id }) => id));
    const projectIds = new Set(snapshot.projects.map(({ id }) => id));
    const serviceIds = new Set(snapshot.services.map(({ id }) => id));
    const experienceIds = new Set(snapshot.experience.map(({ id }) => id));
    const processIds = new Set(snapshot.process.map(({ id }) => id));
    const faqIds = new Set(snapshot.faqs.map(({ id }) => id));
    const mediaIds = new Set(snapshot.media.map(({ id }) => id));
    const sectionIds = new Set(
      snapshot.pages.flatMap(({ sections }) => sections.map(({ id }) => id)),
    );
    const pageSlugs = new Set(snapshot.pages.map(({ slug }) => slug));
    const categoriesById = new Map(snapshot.categories.map((category) => [category.id, category]));

    checkUniqueIds(snapshot.categories, ["categories"]);
    checkUniqueOrder(snapshot.categories, ["categories"]);
    checkUniqueIds(snapshot.projects, ["projects"]);
    checkUniqueOrder(snapshot.projects, ["projects"]);
    snapshot.projects.forEach((project, index) => {
      checkUniqueIds(project.sections, ["projects", index, "sections"]);
      checkUniqueOrder(project.sections, ["projects", index, "sections"]);
    });
    checkUniqueIds(snapshot.services, ["services"]);
    checkUniqueOrder(snapshot.services, ["services"]);
    checkUniqueIds(snapshot.experience, ["experience"]);
    checkUniqueOrder(snapshot.experience, ["experience"]);
    checkUniqueIds(snapshot.process, ["process"]);
    checkUniqueOrder(snapshot.process, ["process"]);
    checkUniqueIds(snapshot.faqs, ["faqs"]);
    checkUniqueOrder(snapshot.faqs, ["faqs"]);
    checkUniqueIds(snapshot.media, ["media"]);
    checkUniqueIds(snapshot.pages, ["pages"]);
    checkUniqueOrder(snapshot.pages, ["pages"]);
    checkUniqueIds(snapshot.navigation, ["navigation"]);
    checkUniqueOrder(snapshot.navigation, ["navigation"]);
    checkUniqueIds(snapshot.footer.navigation, ["footer", "navigation"]);
    checkUniqueOrder(snapshot.footer.navigation, ["footer", "navigation"]);
    checkUniqueIds(snapshot.profile.toolkit, ["profile", "toolkit"]);
    checkUniqueOrder(snapshot.profile.toolkit, ["profile", "toolkit"]);
    checkUniqueIds(snapshot.profile.stats, ["profile", "stats"]);

    const allEntityIds = [
      snapshot.siteId,
      snapshot.profile.id,
      ...snapshot.profile.toolkit.map(({ id }) => id),
      ...snapshot.profile.stats.map(({ id }) => id),
      ...snapshot.categories.map(({ id }) => id),
      ...snapshot.projects.map(({ id }) => id),
      ...snapshot.projects.flatMap((project) => project.sections.map(({ id }) => id)),
      ...snapshot.services.map(({ id }) => id),
      ...snapshot.experience.map(({ id }) => id),
      ...snapshot.process.map(({ id }) => id),
      ...snapshot.faqs.map(({ id }) => id),
      ...snapshot.media.map(({ id }) => id),
      ...snapshot.pages.map(({ id }) => id),
      ...snapshot.pages.flatMap((page) => page.sections.map(({ id }) => id)),
      ...snapshot.navigation.map(({ id }) => id),
      ...snapshot.footer.navigation.map(({ id }) => id),
      ...snapshot.revisions.map(({ id }) => id),
    ];
    const allEntityIdSet = new Set(allEntityIds);
    if (allEntityIdSet.size !== allEntityIds.length) {
      context.addIssue({
        code: "custom",
        message: "Entity IDs must be unique across the entire content snapshot.",
        path: [],
      });
    }
    checkUniqueOrder(snapshot.profile.stats, ["profile", "stats"]);

    const slugs = new Set<string>();
    snapshot.projects.forEach((project, index) => {
      if (slugs.has(project.slug)) {
        context.addIssue({
          code: "custom",
          message: `Duplicate project slug: ${project.slug}`,
          path: ["projects", index, "slug"],
        });
      }
      slugs.add(project.slug);
      if (!categoryIds.has(project.categoryId)) {
        context.addIssue({
          code: "custom",
          message: `Project references an unknown category: ${project.categoryId}`,
          path: ["projects", index, "categoryId"],
        });
      } else if (categoriesById.get(project.categoryId)?.name !== project.category) {
        context.addIssue({
          code: "custom",
          message: "Project category label must match its category reference.",
          path: ["projects", index, "category"],
        });
      }
      if (project.coverMedia && !mediaIds.has(project.coverMedia.mediaId)) {
        context.addIssue({
          code: "custom",
          message: `Project cover references unknown media: ${project.coverMedia.mediaId}`,
          path: ["projects", index, "coverMedia", "mediaId"],
        });
      }
      project.gallery.forEach((media, mediaIndex) => {
        if (!mediaIds.has(media.mediaId)) {
          context.addIssue({
            code: "custom",
            message: `Project gallery references unknown media: ${media.mediaId}`,
            path: ["projects", index, "gallery", mediaIndex, "mediaId"],
          });
        }
      });
      project.sections.forEach((section, sectionIndex) => {
        section.media.forEach((media, mediaIndex) => {
          if (!mediaIds.has(media.mediaId)) {
            context.addIssue({
              code: "custom",
              message: `Case-study section references unknown media: ${media.mediaId}`,
              path: ["projects", index, "sections", sectionIndex, "media", mediaIndex, "mediaId"],
            });
          }
        });
      });
    });

    snapshot.featuredProjectIds.forEach((id, index) => {
      if (!projectIds.has(id)) {
        context.addIssue({
          code: "custom",
          message: `Featured project does not exist: ${id}`,
          path: ["featuredProjectIds", index],
        });
      }
    });

    const uniqueReferenceLists = [
      { values: snapshot.featuredProjectIds, path: ["featuredProjectIds"] },
      { values: snapshot.pages.map(({ slug }) => slug), path: ["pages"] },
      {
        values: snapshot.navigation.map(({ target }) => JSON.stringify(target)),
        path: ["navigation"],
      },
      {
        values: snapshot.footer.navigation.map(({ target }) => JSON.stringify(target)),
        path: ["footer", "navigation"],
      },
      ...snapshot.projects.flatMap((project, projectIndex) => [
        {
          values: project.gallery.map(({ mediaId }) => mediaId),
          path: ["projects", projectIndex, "gallery"],
        },
        ...project.sections.map((section, sectionIndex) => ({
          values: section.media.map(({ mediaId }) => mediaId),
          path: ["projects", projectIndex, "sections", sectionIndex, "media"],
        })),
      ]),
      ...snapshot.pages.flatMap((page, pageIndex) =>
        page.sections.flatMap((section, sectionIndex) => {
          const lists =
            section.type === "project-highlights"
              ? [
                  {
                    values: section.data.projectIds,
                    path: ["pages", pageIndex, "sections", sectionIndex, "data", "projectIds"],
                  },
                ]
              : section.type === "project-grid"
                ? [
                    {
                      values: section.data.projectIds,
                      path: ["pages", pageIndex, "sections", sectionIndex, "data", "projectIds"],
                    },
                    {
                      values: section.data.categoryIds,
                      path: ["pages", pageIndex, "sections", sectionIndex, "data", "categoryIds"],
                    },
                  ]
                : section.type === "services"
                  ? [
                      {
                        values: section.data.serviceIds,
                        path: ["pages", pageIndex, "sections", sectionIndex, "data", "serviceIds"],
                      },
                    ]
                  : section.type === "experience"
                    ? [
                        {
                          values: section.data.experienceIds,
                          path: [
                            "pages",
                            pageIndex,
                            "sections",
                            sectionIndex,
                            "data",
                            "experienceIds",
                          ],
                        },
                      ]
                    : section.type === "process"
                      ? [
                          {
                            values: section.data.processStepIds,
                            path: [
                              "pages",
                              pageIndex,
                              "sections",
                              sectionIndex,
                              "data",
                              "processStepIds",
                            ],
                          },
                        ]
                      : section.type === "faqs"
                        ? [
                            {
                              values: section.data.faqIds,
                              path: [
                                "pages",
                                pageIndex,
                                "sections",
                                sectionIndex,
                                "data",
                                "faqIds",
                              ],
                            },
                          ]
                        : [];
          return lists;
        }),
      ),
    ];
    uniqueReferenceLists.forEach(({ values, path }) => {
      if (new Set(values).size !== values.length) {
        context.addIssue({
          code: "custom",
          message: "Values must be unique.",
          path,
        });
      }
    });

    snapshot.pages.forEach((page, pageIndex) => {
      checkUniqueIds(page.sections, ["pages", pageIndex, "sections"]);
      checkUniqueOrder(page.sections, ["pages", pageIndex, "sections"]);
      page.sections.forEach((section, sectionIndex) => {
        const refs =
          section.type === "project-highlights" || section.type === "project-grid"
            ? section.data.projectIds.map((id) => ["project", id] as const)
            : section.type === "services"
              ? section.data.serviceIds.map((id) => ["service", id] as const)
              : section.type === "profile"
                ? [["profile", section.data.profileId] as const]
                : section.type === "experience"
                  ? section.data.experienceIds.map((id) => ["experience", id] as const)
                  : section.type === "process"
                    ? section.data.processStepIds.map((id) => ["process", id] as const)
                    : section.type === "faqs"
                      ? section.data.faqIds.map((id) => ["faq", id] as const)
                      : [];

        refs.forEach(([kind, id]) => {
          const exists =
            kind === "project"
              ? projectIds.has(id)
              : kind === "service"
                ? serviceIds.has(id)
                : kind === "experience"
                  ? experienceIds.has(id)
                  : kind === "process"
                    ? processIds.has(id)
                    : kind === "faq"
                      ? faqIds.has(id)
                      : id === snapshot.profile.id;
          if (!exists) {
            context.addIssue({
              code: "custom",
              message: `Section references an unknown ${kind}: ${id}`,
              path: ["pages", pageIndex, "sections", sectionIndex, "data"],
            });
          }
        });

        if (section.type === "project-grid") {
          section.data.categoryIds.forEach((categoryId) => {
            if (!categoryIds.has(categoryId)) {
              context.addIssue({
                code: "custom",
                message: `Project grid references an unknown category: ${categoryId}`,
                path: ["pages", pageIndex, "sections", sectionIndex, "data", "categoryIds"],
              });
            }
          });
        }

        if (section.type === "hero") {
          const ctas = [
            section.data.primaryCta,
            ...(section.data.secondaryCta ? [section.data.secondaryCta] : []),
          ];
          ctas.forEach((cta) => {
            const target = cta.target;
            const exists =
              target.kind === "section"
                ? sectionIds.has(target.sectionId)
                : target.kind === "page"
                  ? pageSlugs.has(target.path)
                  : true;
            if (!exists) {
              context.addIssue({
                code: "custom",
                message:
                  target.kind === "section"
                    ? `CTA references an unknown section: ${target.sectionId}`
                    : target.kind === "page"
                      ? `CTA references an unknown page: ${target.path}`
                      : "CTA references an unknown external target.",
                path: [
                  "pages",
                  pageIndex,
                  "sections",
                  sectionIndex,
                  "data",
                  "primaryCta",
                  "target",
                ],
              });
            }
          });
        }
      });

      const mediaReferences = [
        ...(page.seo.social.openGraphImage ? [page.seo.social.openGraphImage] : []),
        ...(page.seo.social.twitterImage ? [page.seo.social.twitterImage] : []),
      ];
      mediaReferences.forEach((reference) => {
        if (!mediaIds.has(reference.mediaId)) {
          context.addIssue({
            code: "custom",
            message: `Page SEO references unknown media: ${reference.mediaId}`,
            path: ["pages", pageIndex, "seo", "social"],
          });
        }
      });
    });

    const siteSeoMedia = [
      ...(snapshot.seo.social.openGraphImage ? [snapshot.seo.social.openGraphImage] : []),
      ...(snapshot.seo.social.twitterImage ? [snapshot.seo.social.twitterImage] : []),
    ];
    if (snapshot.profile.portrait && !mediaIds.has(snapshot.profile.portrait.mediaId)) {
      context.addIssue({
        code: "custom",
        message: `Profile references unknown portrait media: ${snapshot.profile.portrait.mediaId}`,
        path: ["profile", "portrait", "mediaId"],
      });
    }
    siteSeoMedia.forEach((reference) => {
      if (!mediaIds.has(reference.mediaId)) {
        context.addIssue({
          code: "custom",
          message: `Site SEO references unknown media: ${reference.mediaId}`,
          path: ["seo", "social"],
        });
      }
    });

    if (!snapshot.pages.some(({ slug }) => slug === "/")) {
      context.addIssue({
        code: "custom",
        message: "A home page with slug '/' is required.",
        path: ["pages"],
      });
    }

    [
      ...snapshot.navigation.map((item, index) => ({
        item,
        path: ["navigation", index, "target"] as (string | number)[],
      })),
      ...snapshot.footer.navigation.map((item, index) => ({
        item,
        path: ["footer", "navigation", index, "target"] as (string | number)[],
      })),
    ].forEach(({ item, path }) => {
      const target = item.target;
      const exists =
        target.kind === "section"
          ? sectionIds.has(target.sectionId)
          : target.kind === "page"
            ? pageSlugs.has(target.path)
            : true;
      if (!exists) {
        context.addIssue({
          code: "custom",
          message:
            target.kind === "section"
              ? `Navigation references an unknown section: ${target.sectionId}`
              : target.kind === "page"
                ? `Navigation references an unknown page: ${target.path}`
                : "Navigation references an unknown external target.",
          path,
        });
      }
    });

    const revisionsById = new Map(snapshot.revisions.map((revision) => [revision.id, revision]));
    checkUniqueIds(snapshot.revisions, ["revisions"]);
    const checkRevisionPointer = (
      revisionId: string | null,
      path: (string | number)[],
      expectedStatus?: "draft" | "published" | "unpublished",
    ) => {
      if (revisionId === null) return;
      const revision = revisionsById.get(revisionId);
      if (!revision) {
        context.addIssue({
          code: "custom",
          message: `Revision pointer references an unknown revision: ${revisionId}`,
          path,
        });
      } else if (expectedStatus && revision.status !== expectedStatus) {
        context.addIssue({
          code: "custom",
          message: `Revision pointer must reference a ${expectedStatus} revision.`,
          path,
        });
      }
    };

    checkRevisionPointer(
      snapshot.publication.publishedRevisionId,
      ["publication", "publishedRevisionId"],
      "published",
    );
    checkRevisionPointer(
      snapshot.publication.draftRevisionId,
      ["publication", "draftRevisionId"],
      "draft",
    );
    snapshot.revisions.forEach((revision, index) => {
      checkRevisionPointer(revision.basedOnRevisionId, ["revisions", index, "basedOnRevisionId"]);
    });

    if (snapshot.origin === "static-baseline") {
      if (
        snapshot.revisions.length > 0 ||
        snapshot.publication.status !== "static-baseline" ||
        snapshot.publication.publishedRevisionId !== null ||
        snapshot.publication.draftRevisionId !== null
      ) {
        context.addIssue({
          code: "custom",
          message: "A static baseline cannot claim persisted revision or publication state.",
          path: ["publication"],
        });
      }
    } else if (snapshot.publication.status === "static-baseline") {
      context.addIssue({
        code: "custom",
        message: "CMS-origin content must have an explicit publication state.",
        path: ["publication", "status"],
      });
    }

    if (
      snapshot.publication.status === "published" &&
      snapshot.publication.publishedRevisionId === null
    ) {
      context.addIssue({
        code: "custom",
        message: "Published CMS content must reference a published revision.",
        path: ["publication", "publishedRevisionId"],
      });
    }
  });

export type Category = z.infer<typeof categorySchema>;
export type Tone = z.infer<typeof toneSchema>;
export type LegacyMediaReference = z.infer<typeof legacyMediaReferenceSchema>;
export type MediaReference = z.infer<typeof mediaReferenceSchema>;
export type MediaAsset = z.infer<typeof mediaAssetSchema>;
export type CaseSection = z.infer<typeof caseSectionSchema>;
export type Project = z.infer<typeof legacyProjectSchema>;
export type CmsProject = z.infer<typeof projectRecordSchema>;
export type Site = z.infer<typeof siteSchema>;
export type LegacyPortfolioContent = z.infer<typeof legacyPortfolioContentSchema>;
export type PortfolioContent = z.infer<typeof contentSnapshotSchema>;
export type PageSection = z.infer<typeof pageSectionSchema>;
export type ContentSnapshot = z.infer<typeof contentSnapshotSchema>;
