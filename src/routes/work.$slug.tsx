import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, ArrowUpRight } from "lucide-react";
import { useState } from "react";
import { SiteNav, SiteFooter } from "@/components/site/Chrome";
import { ProjectVisual } from "@/components/site/ProjectVisual";
import { Reveal } from "@/components/site/Reveal";
import { getPublicThemeStyle, loadPublicPortfolio } from "@/lib/cms/public-content";
import type { ContentSnapshot, Project } from "@/lib/cms/schema";

export const Route = createFileRoute("/work/$slug")({
  loader: async ({ params }) => {
    const portfolio = await loadPublicPortfolio();
    const projects = portfolio.content.projects;
    const index = projects.findIndex((project) => project.slug === params.slug);
    if (index < 0) throw notFound();
    const project = projects[index];
    const prev = projects[(index - 1 + projects.length) % projects.length];
    const next = projects[(index + 1) % projects.length];
    if (!project || !prev || !next) throw notFound();
    return { project, prev, next, snapshot: portfolio.snapshot, mediaUrls: portfolio.mediaUrls };
  },
  head: ({ loaderData }) => {
    const p = loaderData?.project;
    const title = p
      ? p.seoTitle || `${p.title} — ${p.type} | Hasib Himel`
      : "Project unavailable | Hasib Himel";
    const desc = p?.seoDescription || p?.description || "Project case study by Hasib Himel.";
    const image = p?.cover;
    const seo = loaderData?.snapshot.seo;
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: seo?.social.twitterCard ?? "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: desc },
        ...(image ? [{ property: "og:image", content: image }] : []),
        ...(image ? [{ name: "twitter:image", content: image }] : []),
        ...(p ? [] : [{ name: "robots", content: "noindex" }]),
      ],
    };
  },
  notFoundComponent: () => (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="display-lg">Project not found</h1>
      <Link to="/" hash="work" className="underline">
        Back to work
      </Link>
    </div>
  ),
  component: CaseStudy,
});

function CaseStudy() {
  const { project: p, prev, next, snapshot, mediaUrls } = Route.useLoaderData();
  return (
    <CaseStudyPage project={p} prev={prev} next={next} snapshot={snapshot} mediaUrls={mediaUrls} />
  );
}

type CaseStudyImage = { id: string; src: string; alt: string; caption?: string };
type ImageLayout = NonNullable<Project["galleryLayout"]>;

function ProjectImageGallery({
  images,
  layout = "masonry",
  label,
}: {
  images: CaseStudyImage[];
  layout?: ImageLayout;
  label: string;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  if (images.length === 0) return null;
  const selectedImages =
    layout === "single"
      ? images.slice(0, 1)
      : layout === "carousel"
        ? [images[activeIndex]!]
        : images;
  const layoutClass =
    layout === "masonry"
      ? "columns-1 sm:columns-2"
      : layout === "two-column"
        ? "grid grid-cols-1 sm:grid-cols-2"
        : layout === "three-column"
          ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
          : "grid grid-cols-1";

  return (
    <div className="space-y-4">
      {layout === "carousel" && images.length > 1 && (
        <div className="flex items-center justify-between gap-3">
          <p className="eyebrow" aria-live="polite">
            Image {activeIndex + 1} of {images.length}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              aria-label={`Previous ${label} image`}
              onClick={() => setActiveIndex((index) => (index - 1 + images.length) % images.length)}
              className="glass-button rounded-full border border-border p-2 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label={`Next ${label} image`}
              onClick={() => setActiveIndex((index) => (index + 1) % images.length)}
              className="glass-button rounded-full border border-border p-2 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
      <div className={`${layoutClass} gap-4`}>
        {selectedImages.map((image, index) => (
          <figure
            key={image.id}
            className={`mb-4 overflow-hidden rounded-xl border border-border bg-surface ${layout === "masonry" ? "break-inside-avoid" : ""}`}
          >
            <img
              src={image.src}
              alt={image.alt}
              loading={index === 0 && label === "Project hero" ? "eager" : "lazy"}
              className="block h-auto w-full"
            />
            {image.caption && (
              <figcaption className="px-4 py-3 text-xs text-muted-foreground">
                {image.caption}
              </figcaption>
            )}
          </figure>
        ))}
      </div>
    </div>
  );
}

export function CaseStudyPage({
  project: p,
  prev,
  next,
  snapshot,
  mediaUrls = {},
}: {
  project: Project;
  prev: Project;
  next: Project;
  snapshot?: ContentSnapshot | undefined;
  mediaUrls?: Record<string, string> | undefined;
}) {
  const cmsProject = snapshot?.projects.find((project) => project.slug === p.slug);
  const cmsSections = new Map(cmsProject?.sections.map((section) => [section.id, section]) ?? []);
  const mediaAssets = new Map(snapshot?.media.map((asset) => [asset.id, asset]) ?? []);
  const resolveMedia = (reference: {
    mediaId: string;
    alt: string;
    caption?: string | undefined;
  }) => {
    const asset = mediaAssets.get(reference.mediaId);
    const src =
      mediaUrls[reference.mediaId] ?? (asset?.source.kind === "url" ? asset.source.url : "");
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
  };
  const projectGallery = (p.gallery ?? []).map(({ id, src, alt, caption }) => ({
    id,
    src,
    alt,
    ...(caption ? { caption } : {}),
  }));
  const heroImage = p.heroImage ?? p.cover;
  const orderedSections = p.sections.filter((section) => section.visible !== false);
  return (
    <div
      className={
        snapshot?.origin === "cms"
          ? "overflow-x-clip portfolio-public portfolio-theme"
          : "overflow-x-clip portfolio-theme"
      }
      style={getPublicThemeStyle(snapshot)}
    >
      <SiteNav snapshot={snapshot} mediaUrls={mediaUrls} />
      <main className="pt-28 md:pt-36">
        <section className="container-x">
          <Link
            to="/"
            hash="work"
            className="eyebrow inline-flex items-center gap-2 hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> All work
          </Link>
          <div className="mt-10 grid gap-10 md:grid-cols-12 md:items-end">
            <div className="md:col-span-8">
              <p className="eyebrow text-primary">{p.category}</p>
              <h1 className="display-xl mt-4 !text-[clamp(2.75rem,8vw,7.5rem)]">
                {p.heroTitle || p.title}
              </h1>
              <p className="mt-7 max-w-2xl text-lg leading-relaxed text-muted-foreground md:text-xl">
                {p.description}
              </p>
            </div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-5 border-t border-border pt-5 text-sm md:col-span-4 md:border-t-0 md:pt-0">
              <div>
                <dt className="eyebrow">Discipline</dt>
                <dd className="mt-2">{p.type}</dd>
              </div>
              {p.client && p.showClient !== false && (
                <div>
                  <dt className="eyebrow">Client</dt>
                  <dd className="mt-2 text-muted-foreground">{p.client}</dd>
                </div>
              )}
              {p.year && p.showYear !== false && (
                <div>
                  <dt className="eyebrow">Year</dt>
                  <dd className="mt-2 text-muted-foreground">{p.year}</dd>
                </div>
              )}
              {p.role && p.showRole !== false && (
                <div>
                  <dt className="eyebrow">Role</dt>
                  <dd className="mt-2 text-muted-foreground">{p.role}</dd>
                </div>
              )}
              {p.services?.length && p.showServices !== false && (
                <div className="col-span-2">
                  <dt className="eyebrow">Services</dt>
                  <dd className="mt-2 text-muted-foreground">{p.services.join(" · ")}</dd>
                </div>
              )}
            </dl>
          </div>
        </section>

        {heroImage && (
          <Reveal className="container-x mt-14">
            <ProjectImageGallery
              images={[
                {
                  id: `${p.slug}-hero`,
                  src: heroImage,
                  alt:
                    cmsProject?.heroMedia?.alt ??
                    cmsProject?.coverMedia?.alt ??
                    `${p.title} hero image`,
                },
              ]}
              layout="full-width"
              label="Project hero"
            />
          </Reveal>
        )}

        {projectGallery.length > 0 && (
          <section aria-label={`${p.title} project gallery`} className="container-x mt-12">
            <ProjectImageGallery
              images={projectGallery}
              layout={p.galleryLayout ?? "masonry"}
              label={`${p.title} project`}
            />
          </section>
        )}

        <div className="container-x mt-24 md:mt-36 space-y-24 md:space-y-36">
          {orderedSections.map((s, i) => {
            const cmsSection = cmsSections.get(s.id ?? "");
            const sectionImages = cmsSection?.media.flatMap(resolveMedia) ?? [];
            return (
              <Reveal key={s.id ?? `${s.title}-${i}`}>
                <section className="grid gap-8 md:grid-cols-12">
                  <div className="md:col-span-4">
                    <p className="eyebrow">
                      <span className="text-primary">0{i + 1}</span> — {s.title}
                    </p>
                  </div>
                  <div className="md:col-span-8">
                    {s.body && (
                      <p className="text-xl leading-snug text-muted-foreground md:text-2xl">
                        {s.body}
                      </p>
                    )}
                    {s.visual && (
                      <ProjectVisual project={p} label={s.visual} className="mt-10 aspect-[4/3]" />
                    )}
                    {sectionImages.length > 0 && (
                      <div className="mt-10">
                        <ProjectImageGallery
                          images={sectionImages}
                          layout={s.galleryLayout ?? "stacked"}
                          label={`${s.title} section`}
                        />
                      </div>
                    )}
                  </div>
                </section>
              </Reveal>
            );
          })}

          {p.palette && p.palette.length > 0 && (
            <Reveal>
              <section className="grid gap-8 md:grid-cols-12">
                <p className="eyebrow md:col-span-4">
                  Color system{" "}
                  <span className="normal-case tracking-normal">[replace with brand values]</span>
                </p>
                <div className="md:col-span-8 grid grid-cols-3 gap-3">
                  {p.palette.map((c) => (
                    <div
                      key={c}
                      className="aspect-[3/4] border border-border"
                      style={{ background: c }}
                    />
                  ))}
                </div>
              </section>
            </Reveal>
          )}
        </div>

        <section className="container-x mt-32 border-t border-border py-20 text-center">
          <p className="eyebrow">{p.ctaBody || "Have a similar project?"}</p>
          <h2 className="display-lg mt-6">{p.ctaHeading || "Let's talk about your brand."}</h2>
          <a
            href={p.ctaHref || "/#contact"}
            className="mt-10 inline-flex items-center gap-3 bg-foreground px-7 py-4 text-sm font-medium text-background transition-colors hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-4 focus-visible:ring-offset-background"
          >
            {p.ctaLabel || "Discuss a project"} <ArrowUpRight className="h-4 w-4" />
          </a>
        </section>

        <nav aria-label="Project navigation" className="grid border-t border-border md:grid-cols-2">
          <Link
            to="/work/$slug"
            params={{ slug: prev.slug }}
            className="group container-x !mx-0 py-10 md:border-r border-border border-b md:border-b-0 hover:bg-surface"
          >
            <span className="eyebrow inline-flex items-center gap-2">
              <ArrowLeft className="h-3.5 w-3.5" /> Previous
            </span>
            <p className="mt-3 font-display text-2xl md:text-4xl group-hover:text-primary">
              {prev.title}
            </p>
          </Link>
          <Link
            to="/work/$slug"
            params={{ slug: next.slug }}
            className="group container-x !mx-0 py-10 text-right hover:bg-surface"
          >
            <span className="eyebrow inline-flex items-center gap-2">
              Next <ArrowRight className="h-3.5 w-3.5" />
            </span>
            <p className="mt-3 font-display text-2xl md:text-4xl group-hover:text-primary">
              {next.title}
            </p>
          </Link>
        </nav>
      </main>
      <SiteFooter snapshot={snapshot} />
    </div>
  );
}
