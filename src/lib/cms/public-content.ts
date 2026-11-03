import { getPublishedCmsServerFn } from "@/lib/cms/server-functions";
import { formatExperienceDateRange } from "@/lib/cms/experience-dates";
import {
  contentSnapshotSchema,
  type ContentSnapshot,
  type LegacyPortfolioContent,
  type MediaAsset,
} from "@/lib/cms/schema";
import { portfolioRepository } from "@/lib/cms/repository";
import type { CSSProperties } from "react";

export type PublicPortfolio = {
  content: LegacyPortfolioContent;
  snapshot: ContentSnapshot;
  mediaUrls: Record<string, string>;
};

export function getPublicThemeStyle(
  snapshot?: ContentSnapshot,
  includeStaticPreview = false,
): CSSProperties | undefined {
  if (!snapshot || (snapshot.origin === "static-baseline" && !includeStaticPreview)) {
    return undefined;
  }
  const colors = Object.fromEntries(
    Object.entries(snapshot.theme.colors).map(([name, value]) => [
      name === "surface-secondary"
        ? "--surface-2"
        : ["tea", "ghee", "black", "lentil", "steel", "gold", "ink", "motion"].includes(name)
          ? `--tone-${name}`
          : `--${name}`,
      value,
    ]),
  );
  const appearanceVariables: Record<string, string> = {};
  const typographyVariables: Record<string, string> = {};
  const appearance = snapshot.theme.appearance;
  if (appearance) {
    for (const mode of ["light", "dark"] as const) {
      const settings = appearance.modes[mode];
      const modeColors = {
        background: settings.colors.background,
        surface: settings.colors.surface,
        "surface-2": settings.colors.surfaceSecondary,
        foreground: settings.colors.foreground,
        "muted-foreground": settings.colors.mutedForeground,
        primary: settings.colors.primary,
        "primary-foreground": settings.colors.primaryForeground,
        hot: settings.colors.accent,
        border: settings.colors.border,
        input: settings.colors.input,
      };
      for (const [name, value] of Object.entries(modeColors)) {
        appearanceVariables[`--theme-${mode}-${name}`] = value;
      }
      appearanceVariables[`--cms-${mode}-gradient-opacity`] =
        `${settings.background.gradientOpacity}%`;
      appearanceVariables[`--cms-${mode}-ambient-intensity`] =
        `${settings.background.ambientIntensity}%`;
      appearanceVariables[`--cms-${mode}-gradient-position`] = {
        top: "4%",
        center: "50%",
        bottom: "96%",
      }[settings.background.gradientPosition];
      appearanceVariables[`--cms-${mode}-glass-surface-opacity`] =
        `${settings.glass.surfaceOpacity}%`;
      appearanceVariables[`--cms-${mode}-glass-blur`] = `${settings.glass.blur}px`;
      appearanceVariables[`--cms-${mode}-glass-border-opacity`] =
        `${settings.glass.borderOpacity}%`;
      appearanceVariables[`--cms-${mode}-shadow-intensity`] = `${settings.glass.shadowIntensity}%`;
      appearanceVariables[`--cms-${mode}-highlight-intensity`] =
        `${settings.glass.highlightIntensity}%`;
    }
    appearanceVariables["--cms-glass-border-width"] = `${appearance.borderWidth}px`;
    appearanceVariables["--cms-card-radius"] = `${appearance.cardRadius}px`;
    appearanceVariables["--cms-button-radius"] = `${appearance.buttonRadius}px`;
  }
  const typography = snapshot.theme.typography;
  if (typography.displayLetterSpacing !== undefined) {
    typographyVariables["--cms-display-letter-spacing"] = `${typography.displayLetterSpacing}em`;
  }
  if (typography.displayLineHeight !== undefined) {
    typographyVariables["--cms-display-line-height"] = `${typography.displayLineHeight}`;
  }
  if (typography.bodyLineHeight !== undefined) {
    typographyVariables["--cms-body-line-height"] = `${typography.bodyLineHeight}`;
  }
  if (typography.baseFontSize !== undefined) {
    typographyVariables["--cms-base-font-size"] = `${typography.baseFontSize}px`;
  }
  if (typography.headingScale !== undefined) {
    typographyVariables["--cms-heading-scale"] = `${typography.headingScale}`;
  }
  if (snapshot.theme.layout.cardGap !== undefined) {
    appearanceVariables["--cms-card-gap"] = `${snapshot.theme.layout.cardGap}px`;
  }
  return {
    ...colors,
    ...appearanceVariables,
    ...typographyVariables,
    "--font-display": `"${snapshot.theme.typography.displayFont}", ui-sans-serif, system-ui, sans-serif`,
    "--font-body": `"${snapshot.theme.typography.bodyFont}", ui-sans-serif, system-ui, sans-serif`,
    "--font-weight-display": `${snapshot.theme.typography.displayWeight}`,
    "--font-weight-body": `${snapshot.theme.typography.bodyWeight}`,
    ...(typography.bodyLetterSpacing === undefined
      ? {}
      : { "--cms-body-letter-spacing": `${typography.bodyLetterSpacing}em` }),
    "--radius": `${snapshot.theme.radius}px`,
    "--cms-content-max-width": `${snapshot.theme.layout.contentMaxWidth}px`,
    "--cms-section-block": `${snapshot.theme.spacing.sectionBlock}px`,
    "--cms-section-block-wide": `${snapshot.theme.spacing.sectionBlock * 1.4}px`,
    "--cms-section-horizontal-padding": `${snapshot.theme.layout.sectionHorizontalPadding ?? 20}px`,
    "--cms-section-horizontal-padding-wide": `${snapshot.theme.layout.sectionHorizontalPaddingWide ?? 40}px`,
  } as CSSProperties;
}

function mediaUrl(
  assetId: string,
  assets: Map<string, MediaAsset>,
  signedUrls: Record<string, string>,
) {
  const signedUrl = signedUrls[assetId];
  if (signedUrl) return signedUrl;
  const asset = assets.get(assetId);
  return asset?.source.kind === "url" ? asset.source.url : undefined;
}

export function toLegacyPortfolioContent(
  snapshot: ContentSnapshot,
  mediaUrls: Record<string, string>,
): LegacyPortfolioContent {
  const assets = new Map(snapshot.media.map((asset) => [asset.id, asset]));
  const categoriesById = new Map(snapshot.categories.map((category) => [category.id, category]));
  const homepage = snapshot.pages.find((page) => page.slug === "/");
  const projectGrid = homepage?.sections.find((section) => section.type === "project-grid");
  const configuredProjectIds =
    projectGrid?.type === "project-grid" ? projectGrid.data.projectIds : [];
  const configuredCategoryIds =
    projectGrid?.type === "project-grid" ? projectGrid.data.categoryIds : [];
  const projectOrder = new Map(configuredProjectIds.map((id, index) => [id, index]));
  const projects = snapshot.projects
    .filter((project) => project.visible)
    .sort(
      (left, right) =>
        (projectOrder.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
          (projectOrder.get(right.id) ?? Number.MAX_SAFE_INTEGER) || left.order - right.order,
    )
    .map((project) => {
      const cover = project.coverMedia
        ? mediaUrl(project.coverMedia.mediaId, assets, mediaUrls)
        : project.cover;
      const heroImage = project.heroMedia
        ? mediaUrl(project.heroMedia.mediaId, assets, mediaUrls)
        : cover;
      const gallery = project.gallery.flatMap((reference) => {
        const src = mediaUrl(reference.mediaId, assets, mediaUrls);
        return src
          ? [
              {
                id: reference.mediaId,
                src,
                alt: reference.alt,
                ...(reference.caption ? { caption: reference.caption } : {}),
              },
            ]
          : [];
      });

      return {
        slug: project.slug,
        title: project.title,
        category: categoriesById.get(project.categoryId)?.name ?? project.category,
        type: project.type,
        description: project.description,
        ...(project.year === undefined ? {} : { year: project.year }),
        ...(project.client === undefined ? {} : { client: project.client }),
        ...(project.role === undefined ? {} : { role: project.role }),
        ...(project.services === undefined ? {} : { services: [...project.services] }),
        ...(project.heroTitle === undefined ? {} : { heroTitle: project.heroTitle }),
        ...(project.seoTitle === undefined ? {} : { seoTitle: project.seoTitle }),
        ...(project.seoDescription === undefined ? {} : { seoDescription: project.seoDescription }),
        ...(project.ctaHeading === undefined ? {} : { ctaHeading: project.ctaHeading }),
        ...(project.ctaBody === undefined ? {} : { ctaBody: project.ctaBody }),
        ...(project.ctaLabel === undefined ? {} : { ctaLabel: project.ctaLabel }),
        ...(project.ctaHref === undefined ? {} : { ctaHref: project.ctaHref }),
        ...(project.showClient === undefined ? {} : { showClient: project.showClient }),
        ...(project.showYear === undefined ? {} : { showYear: project.showYear }),
        ...(project.showRole === undefined ? {} : { showRole: project.showRole }),
        ...(project.showServices === undefined ? {} : { showServices: project.showServices }),
        tone: project.tone,
        ...(cover ? { cover } : {}),
        ...(heroImage ? { heroImage } : {}),
        ...(project.galleryLayout ? { galleryLayout: project.galleryLayout } : {}),
        placeholder: project.placeholder,
        ...(project.behance ? { behance: project.behance } : {}),
        sections: [...project.sections]
          .sort((left, right) => left.order - right.order)
          .map(({ id, title, body, visual, visible, galleryLayout }) => ({
            ...(id ? { id } : {}),
            title,
            body,
            ...(visual ? { visual } : {}),
            ...(visible === undefined ? {} : { visible }),
            ...(galleryLayout ? { galleryLayout } : {}),
          })),
        ...(project.palette ? { palette: [...project.palette] } : {}),
        ...(gallery.length ? { gallery } : {}),
      };
    });
  const visibleProjectIds = new Set(
    snapshot.projects.filter((project) => project.visible).map(({ id }) => id),
  );
  const highlightSection = homepage?.sections.find(
    (section) => section.type === "project-highlights",
  );
  const featuredProjectIds =
    highlightSection?.type === "project-highlights"
      ? highlightSection.data.projectIds
      : snapshot.featuredProjectIds;
  const serviceSection = homepage?.sections.find((section) => section.type === "services");
  const experienceSection = homepage?.sections.find((section) => section.type === "experience");
  const processSection = homepage?.sections.find((section) => section.type === "process");
  const faqSection = homepage?.sections.find((section) => section.type === "faqs");
  const orderedVisible = <T extends { id: string; order: number; visible: boolean }>(
    records: T[],
    ids: string[],
  ) => {
    const order = new Map(ids.map((id, index) => [id, index]));
    return records
      .filter((record) => record.visible && (!ids.length || order.has(record.id)))
      .sort(
        (left, right) =>
          (order.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
            (order.get(right.id) ?? Number.MAX_SAFE_INTEGER) || left.order - right.order,
      );
  };
  const serviceIds = serviceSection?.type === "services" ? serviceSection.data.serviceIds : [];
  const experienceIds =
    experienceSection?.type === "experience" ? experienceSection.data.experienceIds : [];
  const processStepIds =
    processSection?.type === "process" ? processSection.data.processStepIds : [];
  const faqIds = faqSection?.type === "faqs" ? faqSection.data.faqIds : [];
  const categoryIds = new Set(configuredCategoryIds);
  const availableCategories = [...snapshot.categories]
    .filter((category) => !categoryIds.size || categoryIds.has(category.id))
    .sort((left, right) => left.order - right.order);
  const featuredSlugs = snapshot.projects
    .filter(
      (project) => visibleProjectIds.has(project.id) && featuredProjectIds.includes(project.id),
    )
    .sort((left, right) => left.order - right.order)
    .map(({ slug }) => slug);
  const sectionAnchors = new Map(
    snapshot.pages.flatMap((page) =>
      page.sections.map((section) => [
        section.id,
        section.type === "project-grid"
          ? "work"
          : section.type === "profile"
            ? "about"
            : section.type,
      ]),
    ),
  );
  const navigation = snapshot.navigation
    .filter((item) => item.visible)
    .sort((left, right) => left.order - right.order)
    .flatMap((item) => {
      if (item.target.kind === "section") {
        const href = sectionAnchors.get(item.target.sectionId);
        return href ? [{ href, label: item.label }] : [];
      }
      if (item.target.kind === "external") {
        return [{ href: item.target.url, label: item.label }];
      }
      return [{ href: item.target.path, label: item.label }];
    });
  const socialLinks = snapshot.contact.socialLinks;

  return {
    site: {
      ...snapshot.identity,
      email: snapshot.contact.publicEmail,
      whatsapp: snapshot.contact.whatsapp,
      behance: socialLinks["behance"] ?? snapshot.identity.behance,
      linkedin: socialLinks["linkedin"] ?? snapshot.identity.linkedin,
    },
    categories: ["All Projects", ...availableCategories.map(({ name }) => name)],
    featuredSlugs,
    projects,
    services: orderedVisible(snapshot.services, serviceIds).map((service) => {
      const image = service.image ? mediaUrl(service.image.mediaId, assets, mediaUrls) : undefined;
      return {
        n: service.n,
        title: service.title,
        body: service.body,
        items: service.items,
        ...(service.badge === undefined ? {} : { badge: service.badge }),
        ...(image
          ? {
              image,
              imageAlt: service.image?.alt ?? "",
              imageFit: service.imageFit ?? "cover",
              ...(service.image?.focalPoint ? { imagePosition: service.image.focalPoint } : {}),
            }
          : {}),
      };
    }),
    experience: orderedVisible(snapshot.experience, experienceIds).map(
      ({ company, role, type, location, body, ...experience }) => ({
        dates: formatExperienceDateRange(experience),
        company,
        role,
        type,
        location,
        body,
        ...(experience.startDate ? { startDate: experience.startDate } : {}),
        ...(experience.endDate ? { endDate: experience.endDate } : {}),
        ...(experience.isCurrent === undefined ? {} : { isCurrent: experience.isCurrent }),
      }),
    ),
    process: orderedVisible(snapshot.process, processStepIds).map(({ n, title, body }) => ({
      n,
      title,
      body,
    })),
    processOutcomes: orderedVisible(snapshot.process, processStepIds).map((item) =>
      item.outcomes.filter(Boolean).join(" · "),
    ),
    faqs: orderedVisible(snapshot.faqs, faqIds).map(({ q, a }) => ({ q, a })),
    navigation,
  };
}

export async function loadPublicPortfolio(): Promise<PublicPortfolio> {
  try {
    const published = await getPublishedCmsServerFn();
    if (published) {
      const snapshot = contentSnapshotSchema.parse(published.snapshot);
      return {
        content: toLegacyPortfolioContent(snapshot, published.mediaUrls),
        snapshot,
        mediaUrls: published.mediaUrls,
      };
    }
  } catch (error) {
    console.error(
      "Unable to load a valid published CMS snapshot; serving the static portfolio instead.",
      error,
    );
  }

  const snapshot = await portfolioRepository.getPublishedSnapshot();
  if (!snapshot) throw new Error("The static portfolio fallback is unavailable.");
  return { content: portfolioRepository.getPublishedContent(), snapshot, mediaUrls: {} };
}
