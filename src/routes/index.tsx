import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowUpRight, ArrowDown, Plus } from "lucide-react";
import { SiteNav, SiteFooter } from "@/components/site/Chrome";
import { ProjectVisual } from "@/components/site/ProjectVisual";
import { Reveal } from "@/components/site/Reveal";
import { ContactForm } from "@/components/site/ContactForm";
import { categories, experience, faqs, featuredSlugs, process, projects, services, site, type Project } from "@/data/portfolio";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Hasib Himel — Brand Identity & Product Designer" },
      { name: "description", content: "Portfolio of Hasib Himel, a Bangladesh-based brand identity and product designer creating visual identities, packaging and product advertising." },
      { property: "og:title", content: "Hasib Himel — Brand Identity & Product Designer" },
      { property: "og:description", content: "From brand idea to shelf presence: identity, packaging and product visuals by Hasib Himel." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const bySlug = (s: string) => projects.find((p) => p.slug === s)!;

function Index() {
  return (
    <div className="overflow-x-clip">
      <SiteNav />
      <main>
        <Hero />
        <Overview />
        <SelectedWork />
        <Explorer />
        <Services />
        <About />
        <Experience />
        <Process />
        <Faq />
        <Contact />
      </main>
      <SiteFooter />
    </div>
  );
}

function SectionHead({ index, label, title, intro }: { index: string; label: string; title: React.ReactNode; intro?: string }) {
  return (
    <Reveal className="mb-14 md:mb-20 grid gap-6 md:grid-cols-12">
      <p className="eyebrow md:col-span-3">
        <span className="text-primary">{index}</span> — {label}
      </p>
      <div className="md:col-span-9">
        <h2 className="display-lg max-w-5xl">{title}</h2>
        {intro && <p className="mt-6 max-w-2xl text-lg text-muted-foreground">{intro}</p>}
      </div>
    </Reveal>
  );
}

/* ---------- Hero ---------- */
function Hero() {
  const [a, b, c] = [bySlug("garden-green-fresh-tea"), bySlug("nakano-international"), bySlug("ghee-jar-label")];
  return (
    <section className="relative min-h-[100svh] pt-28 pb-16 md:pt-32 grid-lines">
      <div className="container-x relative">
        <div className="flex items-center justify-between eyebrow">
          <span className="inline-flex items-center gap-2">
            <span className={cn("h-2 w-2 rounded-full", site.available ? "bg-success animate-pulse" : "bg-muted-foreground")} />
            {site.availability}
          </span>
          <span className="hidden sm:inline">Based in {site.location}</span>
        </div>

        <h1 className="display-xl mt-10 md:mt-14">
          <span className="block">From Brand Idea</span>
          <span className="block">
            <span className="text-outline">to</span> Shelf <span className="text-primary">Presence.</span>
          </span>
        </h1>

        <div className="mt-12 grid gap-10 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-4 lg:order-2">
            <p className="text-lg leading-relaxed text-muted-foreground">
              I'm <span className="text-foreground">Hasib Himel</span>, a brand identity and product designer creating distinctive visual identities,
              thoughtful packaging, and compelling product visuals that bring brands to life.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a href="#work" className="group inline-flex items-center justify-between gap-6 bg-foreground px-6 py-4 text-sm font-medium text-background transition-colors hover:bg-primary hover:text-primary-foreground">
                Explore My Work <ArrowDown className="h-4 w-4 transition-transform group-hover:translate-y-0.5" />
              </a>
              <a href="#contact" className="inline-flex items-center justify-between gap-6 border border-foreground/30 px-6 py-4 text-sm transition-colors hover:border-foreground">
                Let's Work Together <ArrowUpRight className="h-4 w-4" />
              </a>
            </div>
          </div>
          <div className="lg:col-span-8 lg:order-1 grid grid-cols-6 grid-rows-[repeat(2,minmax(0,1fr))] gap-3 h-[52vh] min-h-[340px] max-h-[560px]">
            <Link to="/work/$slug" params={{ slug: a.slug }} className="group col-span-4 row-span-2">
              <ProjectVisual project={a} zoom className="h-full" label="Garden Green Fresh Tea packaging" />
            </Link>
            <Link to="/work/$slug" params={{ slug: b.slug }} className="group col-span-2">
              <ProjectVisual project={b} zoom className="h-full" label="Nakano identity" />
            </Link>
            <Link to="/work/$slug" params={{ slug: c.slug }} className="group col-span-2">
              <ProjectVisual project={c} zoom className="h-full" label="Ghee label" />
            </Link>
          </div>
        </div>

        <a href="#overview" className="mt-14 hidden md:inline-flex items-center gap-3 eyebrow hover:text-foreground">
          <span className="relative h-9 w-5 rounded-full border border-foreground/30">
            <span className="absolute left-1/2 top-1.5 h-1.5 w-1 -translate-x-1/2 rounded-full bg-foreground animate-scroll-dot" />
          </span>
          Scroll
        </a>
      </div>
    </section>
  );
}

/* ---------- Overview ---------- */
function Overview() {
  const tags = ["Brand Identity", "Packaging Design", "Product Advertising", "Visual Communication"];
  return (
    <section id="overview" className="border-y border-border">
      <div className="overflow-hidden border-b border-border py-5">
        <div className="flex w-max animate-marquee gap-10 font-display text-2xl text-muted-foreground md:text-4xl">
          {[...tags, ...tags, ...tags, ...tags].map((t, i) => (
            <span key={i} className="flex items-center gap-10 whitespace-nowrap">
              {t} <span className="text-primary">✦</span>
            </span>
          ))}
        </div>
      </div>
      <div className="container-x py-24 md:py-36 grid gap-10 md:grid-cols-12">
        <Reveal className="md:col-span-7">
          <h2 className="display-lg">Design that connects brand thinking with real-world products.</h2>
        </Reveal>
        <Reveal className="md:col-span-4 md:col-start-9 self-end" delay={150}>
          <p className="text-lg leading-relaxed text-muted-foreground">
            I bring brand identities to life through cohesive visual systems, distinctive packaging, and purposeful advertising. My approach combines
            creative direction with practical design execution to help products communicate clearly and brands build a recognizable presence.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

/* ---------- Selected work ---------- */
function WorkCard({ p, className, aspect, i }: { p: Project; className?: string; aspect: string; i: number }) {
  return (
    <Reveal className={className} delay={(i % 2) * 120}>
      <Link to="/work/$slug" params={{ slug: p.slug }} className="group block">
        <ProjectVisual project={p} zoom className={aspect} />
        <div className="mt-5 flex items-start justify-between gap-6">
          <div>
            <p className="eyebrow">{p.type}{p.year && ` · ${p.year}`}</p>
            <h3 className="mt-2 text-2xl md:text-3xl font-medium">{p.title}</h3>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">{p.description}</p>
          </div>
          <span className="mt-1 inline-flex shrink-0 items-center gap-1 text-sm text-muted-foreground transition-colors group-hover:text-primary">
            <span className="hidden sm:inline">View Project</span>
            <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </span>
        </div>
      </Link>
    </Reveal>
  );
}

function SelectedWork() {
  const f = featuredSlugs.map(bySlug);
  return (
    <section id="work" className="container-x py-24 md:py-36 scroll-mt-16">
      <SectionHead
        index="01"
        label="Selected Work"
        title={<>Ideas become identities. <span className="text-muted-foreground">Identities become experiences.</span></>}
        intro="A curated collection of brand identities, packaging concepts, and commercial visuals created to give brands a distinctive visual direction and a stronger product presence."
      />
      <div className="grid gap-x-6 gap-y-16 md:grid-cols-12 md:gap-y-24">
        <WorkCard i={0} p={f[0]} className="md:col-span-12" aspect="aspect-[4/3] md:aspect-[21/9]" />
        <WorkCard i={0} p={f[1]} className="md:col-span-5" aspect="aspect-[4/5]" />
        <WorkCard i={1} p={f[2]} className="md:col-span-7 md:mt-32" aspect="aspect-[4/3]" />
        <WorkCard i={0} p={f[3]} className="md:col-span-10 md:col-start-2" aspect="aspect-[4/3] md:aspect-[16/8]" />
        <WorkCard i={0} p={f[4]} className="md:col-span-6" aspect="aspect-[4/3]" />
        <WorkCard i={1} p={f[5]} className="md:col-span-6 md:mt-24" aspect="aspect-[4/3]" />
      </div>
    </section>
  );
}

/* ---------- Explorer ---------- */
function Explorer() {
  const [cat, setCat] = useState<(typeof categories)[number]>("All Projects");
  const list = cat === "All Projects" ? projects : projects.filter((p) => p.category === cat);
  return (
    <section className="bg-paper text-paper-foreground">
      <div className="container-x py-24 md:py-32">
        <Reveal className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="eyebrow !text-paper-foreground/60">02 — Archive</p>
            <h2 className="display-lg mt-4">Explore the Portfolio</h2>
          </div>
          <p className="max-w-sm text-paper-foreground/70">Explore a selection of projects across identity, packaging, advertising, and visual communication.</p>
        </Reveal>
        <div role="tablist" aria-label="Filter projects" className="mt-12 -mx-5 flex gap-2 overflow-x-auto px-5 pb-2 md:mx-0 md:flex-wrap md:px-0">
          {categories.map((c) => (
            <button
              key={c}
              role="tab"
              aria-selected={cat === c}
              onClick={() => setCat(c)}
              className={cn(
                "whitespace-nowrap border px-4 py-2 text-sm transition-colors",
                cat === c ? "border-paper-foreground bg-paper-foreground text-paper" : "border-paper-foreground/20 hover:border-paper-foreground",
              )}
            >
              {c}
              <span className="ml-2 text-xs opacity-60">{c === "All Projects" ? projects.length : projects.filter((p) => p.category === c).length}</span>
            </button>
          ))}
        </div>
        <div key={cat} className="mt-10 grid gap-x-5 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 animate-in fade-in slide-in-from-bottom-3 duration-500">
          {list.map((p) => (
            <Link key={p.slug} to="/work/$slug" params={{ slug: p.slug }} className="group block">
              <ProjectVisual project={p} zoom className="aspect-[5/4]" />
              <div className="mt-4 flex items-baseline justify-between gap-4 border-b border-paper-foreground/15 pb-4">
                <h3 className="text-lg font-medium">{p.title}</h3>
                <span className="text-xs text-paper-foreground/60 whitespace-nowrap">{p.category}</span>
              </div>
            </Link>
          ))}
          {list.length === 0 && <p className="text-paper-foreground/60">No projects in this category yet.</p>}
        </div>
      </div>
    </section>
  );
}

/* ---------- Services ---------- */
function Services() {
  const [open, setOpen] = useState(0);
  return (
    <section id="services" className="container-x py-24 md:py-36 scroll-mt-16">
      <SectionHead
        index="03"
        label="Services"
        title="How I Can Help"
        intro="From defining a visual identity to presenting a product on the shelf, I create design solutions that help brands communicate with clarity and consistency."
      />
      <div className="border-t border-border">
        {services.map((s, i) => {
          const active = open === i;
          return (
            <div key={s.n} className="border-b border-border">
              <button
                aria-expanded={active}
                onClick={() => setOpen(active ? -1 : i)}
                onMouseEnter={() => window.matchMedia("(hover: hover)").matches && setOpen(i)}
                className="group grid w-full grid-cols-[3rem_1fr_auto] items-center gap-4 py-7 text-left md:grid-cols-[6rem_1fr_auto] md:py-9"
              >
                <span className={cn("font-display text-sm transition-colors", active ? "text-primary" : "text-muted-foreground")}>{s.n}</span>
                <span className={cn("font-display text-2xl md:text-5xl tracking-tight transition-colors", active ? "text-foreground" : "text-muted-foreground group-hover:text-foreground")}>
                  {s.title}
                </span>
                <Plus className={cn("h-5 w-5 transition-transform duration-500", active && "rotate-45 text-primary")} />
              </button>
              <div className={cn("grid transition-all duration-500 ease-out", active ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")}>
                <div className="overflow-hidden">
                  <div className="grid gap-6 pb-10 md:grid-cols-[6rem_1fr_1fr] md:pl-0 pl-16">
                    <span className="hidden md:block" />
                    <p className="max-w-md text-lg text-muted-foreground">{s.body}</p>
                    <ul className="flex flex-wrap gap-2">
                      {s.items.map((it) => (
                        <li key={it} className="border border-border px-3 py-1.5 text-sm">{it}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ---------- About ---------- */
function About() {
  return (
    <section id="about" className="bg-surface scroll-mt-16">
      <div className="container-x py-24 md:py-36 grid gap-14 md:grid-cols-12">
        <Reveal className="md:col-span-5">
          <div className="relative aspect-[4/5] bg-surface-2 grid-lines flex items-center justify-center">
            <span className="font-display text-[8rem] font-semibold leading-none text-foreground/10">HH</span>
            <span className="absolute bottom-3 left-3 bg-background/80 px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Placeholder · Replace with professional portrait
            </span>
          </div>
        </Reveal>
        <Reveal className="md:col-span-6 md:col-start-7 flex flex-col justify-center" delay={150}>
          <p className="eyebrow"><span className="text-primary">04</span> — About</p>
          <h2 className="mt-6 font-display text-3xl md:text-5xl font-medium leading-[1.05]">
            A designer focused on brands, products, and the details that connect them.
          </h2>
          <div className="mt-8 space-y-5 text-muted-foreground leading-relaxed">
            <p>I'm Hasib Himel, a graphic designer specializing in brand identity, product packaging, and visual communication.</p>
            <p>My work brings together creative thinking and practical design execution. I enjoy developing visual concepts and transforming them into cohesive identities, thoughtful packaging, and compelling product presentations.</p>
            <p>From the first visual direction to the final design application, I focus on creating work that feels purposeful, distinctive, and consistent with the brand it represents.</p>
          </div>
          <p className="mt-8 text-sm text-muted-foreground">
            Industries: food · beauty · electronics · footwear · leather goods · consumer products
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <a href={site.behance} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 border border-foreground/30 px-5 py-3 text-sm hover:border-primary hover:text-primary">Behance <ArrowUpRight className="h-4 w-4" /></a>
            <a href={site.linkedin} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 border border-foreground/30 px-5 py-3 text-sm hover:border-primary hover:text-primary">LinkedIn <ArrowUpRight className="h-4 w-4" /></a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ---------- Experience ---------- */
function Experience() {
  return (
    <section id="experience" className="container-x py-24 md:py-36 scroll-mt-16">
      <SectionHead index="05" label="Experience" title="Experience & Professional Journey" />
      <ol className="border-t border-border">
        {experience.map((e, i) => (
          <Reveal key={e.company} delay={i * 80}>
            <li className="grid gap-4 border-b border-border py-10 md:grid-cols-12">
              <p className="eyebrow md:col-span-3">{e.dates}</p>
              <div className="md:col-span-5">
                <h3 className="text-3xl font-medium">{e.company}</h3>
                <p className="mt-1 text-primary">{e.role}</p>
                <p className="mt-1 text-sm text-muted-foreground">{e.type} · {e.location}</p>
              </div>
              <p className="md:col-span-4 text-muted-foreground">{e.body}</p>
            </li>
          </Reveal>
        ))}
      </ol>
    </section>
  );
}

/* ---------- Process ---------- */
function Process() {
  return (
    <section className="border-y border-border bg-surface">
      <div className="container-x py-24 md:py-36">
        <SectionHead
          index="06"
          label="Process"
          title="A Thoughtful Process. Purposeful Design."
          intro="Every project starts with understanding what needs to be communicated. From defining the creative direction to refining the details, the process keeps the work focused, collaborative, and consistent."
        />
        <ol className="grid border-l border-border md:grid-cols-5 md:border-l-0 md:border-t">
          {process.map((s, i) => (
            <Reveal key={s.n} delay={i * 100}>
              <li className="relative pl-8 pb-10 md:pl-0 md:pt-10 md:pr-6">
                <span className="absolute -left-[5px] top-1 h-2.5 w-2.5 rounded-full bg-primary md:left-0 md:-top-[5px]" />
                <span className="font-display text-sm text-muted-foreground">{s.n}</span>
                <h3 className="mt-3 text-2xl font-medium">{s.title}</h3>
                <p className="mt-3 text-sm text-muted-foreground">{s.body}</p>
              </li>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ---------- FAQ ---------- */
function Faq() {
  return (
    <section className="container-x py-24 md:py-36 grid gap-12 md:grid-cols-12">
      <div className="md:col-span-4">
        <p className="eyebrow"><span className="text-primary">07</span> — FAQ</p>
        <h2 className="display-lg mt-6">Questions, answered.</h2>
      </div>
      <div className="md:col-span-8 border-t border-border">
        {faqs.map((f) => (
          <details key={f.q} className="group border-b border-border">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-6 text-lg md:text-xl [&::-webkit-details-marker]:hidden">
              {f.q}
              <Plus className="h-5 w-5 shrink-0 transition-transform duration-300 group-open:rotate-45 group-open:text-primary" />
            </summary>
            <p className="pb-6 pr-10 text-muted-foreground animate-in fade-in slide-in-from-top-1">{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

/* ---------- Contact ---------- */
function Contact() {
  return (
    <section id="contact" className="relative border-t border-border grid-lines scroll-mt-16">
      <div className="container-x py-24 md:py-36 grid gap-16 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <p className="eyebrow"><span className="text-primary">08</span> — Contact</p>
          <h2 className="display-lg mt-6">Let's build something <span className="text-primary">meaningful.</span></h2>
          <p className="mt-8 max-w-md text-lg text-muted-foreground">
            Have a brand, product, or creative project in mind? Tell me a little about what you're working on, and let's explore how thoughtful design can bring your idea to life.
          </p>
          <dl className="mt-12 space-y-5 text-sm">
            <div className="flex justify-between border-b border-border pb-3"><dt className="text-muted-foreground">Email</dt><dd>{site.email || "[Add public email]"}</dd></div>
            <div className="flex justify-between border-b border-border pb-3"><dt className="text-muted-foreground">Behance</dt><dd><a className="hover:text-primary" href={site.behance} target="_blank" rel="noreferrer">hasibhimel72 ↗</a></dd></div>
            <div className="flex justify-between border-b border-border pb-3"><dt className="text-muted-foreground">LinkedIn</dt><dd><a className="hover:text-primary" href={site.linkedin} target="_blank" rel="noreferrer">hasibhimel072 ↗</a></dd></div>
            <div className="flex justify-between border-b border-border pb-3"><dt className="text-muted-foreground">Location</dt><dd>{site.location}</dd></div>
          </dl>
        </div>
        <div className="lg:col-span-6 lg:col-start-7 bg-background/70 border border-border p-6 md:p-10">
          <ContactForm />
        </div>
      </div>
    </section>
  );
}
