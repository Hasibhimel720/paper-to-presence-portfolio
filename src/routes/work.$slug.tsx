import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, ArrowUpRight } from "lucide-react";
import { SiteNav, SiteFooter } from "@/components/site/Chrome";
import { ProjectVisual } from "@/components/site/ProjectVisual";
import { Reveal } from "@/components/site/Reveal";
import { projects } from "@/data/portfolio";

export const Route = createFileRoute("/work/$slug")({
  loader: ({ params }) => {
    const i = projects.findIndex((p) => p.slug === params.slug);
    if (i < 0) throw notFound();
    return {
      project: projects[i],
      prev: projects[(i - 1 + projects.length) % projects.length],
      next: projects[(i + 1) % projects.length],
    };
  },
  head: ({ loaderData }) => {
    const p = loaderData?.project;
    const title = p ? `${p.title} — ${p.type} | Hasib Himel` : "Project unavailable | Hasib Himel";
    const desc = p?.description ?? "Project case study by Hasib Himel.";
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary_large_image" },
        ...(p ? [] : [{ name: "robots", content: "noindex" }]),
      ],
    };
  },
  notFoundComponent: () => (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="display-lg">Project not found</h1>
      <Link to="/" hash="work" className="underline">Back to work</Link>
    </div>
  ),
  component: CaseStudy,
});

function CaseStudy() {
  const { project: p, prev, next } = Route.useLoaderData();
  return (
    <div className="overflow-x-clip">
      <SiteNav />
      <main className="pt-28 md:pt-36">
        <section className="container-x">
          <Link to="/" hash="work" className="eyebrow inline-flex items-center gap-2 hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> All work
          </Link>
          <div className="mt-10 grid gap-8 md:grid-cols-12 md:items-end">
            <h1 className="display-xl md:col-span-8 !text-[clamp(2.75rem,8vw,7.5rem)]">{p.title}</h1>
            <dl className="md:col-span-4 grid grid-cols-2 gap-6 text-sm">
              <div><dt className="eyebrow">Discipline</dt><dd className="mt-2">{p.type}</dd></div>
              <div><dt className="eyebrow">Category</dt><dd className="mt-2">{p.category}</dd></div>
              <div><dt className="eyebrow">Client</dt><dd className="mt-2 text-muted-foreground">[If approved]</dd></div>
              <div><dt className="eyebrow">Year</dt><dd className="mt-2 text-muted-foreground">{p.year ?? "[Verify]"}</dd></div>
            </dl>
          </div>
          <p className="mt-10 max-w-2xl text-xl text-muted-foreground">{p.description}</p>
        </section>

        <Reveal className="container-x mt-14">
          <ProjectVisual project={p} className="aspect-[4/3] md:aspect-[16/8]" />
        </Reveal>

        <div className="container-x mt-24 md:mt-36 space-y-24 md:space-y-36">
          {p.sections.map((s, i) => (
            <Reveal key={s.title}>
              <section className="grid gap-8 md:grid-cols-12">
                <div className="md:col-span-4">
                  <p className="eyebrow"><span className="text-primary">0{i + 1}</span> — {s.title}</p>
                </div>
                <div className="md:col-span-8">
                  <p className="text-xl md:text-2xl leading-snug text-muted-foreground">{s.body}</p>
                  {s.visual && <ProjectVisual project={p} label={s.visual} className="mt-10 aspect-[4/3] md:aspect-[16/10]" />}
                </div>
              </section>
            </Reveal>
          ))}

          {p.palette && (
            <Reveal>
              <section className="grid gap-8 md:grid-cols-12">
                <p className="eyebrow md:col-span-4">Color system <span className="normal-case tracking-normal">[replace with brand values]</span></p>
                <div className="md:col-span-8 grid grid-cols-3 gap-3">
                  {p.palette.map((c) => (
                    <div key={c} className="aspect-[3/4] border border-border" style={{ background: c }} />
                  ))}
                </div>
              </section>
            </Reveal>
          )}
        </div>

        <section className="container-x mt-32 border-t border-border py-20 text-center">
          <p className="eyebrow">Have a similar project?</p>
          <h2 className="display-lg mt-6">Let's talk about your brand.</h2>
          <Link to="/" hash="contact" className="mt-10 inline-flex items-center gap-3 bg-foreground px-7 py-4 text-sm font-medium text-background hover:bg-primary hover:text-primary-foreground">
            Discuss a project <ArrowUpRight className="h-4 w-4" />
          </Link>
        </section>

        <nav aria-label="Project navigation" className="grid border-t border-border md:grid-cols-2">
          <Link to="/work/$slug" params={{ slug: prev.slug }} className="group container-x !mx-0 py-10 md:border-r border-border border-b md:border-b-0 hover:bg-surface">
            <span className="eyebrow inline-flex items-center gap-2"><ArrowLeft className="h-3.5 w-3.5" /> Previous</span>
            <p className="mt-3 font-display text-2xl md:text-4xl group-hover:text-primary">{prev.title}</p>
          </Link>
          <Link to="/work/$slug" params={{ slug: next.slug }} className="group container-x !mx-0 py-10 text-right hover:bg-surface">
            <span className="eyebrow inline-flex items-center gap-2">Next <ArrowRight className="h-3.5 w-3.5" /></span>
            <p className="mt-3 font-display text-2xl md:text-4xl group-hover:text-primary">{next.title}</p>
          </Link>
        </nav>
      </main>
      <SiteFooter />
    </div>
  );
}
