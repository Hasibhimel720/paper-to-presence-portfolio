import { getPublishedCmsServerFn } from "@/lib/cms/server-functions";
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
  return {
    ...colors,
    "--font-display": `"${snapshot.theme.typography.displayFont}", ui-sans-serif, system-ui, sans-serif`,
    "--font-body": `"${snapshot.theme.typography.bodyFont}", ui-sans-serif, system-ui, sans-serif`,
    "--font-weight-display": `${snapshot.theme.typography.displayWeight}`,
    "--font-weight-body": `${snapshot.theme.typography.bodyWeight}`,
    "--radius": `${snapshot.theme.radius}px`,
    "--cms-content-max-width": `${snapshot.theme.layout.contentMaxWidth}px`,
    "--cms-section-block": `${snapshot.theme.spacing.sectionBlock}px`,
    "--cms-section-block-wide": `${snapshot.theme.spacing.sectionBlock * 1.4}px`,
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
      const gallery = project.gallery.flatMap((reference) => {
        const src = mediaUrl(reference.mediaId, assets, mediaUrls);
        return src ? [{ id: reference.mediaId, src, alt: reference.alt }] : [];
      });

      return {
        slug: project.slug,
        title: project.title,
        category: categoriesById.get(project.categoryId)?.name ?? project.category,
        type: project.type,
        description: project.description,
        ...(project.year === undefined ? {} : { year: project.year }),
        tone: project.tone,
        ...(cover ? { cover } : {}),
        placeholder: project.placeholder,
        ...(project.behance ? { behance: project.behance } : {}),
        sections: [...project.sections]
          .sort((left, right) => left.order - right.order)
          .map(({ title, body, visual }) => ({
            title,
            body,
            ...(visual ? { visual } : {}),
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
    services: orderedVisible(snapshot.services, serviceIds).map(({ n, title, body, items }) => ({
      n,
      title,
      body,
      items,
    })),
    experience: orderedVisible(snapshot.experience, experienceIds).map(
      ({ company, role, type, location, dates, body }) => ({
        company,
        role,
        type,
        location,
        dates,
        body,
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
