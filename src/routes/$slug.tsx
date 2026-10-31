import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { ContactForm } from "@/components/site/ContactForm";
import { SiteFooter, SiteNav } from "@/components/site/Chrome";
import { ProjectVisual } from "@/components/site/ProjectVisual";
import { getPublicThemeStyle, loadPublicPortfolio } from "@/lib/cms/public-content";
import type { ContentSnapshot, PageSection, Project } from "@/lib/cms/schema";

export const Route = createFileRoute("/$slug")({
  loader: async ({ params }) => {
    const portfolio = await loadPublicPortfolio();
    const page = portfolio.snapshot.pages.find(
      (item) => item.slug === `/${params.slug}` || item.slug === params.slug,
    );
    if (!page || page.slug === "/") throw notFound();
    return { ...portfolio, page };
  },
  head: ({ loaderData }) => {
    const page = loaderData?.page;
    const seo = page?.seo;
    const openGraphImageId = seo?.social.openGraphImage?.mediaId;
    const twitterImageId = seo?.social.twitterImage?.mediaId ?? openGraphImageId;
    const image = openGraphImageId ? loaderData?.mediaUrls[openGraphImageId] : undefined;
    const twitterImage = twitterImageId ? loaderData?.mediaUrls[twitterImageId] : undefined;
    return {
      meta: [
        { title: seo?.title ?? page?.title ?? "Page | Hasib Himel" },
        { name: "description", content: seo?.description ?? "" },
        {
          name: "robots",
          content: `${seo?.robots.index ? "index" : "noindex"},${seo?.robots.follow ? "follow" : "nofollow"}`,
        },
        { property: "og:title", content: seo?.social.openGraphTitle ?? seo?.title ?? "" },
        {
          property: "og:description",
          content: seo?.social.openGraphDescription ?? seo?.description ?? "",
        },
        { name: "twitter:card", content: seo?.social.twitterCard ?? "summary_large_image" },
        { name: "twitter:title", content: seo?.social.twitterTitle ?? seo?.title ?? "" },
        {
          name: "twitter:description",
          content: seo?.social.twitterDescription ?? seo?.description ?? "",
        },
        ...(image ? [{ property: "og:image", content: image }] : []),
        ...(twitterImage ? [{ name: "twitter:image", content: twitterImage }] : []),
      ],
      links: seo?.canonicalPath ? [{ rel: "canonical", href: seo.canonicalPath }] : [],
    };
  },
  notFoundComponent: () => (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="display-lg">Page not found</h1>
      <Link to="/" className="underline">
        Back to home
      </Link>
    </div>
  ),
  component: PublishedPage,
});

function PublishedPage() {
  const { page, snapshot, mediaUrls } = Route.useLoaderData();
  return (
    <div
      className={snapshot.origin === "cms" ? "overflow-x-clip portfolio-public" : "overflow-x-clip"}
      style={getPublicThemeStyle(snapshot)}
    >
      <SiteNav snapshot={snapshot} />
      <main className="container-x min-h-screen pt-36 pb-24">
        {page.sections
          .filter((section) => section.visible)
          .sort((left, right) => left.order - right.order)
          .map((section) => (
            <PublishedSection
              key={section.id}
              section={section}
              snapshot={snapshot}
              mediaUrls={mediaUrls}
            />
          ))}
      </main>
      <SiteFooter snapshot={snapshot} />
    </div>
  );
}

function PublishedSection({
  section,
  snapshot,
  mediaUrls,
}: {
  section: PageSection;
  snapshot: ContentSnapshot;
  mediaUrls: Record<string, string>;
}) {
  const media = new Map(snapshot.media.map((asset) => [asset.id, asset]));
  const projectsById = new Map(snapshot.projects.map((project) => [project.id, project]));
  const servicesById = new Map(snapshot.services.map((service) => [service.id, service]));
  const experienceById = new Map(snapshot.experience.map((entry) => [entry.id, entry]));
  const processById = new Map(snapshot.process.map((step) => [step.id, step]));
  const faqsById = new Map(snapshot.faqs.map((faq) => [faq.id, faq]));
  const toProject = (project: (typeof snapshot.projects)[number]): Project => {
    const cover = (project.coverMedia && mediaUrls[project.coverMedia.mediaId]) || project.cover;
    const gallery = project.gallery.flatMap((reference) => {
      const asset = media.get(reference.mediaId);
      const src =
        mediaUrls[reference.mediaId] ??
        (asset?.source.kind === "url" ? asset.source.url : undefined);
      return src ? [{ id: reference.mediaId, src, alt: reference.alt }] : [];
    });
    const category =
      snapshot.categories.find((entry) => entry.id === project.categoryId)?.name ??
      project.category;
    return {
      slug: project.slug,
      title: project.title,
      category,
      type: project.type,
      description: project.description,
      ...(project.year ? { year: project.year } : {}),
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
      ...(project.palette ? { palette: project.palette } : {}),
      ...(gallery.length ? { gallery } : {}),
    };
  };
  const identity = snapshot.identity;

  switch (section.type) {
    case "hero":
      return (
        <section className="py-16 text-center">
          <p className="eyebrow">{section.data.eyebrow}</p>
          <h1 className="display-xl mx-auto mt-5 max-w-4xl">{section.data.title}</h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            {section.data.body}
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <a
              className="btn-glow"
              href={
                section.data.primaryCta.target.kind === "external"
                  ? section.data.primaryCta.target.url
                  : section.data.primaryCta.target.kind === "page"
                    ? section.data.primaryCta.target.path
                    : "#contact"
              }
            >
              {section.data.primaryCta.label} <ArrowUpRight className="h-4 w-4" />
            </a>
            {section.data.secondaryCta && (
              <a
                className="btn-ghost-pill"
                href={
                  section.data.secondaryCta.target.kind === "external"
                    ? section.data.secondaryCta.target.url
                    : section.data.secondaryCta.target.kind === "page"
                      ? section.data.secondaryCta.target.path
                      : "#contact"
                }
              >
                {section.data.secondaryCta.label}
              </a>
            )}
          </div>
        </section>
      );
    case "project-highlights":
    case "project-grid": {
      const selectedIds = section.data.projectIds;
      const projects = selectedIds.flatMap((id) => {
        const project = projectsById.get(id);
        return project?.visible ? [toProject(project)] : [];
      });
      return (
        <section id="work" className="py-12">
          <SectionHeading
            eyebrow={section.type === "project-grid" ? section.data.eyebrow : section.data.label}
            title={section.type === "project-grid" ? section.data.title : "Selected projects"}
            body={section.type === "project-grid" ? section.data.intro : ""}
          />
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <Link
                key={project.slug}
                to="/work/$slug"
                params={{ slug: project.slug }}
                className="glow-card group overflow-hidden p-3"
              >
                <ProjectVisual project={project} className="aspect-[4/3] rounded-xl" zoom />
                <h3 className="mt-4 font-display text-xl font-semibold">{project.title}</h3>
                <p className="eyebrow mt-2">
                  {project.type} · {project.category}
                </p>
              </Link>
            ))}
          </div>
        </section>
      );
    }
    case "services":
      return (
        <section id="services" className="py-12">
          <SectionHeading
            eyebrow={section.data.eyebrow}
            title={section.data.title}
            body={section.data.intro}
          />
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {section.data.serviceIds.flatMap((id) => {
              const service = servicesById.get(id);
              return service?.visible ? (
                <article key={id} className="glow-card p-6">
                  <p className="eyebrow">{service.n}</p>
                  <h2 className="mt-3 font-display text-2xl font-semibold">{service.title}</h2>
                  <p className="mt-3 text-muted-foreground">{service.body}</p>
                  <ul className="mt-4 flex flex-wrap gap-2">
                    {service.items.map((item) => (
                      <li className="chip" key={item}>
                        {item}
                      </li>
                    ))}
                  </ul>
                </article>
              ) : (
                []
              );
            })}
          </div>
        </section>
      );
    case "profile": {
      const portraitId = snapshot.profile.portrait?.mediaId;
      const portrait = portraitId ? mediaUrls[portraitId] : undefined;
      return (
        <section id="about" className="py-12">
          <SectionHeading eyebrow={section.data.eyebrow} title={section.data.title} />
          <div className="mt-8 grid gap-8 md:grid-cols-[minmax(0,1fr)_2fr]">
            {portrait && (
              <img
                src={portrait}
                alt={snapshot.profile.portrait?.alt ?? identity.fullName}
                className="w-full rounded-xl object-cover"
                loading="lazy"
              />
            )}
            <div className="space-y-4 text-muted-foreground">
              <p className="font-display text-2xl text-foreground">
                {snapshot.profile.fullName} · {snapshot.profile.role}
              </p>
              {snapshot.profile.biography.map((paragraph, index) => (
                <p key={`${index}-${paragraph}`}>{paragraph}</p>
              ))}
              <p>
                {snapshot.profile.focus} · {snapshot.profile.location}
              </p>
            </div>
          </div>
        </section>
      );
    }
    case "experience":
      return (
        <section id="experience" className="py-12">
          <SectionHeading
            eyebrow={section.data.eyebrow}
            title={section.data.title}
            body={section.data.intro}
          />
          <div className="mt-8 space-y-4">
            {section.data.experienceIds.flatMap((id) => {
              const entry = experienceById.get(id);
              return entry?.visible ? (
                <article key={id} className="glow-card p-6">
                  <p className="eyebrow">
                    {entry.company} · {entry.dates}
                  </p>
                  <h2 className="mt-2 font-display text-xl font-semibold">{entry.role}</h2>
                  <p className="mt-3 text-muted-foreground">{entry.body}</p>
                </article>
              ) : (
                []
              );
            })}
          </div>
        </section>
      );
    case "process":
      return (
        <section id="process" className="py-12">
          <SectionHeading
            eyebrow={section.data.eyebrow}
            title={section.data.title}
            body={section.data.intro}
          />
          <ol className="mx-auto mt-8 max-w-2xl space-y-4">
            {section.data.processStepIds.flatMap((id) => {
              const step = processById.get(id);
              return step?.visible ? (
                <li key={id} className="glow-card p-6">
                  <p className="eyebrow">Step {step.n}</p>
                  <h2 className="mt-2 font-display text-xl font-semibold">{step.title}</h2>
                  <p className="mt-3 text-muted-foreground">{step.body}</p>
                  {step.outcomes.length > 0 && (
                    <p className="mt-3 text-sm text-primary">{step.outcomes.join(" · ")}</p>
                  )}
                </li>
              ) : (
                []
              );
            })}
          </ol>
        </section>
      );
    case "faqs":
      return (
        <section id="faqs" className="py-12">
          <SectionHeading
            eyebrow={section.data.eyebrow}
            title={section.data.title}
            body={section.data.intro}
          />
          <div className="mx-auto mt-8 max-w-3xl space-y-3">
            {section.data.faqIds.flatMap((id) => {
              const faq = faqsById.get(id);
              return faq?.visible ? (
                <details key={id} className="glow-card p-5">
                  <summary className="cursor-pointer font-semibold">{faq.q}</summary>
                  <p className="mt-3 text-muted-foreground">{faq.a}</p>
                </details>
              ) : (
                []
              );
            })}
          </div>
        </section>
      );
    case "contact":
      return (
        <section id="contact" className="mx-auto max-w-3xl py-12">
          <SectionHeading
            eyebrow={section.data.eyebrow}
            title={section.data.title}
            body={section.data.intro}
          />
          {snapshot.contact.form.enabled ? (
            <div className="glow-card mt-8 p-6 md:p-10">
              <ContactForm site={identity} settings={snapshot.contact} />
            </div>
          ) : (
            <p className="mt-8 text-center text-muted-foreground">
              {snapshot.contact.publicEmail || "Contact is unavailable."}
            </p>
          )}
        </section>
      );
  }
}

function SectionHeading({
  eyebrow,
  title,
  body,
}: {
  eyebrow: string;
  title: string;
  body?: string;
}) {
  return (
    <header className="max-w-3xl">
      <p className="eyebrow">{eyebrow}</p>
      <h2 className="display-lg mt-4">{title}</h2>
      {body && <p className="mt-4 text-muted-foreground">{body}</p>}
    </header>
  );
}
