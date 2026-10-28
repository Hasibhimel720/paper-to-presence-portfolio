import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowUpRight, ArrowDown, Copy, Check, Sparkles } from "lucide-react";
import { SiteNav, SiteFooter } from "@/components/site/Chrome";
import { ProjectVisual } from "@/components/site/ProjectVisual";
import { Reveal } from "@/components/site/Reveal";
import { ContactForm } from "@/components/site/ContactForm";
import { categories, experience, faqs, process, projects, services, site } from "@/data/portfolio";
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

function Index() {
  return (
    <div className="overflow-x-clip">
      <SiteNav />
      <main>
        <Hero />
        <WorkMarquee />
        <WorkList />
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

/* ---------- shared bits ---------- */

function Sparkle({ className }: { className?: string | undefined }) {
  return <span aria-hidden className={cn("sparkle inline-block select-none", className)}>✦</span>;
}

function DhakaTime({ className }: { className?: string | undefined }) {
  const [now, setNow] = useState("");
  useEffect(() => {
    const fmt = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Dhaka", hour: "numeric", minute: "2-digit", hour12: true });
    const tick = () => setNow(fmt.format(new Date()));
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);
  return <span className={className}>{now || "—"}</span>;
}

function CopyEmailButton() {
  const [copied, setCopied] = useState(false);
  if (!site.email) return null;
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(site.email).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }}
      className="btn-ghost-pill"
    >
      {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
      {copied ? "Copied" : "Copy email"}
    </button>
  );
}

function SectionHead({ label, title, intro, center }: { label: string; title: React.ReactNode; intro?: string | undefined; center?: boolean }) {
  return (
    <Reveal className={cn("mb-12 md:mb-16", center && "text-center")}>
      <p className="eyebrow">{label}</p>
      <h2 className={cn("display-lg mt-4", center && "mx-auto max-w-3xl")}>{title}</h2>
      {intro && <p className={cn("mt-5 max-w-xl text-muted-foreground", center && "mx-auto")}>{intro}</p>}
    </Reveal>
  );
}

/* ---------- Hero ---------- */
function Hero() {
  return (
    <section className="relative isolate overflow-hidden pt-36 pb-16 md:pt-44">
      {/* ambient glows */}
      <div aria-hidden className="absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-[-20%] h-[560px] w-[860px] -translate-x-1/2 rounded-full bg-primary/15 blur-[140px]" />
        <div className="absolute right-[-10%] top-[30%] h-[380px] w-[380px] rounded-full bg-tangerine/10 blur-[120px]" />
      </div>
      <Sparkle className="absolute left-[8%] top-24 text-4xl animate-floaty" />
      <Sparkle className="absolute right-[10%] top-40 text-2xl animate-floaty [animation-delay:1.2s]" />
      <Sparkle className="absolute left-[16%] bottom-24 text-xl animate-floaty [animation-delay:2s]" />

      <div className="container-x text-center">
        <Reveal>
          <p className="mx-auto inline-flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-xs text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-success shadow-[0_0_10px_var(--success)]" />
            {site.availability}
          </p>
        </Reveal>
        <Reveal delay={100}>
          <h1 className="display-xl mx-auto mt-8 max-w-4xl">
            Shaping <span className="text-primary">identities.</span>
            <br />
            Bringing brands <span className="text-hot">to life.</span>
          </h1>
        </Reveal>
        <Reveal delay={200}>
          <p className="mx-auto mt-7 max-w-xl text-lg text-muted-foreground">
            I'm Hasib, a brand identity & product designer crafting identities people trust — and turning products into clear, shelf-ready visual stories.
          </p>
        </Reveal>
        <Reveal delay={300}>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <a href="#work" className="btn-glow">See my work <ArrowDown className="h-4 w-4" /></a>
            {site.email ? <CopyEmailButton /> : <a href="#contact" className="btn-ghost-pill">Let's talk <ArrowUpRight className="h-4 w-4" /></a>}
          </div>
        </Reveal>
        <Reveal delay={400}>
          <div className="glow-card mx-auto mt-14 max-w-xl px-8 py-6">
            <div className="flex items-center justify-center gap-3 text-2xl">
              <Sparkles className="h-5 w-5 text-primary" />
              <span className="font-display font-semibold">{projects.length} projects shipped</span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Trusted by teams at {experience.map((e) => e.company).join(", ")}
            </p>
            <p className="mt-1 text-xs text-muted-foreground/70">
              Brand identities · Packaging · Product advertising
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ---------- Work marquee ---------- */
function WorkMarquee() {
  const row = [...projects, ...projects];
  return (
    <section aria-label="Project highlights" className="relative py-14">
      <p className="eyebrow text-center">Selected work · {projects.length} projects</p>
      <div className="marquee-tilt mt-10 overflow-hidden py-6">
        <div className="flex w-max animate-marquee gap-6">
          {row.map((p, i) => (
            <Link key={p.slug + i} to="/work/$slug" params={{ slug: p.slug }} className="marquee-card group block">
              <ProjectVisual project={p} zoom className="h-full w-full" />
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- Work list ---------- */
function WorkList() {
  const [cat, setCat] = useState<(typeof categories)[number]>("All Projects");
  const list = cat === "All Projects" ? projects : projects.filter((p) => p.category === cat);
  return (
    <section id="work" className="container-x scroll-mt-24 py-20 md:py-28">
      <SectionHead
        label="Selected work"
        title={<>Every project, one place to <span className="text-primary">explore.</span></>}
        intro="Filter by discipline, or open a project to see the full story behind it."
      />
      <div role="tablist" aria-label="Filter projects" className="flex flex-wrap gap-2">
        {categories.map((c) => (
          <button
            key={c}
            role="tab"
            aria-selected={cat === c}
            onClick={() => setCat(c)}
            className={cn(
              "rounded-full border px-4 py-2 text-sm transition-colors",
              cat === c ? "border-transparent bg-primary text-primary-foreground shadow-[0_8px_24px_-8px_var(--glow)]" : "border-input text-muted-foreground hover:border-primary hover:text-foreground",
            )}
          >
            {c}
            <span className="ml-2 text-xs opacity-60">{c === "All Projects" ? projects.length : projects.filter((p) => p.category === c).length}</span>
          </button>
        ))}
      </div>
      <div key={cat} className="mt-8 grid gap-4 animate-in fade-in slide-in-from-bottom-3 duration-500">
        {list.map((p, i) => (
          <Reveal key={p.slug} delay={i * 60}>
            <Link
              to="/work/$slug"
              params={{ slug: p.slug }}
              className="glow-card group flex items-center gap-5 p-4 transition-transform hover:-translate-y-0.5"
            >
              <ProjectVisual project={p} className="h-20 w-28 shrink-0 rounded-xl md:h-24 md:w-36" />
              <div className="min-w-0 flex-1">
                <h3 className="truncate font-display text-lg font-semibold md:text-xl">{p.title}</h3>
                <p className="eyebrow mt-1.5 !text-[10px]">{p.type} · {p.category}</p>
              </div>
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-input text-muted-foreground transition-all group-hover:border-primary group-hover:bg-primary group-hover:text-primary-foreground">
                <ArrowUpRight className="h-4 w-4" />
              </span>
            </Link>
          </Reveal>
        ))}
        {list.length === 0 && <p className="text-muted-foreground">No projects in this category yet.</p>}
      </div>
      <Reveal className="mt-12 text-center">
        <a href={site.behance} target="_blank" rel="noreferrer" className="btn-ghost-pill">
          See every project on Behance <ArrowUpRight className="h-4 w-4" />
        </a>
      </Reveal>
    </section>
  );
}

/* ---------- Services ---------- */
const serviceArt: Record<string, React.ReactNode> = {
  "01": (
    /* logo construction grid */
    <svg viewBox="0 0 200 90" className="h-full w-full text-primary/70" fill="none" stroke="currentColor" strokeWidth="1">
      <circle cx="100" cy="45" r="28" /><circle cx="100" cy="45" r="18" />
      <line x1="20" y1="45" x2="180" y2="45" /><line x1="100" y1="5" x2="100" y2="85" />
      <rect x="72" y="17" width="56" height="56" strokeDasharray="4 4" />
    </svg>
  ),
  "02": (
    /* packaging boxes */
    <svg viewBox="0 0 200 90" className="h-full w-full text-primary/70" fill="none" stroke="currentColor" strokeWidth="1">
      <rect x="45" y="20" width="40" height="55" rx="4" /><rect x="95" y="12" width="40" height="63" rx="4" />
      <rect x="145" y="28" width="30" height="47" rx="4" />
      <line x1="45" y1="34" x2="85" y2="34" /><line x1="95" y1="26" x2="135" y2="26" />
    </svg>
  ),
  "03": (
    /* ad layout frames */
    <svg viewBox="0 0 200 90" className="h-full w-full text-primary/70" fill="none" stroke="currentColor" strokeWidth="1">
      <rect x="25" y="15" width="150" height="60" rx="6" />
      <rect x="35" y="25" width="60" height="8" rx="2" /><rect x="35" y="39" width="90" height="5" rx="2" strokeDasharray="3 3" />
      <circle cx="155" cy="55" r="12" />
    </svg>
  ),
  "04": (
    /* document stack */
    <svg viewBox="0 0 200 90" className="h-full w-full text-primary/70" fill="none" stroke="currentColor" strokeWidth="1">
      <rect x="60" y="18" width="80" height="56" rx="4" /><rect x="70" y="10" width="80" height="56" rx="4" />
      <line x1="80" y1="24" x2="135" y2="24" /><line x1="80" y1="33" x2="125" y2="33" /><line x1="80" y1="42" x2="140" y2="42" />
    </svg>
  ),
  "05": (
    /* motion frames */
    <svg viewBox="0 0 200 90" className="h-full w-full text-primary/70" fill="none" stroke="currentColor" strokeWidth="1">
      <rect x="30" y="25" width="40" height="40" rx="6" opacity="0.45" />
      <rect x="80" y="20" width="40" height="50" rx="6" opacity="0.7" />
      <rect x="130" y="15" width="40" height="60" rx="6" />
      <path d="M92 42 l16 8 -16 8 z" fill="currentColor" stroke="none" />
    </svg>
  ),
};

function Services() {
  return (
    <section id="services" className="container-x scroll-mt-24 py-20 md:py-28">
      <SectionHead
        label="Services"
        title={<>What I <span className="text-primary">make.</span></>}
        intro="Two things I do best, and three that keep a brand consistent everywhere it shows up."
      />
      <div className="grid gap-5 md:grid-cols-2">
        {services.map((s, i) => (
          <Reveal key={s.n} delay={(i % 2) * 100}>
            <article className="glow-card h-full p-6 md:p-7">
              <div className="h-28 overflow-hidden rounded-xl border border-border bg-background/60 p-3 md:h-32">
                {serviceArt[s.n]}
              </div>
              <span className={cn("chip mt-5", i < 2 ? "!border-primary/40 !text-primary" : "")}>{i < 2 ? "Core" : "Also"}</span>
              <h3 className="mt-3 font-display text-xl font-semibold md:text-2xl">{s.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{s.body}</p>
              <ul className="mt-4 flex flex-wrap gap-2">
                {s.items.map((it) => <li key={it} className="chip">{it}</li>)}
              </ul>
            </article>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ---------- About ---------- */
function About() {
  const stats = [
    { v: `${projects.length}+`, l: "Projects designed" },
    { v: "5", l: "Design disciplines" },
    { v: "3", l: "Studios & teams" },
    { v: "6+", l: "Industries served" },
  ];
  const toolkit = [
    { name: "Adobe Illustrator", use: "Logos, marks and vector systems" },
    { name: "Adobe Photoshop", use: "Mockups and image work" },
    { name: "Figma", use: "Brand guidelines, layouts and presentations" },
  ];
  return (
    <section id="about" className="container-x scroll-mt-24 py-20 md:py-28">
      <div className="grid items-start gap-12 lg:grid-cols-12">
        {/* ID pass */}
        <Reveal className="lg:col-span-5">
          <div className="mx-auto max-w-sm">
            <div className="pass-lanyard">Hasib · Design</div>
            <div className="pass-card">
              <div className="pass-notch" />
              <div className="flex items-center justify-between px-6 pt-4 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                <span>Hasib.Design</span><span>Designer Pass</span>
              </div>
              <div className="pass-photo">
                <div className="text-center">
                  <span className="font-display text-6xl font-bold text-primary">HH</span>
                  <p className="mt-3 px-6 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Placeholder · replace with your portrait</p>
                </div>
              </div>
              <div className="px-6 pb-6">
                <p className="font-display text-2xl font-semibold">{site.fullName}</p>
                <p className="text-sm text-muted-foreground">{site.role}</p>
                <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
                  <div><dt className="eyebrow !text-[9px]">Based in</dt><dd className="mt-1">{site.location}</dd></div>
                  <div><dt className="eyebrow !text-[9px]">Local time</dt><dd className="mt-1"><DhakaTime /></dd></div>
                  <div><dt className="eyebrow !text-[9px]">Focus</dt><dd className="mt-1">Brands & packaging</dd></div>
                  <div><dt className="eyebrow !text-[9px]">Status</dt><dd className="mt-1 flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-success" />Open for projects</dd></div>
                </dl>
                <div className="barcode mt-6" aria-hidden />
              </div>
            </div>
          </div>
        </Reveal>
        {/* Copy + stats + toolkit */}
        <div className="lg:col-span-7">
          <Reveal>
            <p className="eyebrow">About</p>
            <h2 className="display-lg mt-4">The person behind the <span className="text-primary">pixels.</span></h2>
            <div className="mt-6 space-y-4 text-muted-foreground leading-relaxed">
              <p>I'm Hasib Himel, a graphic designer specializing in brand identity, product packaging, and visual communication.</p>
              <p>My work brings together creative thinking and practical design execution — transforming visual concepts into cohesive identities, thoughtful packaging, and compelling product presentations.</p>
            </div>
          </Reveal>
          <Reveal delay={120}>
            <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {stats.map((s) => (
                <div key={s.l} className="glow-card p-5">
                  <p className="font-display text-3xl font-semibold text-primary">{s.v}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{s.l}</p>
                </div>
              ))}
            </div>
          </Reveal>
          <Reveal delay={200}>
            <p className="eyebrow mt-12">Toolkit</p>
            <ul className="mt-4 divide-y divide-border border-y border-border">
              {toolkit.map((t) => (
                <li key={t.name} className="py-4">
                  <p className="font-medium">{t.name}</p>
                  <p className="text-sm text-muted-foreground">{t.use}</p>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ---------- Experience ---------- */
function Experience() {
  const [active, setActive] = useState(0);
  const current = experience[active]!;
  return (
    <section id="experience" className="container-x scroll-mt-24 py-20 md:py-28">
      <SectionHead
        label="Experience"
        title={<>Three chapters, <span className="text-primary">one timeline.</span></>}
        intro="Read it like an edit: every role is a clip on my timeline. Pick a clip to see what I did there."
      />
      <Reveal>
        <div className="glow-card p-6 md:p-8">
          <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-destructive" /> Hasib_Career · Sequence 01</span>
            <span>Playhead · Now</span>
          </div>
          {/* clip track */}
          <div className="relative mt-6">
            <div className="grid grid-cols-3 gap-2">
              {experience.map((e, i) => (
                <button
                  key={e.company}
                  onClick={() => setActive(i)}
                  aria-pressed={active === i}
                  className={cn("clip text-left transition-all", active === i && "clip-active")}
                >
                  {e.role} · {e.company}
                </button>
              ))}
            </div>
            <div className="playhead" style={{ left: `${((active + 0.5) / experience.length) * 100}%` }} aria-hidden />
          </div>
          {/* current role */}
          <div key={active} className="mt-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <p className="eyebrow">{active === 0 ? "Current role" : "Earlier role"}</p>
            <h3 className="mt-2 font-display text-2xl font-semibold md:text-3xl">{current.role}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{current.company} · {current.dates} · {current.location}</p>
            <p className="mt-4 max-w-2xl text-muted-foreground">{current.body}</p>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

/* ---------- Process ---------- */
const processGet = [
  "A one-page brief we both agree on",
  "A clear creative direction",
  "First concepts and key visuals",
  "A polished system, reviewed with you",
  "Final files, ready to use",
];

function Process() {
  return (
    <section className="container-x py-20 md:py-28">
      <SectionHead
        label="Process · 5 steps"
        title={<>From first brief to <span className="text-primary">final file.</span></>}
        intro="Every project travels the same road. Here is what you get at each stop, so you always know where we are."
      />
      <ol className="relative mx-auto max-w-2xl space-y-5 border-l-2 border-primary/30 pl-8">
        {process.map((s, i) => (
          <Reveal key={s.n} delay={i * 80}>
            <li className="relative">
              <span className="absolute -left-[41px] top-6 grid h-5 w-5 place-items-center rounded-full bg-primary shadow-[0_0_14px_var(--glow)]">
                <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />
              </span>
              <div className="glow-card p-6">
                <p className="eyebrow !text-[10px]">Step {s.n}</p>
                <h3 className="mt-1.5 font-display text-xl font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{s.body}</p>
                <p className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">
                  <span className="eyebrow !text-[9px] text-primary">You get</span><br />
                  <span className="mt-1 block text-sm text-foreground">{processGet[i]}</span>
                </p>
              </div>
            </li>
          </Reveal>
        ))}
      </ol>
    </section>
  );
}

/* ---------- FAQ (chat style) ---------- */
function Faq() {
  const [open, setOpen] = useState(0);
  const current = faqs[open]!;
  return (
    <section className="container-x py-20 md:py-28">
      <SectionHead
        label="FAQ"
        title={<>Ask me <span className="text-primary">anything.</span></>}
        intro="These are the questions clients ask most. Tap one and I'll answer it in the chat."
      />
      <div className="mx-auto max-w-2xl">
        <div className="flex flex-wrap gap-2">
          {faqs.map((f, i) => (
            <button
              key={f.q}
              onClick={() => setOpen(i)}
              aria-pressed={open === i}
              className={cn(
                "rounded-full border px-4 py-2 text-left text-sm transition-colors",
                open === i ? "border-transparent bg-primary text-primary-foreground" : "border-input text-muted-foreground hover:border-primary hover:text-foreground",
              )}
            >
              {f.q}
            </button>
          ))}
        </div>
        <div className="glow-card mt-6 p-6">
          <div className="flex items-center gap-3 border-b border-border pb-4">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-primary font-display text-sm font-bold text-primary-foreground">HH</span>
            <div>
              <p className="text-sm font-semibold">{site.name}</p>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className="h-1.5 w-1.5 rounded-full bg-success" /> Usually replies within a day</p>
            </div>
          </div>
          <div key={open} className="mt-5 flex flex-col gap-3 animate-in fade-in duration-300">
            <p className="chat-q">{current.q}</p>
            <p className="chat-a">{current.a}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- Contact ---------- */
function Contact() {
  return (
    <section id="contact" className="relative scroll-mt-24 overflow-hidden py-20 md:py-28">
      <div aria-hidden className="absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-0 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-primary/12 blur-[130px]" />
      </div>
      <Sparkle className="absolute left-[10%] top-16 text-3xl animate-floaty" />
      <Sparkle className="absolute right-[12%] top-32 text-xl animate-floaty [animation-delay:1.4s]" />

      <div className="container-x">
        <Reveal className="text-center">
          <h2 className="display-lg mx-auto max-w-2xl">
            <Sparkle className="mr-3 text-3xl" />
            Creativity is the voice that speaks without words.
            <Sparkle className="ml-3 text-3xl" />
          </h2>
          <p className="mt-4 text-muted-foreground">Transforming your vision into creative reality.</p>
          <p className="mx-auto mt-8 inline-flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-xs text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-success shadow-[0_0_10px_var(--success)]" />
            Open to freelance projects
          </p>
        </Reveal>

        <Reveal delay={120}>
          <h3 className="mt-16 text-center font-display text-3xl font-semibold md:text-4xl">
            Let's build a brand <span className="text-primary">people trust.</span>
          </h3>
          <p className="mt-3 text-center text-muted-foreground">Fill in the blanks. Your brief is ready to send in under a minute.</p>
        </Reveal>

        <Reveal delay={200}>
          <div className="glow-card mx-auto mt-10 max-w-2xl p-6 md:p-10">
            <ContactForm />
          </div>
        </Reveal>

        <Reveal delay={280}>
          <dl className="glow-card mx-auto mt-6 max-w-2xl divide-y divide-border p-6 md:p-8 text-sm">
            <div className="flex items-center justify-between gap-4 py-3">
              <dt className="eyebrow !text-[10px]">Email</dt>
              <dd className="text-muted-foreground">{site.email || "[Add your public email]"}</dd>
            </div>
            <div className="flex items-center justify-between gap-4 py-3">
              <dt className="eyebrow !text-[10px]">Behance</dt>
              <dd><a className="text-hot hover:underline" href={site.behance} target="_blank" rel="noreferrer">behance.net/hasibhimel72 ↗</a></dd>
            </div>
            <div className="flex items-center justify-between gap-4 py-3">
              <dt className="eyebrow !text-[10px]">LinkedIn</dt>
              <dd><a className="text-hot hover:underline" href={site.linkedin} target="_blank" rel="noreferrer">linkedin.com/in/hasibhimel072 ↗</a></dd>
            </div>
            <div className="flex items-center justify-between gap-4 py-3">
              <dt className="eyebrow !text-[10px]">Time</dt>
              <dd className="text-right"><DhakaTime className="text-foreground" /> <span className="text-muted-foreground">in Dhaka</span><br /><span className="text-xs text-muted-foreground">GMT+6</span></dd>
            </div>
          </dl>
        </Reveal>
      </div>
    </section>
  );
}
