import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowUpRight, ArrowDown, Copy, Check, Sparkles } from "lucide-react";
import { SiteNav, SiteFooter } from "@/components/site/Chrome";
import { ProjectVisual } from "@/components/site/ProjectVisual";
import { Reveal } from "@/components/site/Reveal";
import { ContactForm } from "@/components/site/ContactForm";
import { getPublicThemeStyle, loadPublicPortfolio } from "@/lib/cms/public-content";
import { cn } from "@/lib/utils";
import type { ContentSnapshot, LegacyPortfolioContent, PageSection } from "@/lib/cms/schema";

type HeroData = Extract<PageSection, { type: "hero" }>["data"];
type ProjectGridData = Extract<PageSection, { type: "project-grid" }>["data"];
type ServicesData = Extract<PageSection, { type: "services" }>["data"];
type ProfileData = Extract<PageSection, { type: "profile" }>["data"];
type ExperienceData = Extract<PageSection, { type: "experience" }>["data"];
type ProcessData = Extract<PageSection, { type: "process" }>["data"];
type FaqsData = Extract<PageSection, { type: "faqs" }>["data"];
type ContactData = Extract<PageSection, { type: "contact" }>["data"];
type CtaTarget = HeroData["primaryCta"]["target"];

function getCtaHref(
  target: CtaTarget | undefined,
  snapshot?: ContentSnapshot,
  fallback = "#contact",
) {
  if (!target) return fallback;
  if (target.kind === "external") return target.url;
  if (target.kind === "page") return target.path;
  const section = snapshot?.pages
    .flatMap((page) => page.sections)
    .find((item) => item.id === target.sectionId);
  if (!section) return fallback;
  const anchor =
    section.type === "project-grid" || section.type === "project-highlights"
      ? "work"
      : section.type === "profile"
        ? "about"
        : section.type;
  return `/#${anchor}`;
}

export const Route = createFileRoute("/")({
  loader: loadPublicPortfolio,
  head: ({ loaderData }) => {
    const snapshot = loaderData?.snapshot;
    const seo = snapshot?.pages.find((page) => page.slug === "/")?.seo ?? snapshot?.seo;
    const title = seo?.title ?? "Hasib Himel — Brand Identity & Product Designer";
    const description =
      seo?.description ??
      "Portfolio of Hasib Himel, a Bangladesh-based brand identity and product designer creating visual identities, packaging and product advertising.";
    const socialTitle = seo?.social.openGraphTitle || title;
    const socialDescription = seo?.social.openGraphDescription || description;
    const openGraphImageId = seo?.social.openGraphImage?.mediaId;
    const twitterImageId = seo?.social.twitterImage?.mediaId ?? openGraphImageId;
    const socialImage = openGraphImageId ? loaderData?.mediaUrls[openGraphImageId] : undefined;
    const twitterImage = twitterImageId ? loaderData?.mediaUrls[twitterImageId] : undefined;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        {
          name: "robots",
          content: `${seo?.robots.index ? "index" : "noindex"},${seo?.robots.follow ? "follow" : "nofollow"}`,
        },
        { property: "og:title", content: socialTitle },
        { property: "og:description", content: socialDescription },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: seo?.social.twitterCard ?? "summary_large_image" },
        { name: "twitter:title", content: seo?.social.twitterTitle || socialTitle },
        {
          name: "twitter:description",
          content: seo?.social.twitterDescription || socialDescription,
        },
        ...(socialImage ? [{ property: "og:image", content: socialImage }] : []),
        ...(twitterImage ? [{ name: "twitter:image", content: twitterImage }] : []),
        ...(seo?.canonicalPath ? [{ property: "og:url", content: seo.canonicalPath }] : []),
      ],
      links: seo?.canonicalPath ? [{ rel: "canonical", href: seo.canonicalPath }] : [],
    };
  },
  component: Index,
});

function Index() {
  const { content, snapshot, mediaUrls } = Route.useLoaderData();
  return <PortfolioPage content={content} snapshot={snapshot} mediaUrls={mediaUrls} />;
}

export function PortfolioPage({
  content,
  snapshot,
  mediaUrls = {},
  previewMode = false,
}: {
  content: LegacyPortfolioContent;
  snapshot?: ContentSnapshot | undefined;
  mediaUrls?: Record<string, string>;
  previewMode?: boolean;
}) {
  const { categories, experience, faqs, process, processOutcomes, projects, services, site } =
    content;
  const homePage = snapshot?.pages.find((page) => page.slug === "/");
  const heroSection = homePage?.sections.find((section) => section.type === "hero");
  const highlightsSection = homePage?.sections.find(
    (section) => section.type === "project-highlights",
  );
  const projectGridSection = homePage?.sections.find((section) => section.type === "project-grid");
  const servicesSection = homePage?.sections.find((section) => section.type === "services");
  const profileSection = homePage?.sections.find((section) => section.type === "profile");
  const experienceSection = homePage?.sections.find((section) => section.type === "experience");
  const processSection = homePage?.sections.find((section) => section.type === "process");
  const faqsSection = homePage?.sections.find((section) => section.type === "faqs");
  const contactSection = homePage?.sections.find((section) => section.type === "contact");
  const themeStyle = getPublicThemeStyle(snapshot, previewMode);
  const homepageProjectIds =
    projectGridSection?.type === "project-grid" ? projectGridSection.data.projectIds : [];
  const homepageProjects =
    homepageProjectIds.length && snapshot
      ? projects.filter((project) =>
          homepageProjectIds.includes(
            snapshot.projects.find((item) => item.slug === project.slug)?.id ?? "",
          ),
        )
      : projects;

  return (
    <div
      className={cn(
        "overflow-x-clip",
        (snapshot?.origin === "cms" || previewMode) && "portfolio-public",
      )}
      style={themeStyle}
    >
      <SiteNav snapshot={snapshot} />
      <main>
        {heroSection?.visible !== false && (
          <Hero
            site={site}
            projects={projects}
            experience={experience}
            data={heroSection?.type === "hero" ? heroSection.data : undefined}
            snapshot={snapshot}
          />
        )}
        {highlightsSection?.visible !== false && (
          <WorkMarquee
            projects={projects.filter((project) => content.featuredSlugs.includes(project.slug))}
            label={
              highlightsSection?.type === "project-highlights"
                ? highlightsSection.data.label
                : undefined
            }
          />
        )}
        {projectGridSection?.visible !== false && (
          <WorkList
            categories={categories}
            projects={homepageProjects}
            site={site}
            data={projectGridSection?.type === "project-grid" ? projectGridSection.data : undefined}
          />
        )}
        {servicesSection?.visible !== false && (
          <Services
            services={services}
            data={servicesSection?.type === "services" ? servicesSection.data : undefined}
          />
        )}
        {profileSection?.visible !== false && (
          <About
            site={site}
            projects={projects}
            profile={snapshot?.profile}
            mediaUrls={mediaUrls}
            data={profileSection?.type === "profile" ? profileSection.data : undefined}
          />
        )}
        {experienceSection?.visible !== false && (
          <Experience
            experience={experience}
            data={experienceSection?.type === "experience" ? experienceSection.data : undefined}
          />
        )}
        {processSection?.visible !== false && (
          <Process
            process={process}
            processOutcomes={processOutcomes}
            data={processSection?.type === "process" ? processSection.data : undefined}
          />
        )}
        {faqsSection?.visible !== false && (
          <Faq
            faqs={faqs}
            site={site}
            data={faqsSection?.type === "faqs" ? faqsSection.data : undefined}
          />
        )}
        {contactSection?.visible !== false && (
          <Contact
            site={site}
            data={contactSection?.type === "contact" ? contactSection.data : undefined}
            snapshot={snapshot}
            mediaUrls={mediaUrls}
          />
        )}
      </main>
      <SiteFooter snapshot={snapshot} />
    </div>
  );
}

/* ---------- shared bits ---------- */

function Sparkle({ className }: { className?: string | undefined }) {
  return (
    <span aria-hidden className={cn("sparkle inline-block select-none", className)}>
      ✦
    </span>
  );
}

function DhakaTime({ className }: { className?: string | undefined }) {
  const [now, setNow] = useState("");
  useEffect(() => {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Dhaka",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    const tick = () => setNow(fmt.format(new Date()));
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);
  return <span className={className}>{now || "—"}</span>;
}

function CopyEmailButton({ email }: { email: string }) {
  const [copied, setCopied] = useState(false);
  if (!email) return null;
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(email).catch(() => {});
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

function SectionHead({
  label,
  title,
  intro,
  center,
}: {
  label: string;
  title: React.ReactNode;
  intro?: string | undefined;
  center?: boolean;
}) {
  return (
    <Reveal className={cn("mb-12 md:mb-16", center && "text-center")}>
      <p className="eyebrow">{label}</p>
      <h2 className={cn("display-lg mt-4", center && "mx-auto max-w-3xl")}>{title}</h2>
      {intro && (
        <p className={cn("mt-5 max-w-xl text-muted-foreground", center && "mx-auto")}>{intro}</p>
      )}
    </Reveal>
  );
}

/* ---------- Hero ---------- */
function Hero({
  site,
  projects,
  experience,
  data,
  snapshot,
}: Pick<LegacyPortfolioContent, "site" | "projects" | "experience"> & {
  data?: HeroData | undefined;
  snapshot?: ContentSnapshot | undefined;
}) {
  const title = data?.title || "Where Strategy Becomes Identity";
  const words = title.split(/\s+/);
  const firstLineEnd = Math.ceil(words.length / 2);
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
            {data?.eyebrow || site.availability}
          </p>
        </Reveal>
        <Reveal delay={100}>
          <h1 className="display-xl mx-auto mt-8 max-w-4xl">
            {words.map((word, index) => (
              <span key={`${word}-${index}`}>
                {index > 0 && " "}
                <span
                  className={cn(
                    word.toLowerCase() === "strategy"
                      ? "text-primary"
                      : word.toLowerCase() === "identity"
                        ? "text-hot"
                        : undefined,
                  )}
                >
                  {word}
                </span>
                {index + 1 === firstLineEnd && <br />}
              </span>
            ))}
          </h1>
        </Reveal>
        <Reveal delay={200}>
          <p className="mx-auto mt-7 max-w-xl text-lg text-muted-foreground">
            {data?.body ||
              "I'm Hasibuzzaman, You can call me Hasib. I build distinctive brand identities through strategic thinking, purposeful design, and uncompromising attention to detail."}
          </p>
        </Reveal>
        <Reveal delay={300}>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <a href={getCtaHref(data?.primaryCta.target, snapshot, "#work")} className="btn-glow">
              {data?.primaryCta.label || "Explore My Work"} <ArrowDown className="h-4 w-4" />
            </a>
            {data?.secondaryCta ? (
              <a href={getCtaHref(data.secondaryCta.target, snapshot)} className="btn-ghost-pill">
                {data.secondaryCta.label} <ArrowUpRight className="h-4 w-4" />
              </a>
            ) : site.email ? (
              <CopyEmailButton email={site.email} />
            ) : (
              <a href="#contact" className="btn-ghost-pill">
                Let's talk <ArrowUpRight className="h-4 w-4" />
              </a>
            )}
          </div>
        </Reveal>
        <Reveal delay={400}>
          <div className="glow-card mx-auto mt-14 max-w-xl px-8 py-6">
            <div className="flex items-center justify-center gap-3 text-2xl">
              <Sparkles className="h-5 w-5 text-primary" />
              <span className="font-display font-semibold">{projects.length} projects shipped</span>
            </div>
            {experience.length > 0 && (
              <p className="mt-2 text-sm text-muted-foreground">
                Trusted by teams at {experience.map((e) => e.company).join(", ")}
              </p>
            )}
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
function WorkMarquee({
  projects,
  label = "Selected work",
}: Pick<LegacyPortfolioContent, "projects"> & { label?: string | undefined }) {
  if (projects.length === 0) return null;
  const row = [...projects, ...projects];
  return (
    <section aria-label="Project highlights" className="relative py-14">
      <p className="eyebrow text-center">
        {label} · {projects.length} projects
      </p>
      <div className="marquee-tilt mt-10 overflow-hidden py-6">
        <div className="flex w-max animate-marquee gap-6">
          {row.map((p, i) => (
            <Link
              key={p.slug + i}
              to="/work/$slug"
              params={{ slug: p.slug }}
              className="marquee-card group block"
            >
              <ProjectVisual project={p} zoom className="h-full w-full" />
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- Work list ---------- */
function WorkList({
  categories,
  projects,
  site,
  data,
}: Pick<LegacyPortfolioContent, "categories" | "projects" | "site"> & {
  data?: ProjectGridData | undefined;
}) {
  const [cat, setCat] = useState<string>("All Projects");
  const list = cat === "All Projects" ? projects : projects.filter((p) => p.category === cat);
  const layout = data?.layout ?? "masonry";
  return (
    <section id="work" className="container-x cms-section-spacing scroll-mt-24">
      <SectionHead
        label={data?.eyebrow || "Selected work"}
        title={
          data?.title || (
            <>
              Every project, one place to <span className="text-primary">explore.</span>
            </>
          )
        }
        intro={
          data?.intro || "Filter by discipline, or open a project to see the full story behind it."
        }
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
              cat === c
                ? "border-transparent bg-primary text-primary-foreground shadow-[0_8px_24px_-8px_var(--glow)]"
                : "border-input text-muted-foreground hover:border-primary hover:text-foreground",
            )}
          >
            {c}
            <span className="ml-2 text-xs opacity-60">
              {c === "All Projects"
                ? projects.length
                : projects.filter((p) => p.category === c).length}
            </span>
          </button>
        ))}
      </div>

      <div
        key={cat}
        className={cn(
          "mt-8 grid grid-cols-1 gap-4 animate-in fade-in slide-in-from-bottom-3 duration-500 sm:grid-cols-2",
          layout === "masonry" ? "md:grid-cols-4 md:auto-rows-[250px]" : "md:grid-cols-3",
        )}
      >
        {list.map((p, i) => (
          <Reveal
            key={p.slug}
            delay={i * 60}
            className={cn(
              "h-full min-w-0",
              layout === "masonry" && i % 8 === 0 && "md:col-span-2 md:row-span-2",
              layout === "masonry" && i % 8 === 3 && "md:row-span-2",
              layout === "masonry" && i % 8 === 5 && "md:col-span-2",
            )}
          >
            <Link
              to="/work/$slug"
              params={{ slug: p.slug }}
              className="glow-card group relative flex h-full min-h-[300px] flex-col overflow-hidden p-3 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_40px_-18px_var(--glow)] md:min-h-0"
            >
              <ProjectVisual
                project={p}
                zoom
                className="min-h-[150px] w-full flex-1 rounded-xl transition-transform duration-500 group-hover:scale-[1.03]"
              />

              <div className="mt-3 flex shrink-0 items-start gap-2">
                <div className="min-w-0 flex-1">
                  <h3 className="break-words font-display text-base font-semibold leading-snug md:text-lg">
                    {p.title}
                  </h3>
                  <p className="eyebrow mt-1.5 text-[9px] leading-relaxed md:!text-[10px]">
                    {p.type} · {p.category}
                  </p>
                </div>

                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-input text-muted-foreground transition-all duration-300 group-hover:border-primary group-hover:bg-primary group-hover:text-primary-foreground">
                  <ArrowUpRight className="h-4 w-4" />
                </span>
              </div>
            </Link>
          </Reveal>
        ))}

        {list.length === 0 && (
          <p className="text-muted-foreground">No projects in this category yet.</p>
        )}
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
    <svg
      viewBox="0 0 200 90"
      className="h-full w-full text-primary/70"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
    >
      <circle cx="100" cy="45" r="28" />
      <circle cx="100" cy="45" r="18" />
      <line x1="20" y1="45" x2="180" y2="45" />
      <line x1="100" y1="5" x2="100" y2="85" />
      <rect x="72" y="17" width="56" height="56" strokeDasharray="4 4" />
    </svg>
  ),
  "02": (
    /* packaging boxes */
    <svg
      viewBox="0 0 200 90"
      className="h-full w-full text-primary/70"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
    >
      <rect x="45" y="20" width="40" height="55" rx="4" />
      <rect x="95" y="12" width="40" height="63" rx="4" />
      <rect x="145" y="28" width="30" height="47" rx="4" />
      <line x1="45" y1="34" x2="85" y2="34" />
      <line x1="95" y1="26" x2="135" y2="26" />
    </svg>
  ),
  "03": (
    /* ad layout frames */
    <svg
      viewBox="0 0 200 90"
      className="h-full w-full text-primary/70"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
    >
      <rect x="25" y="15" width="150" height="60" rx="6" />
      <rect x="35" y="25" width="60" height="8" rx="2" />
      <rect x="35" y="39" width="90" height="5" rx="2" strokeDasharray="3 3" />
      <circle cx="155" cy="55" r="12" />
    </svg>
  ),
  "04": (
    /* document stack */
    <svg
      viewBox="0 0 200 90"
      className="h-full w-full text-primary/70"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
    >
      <rect x="60" y="18" width="80" height="56" rx="4" />
      <rect x="70" y="10" width="80" height="56" rx="4" />
      <line x1="80" y1="24" x2="135" y2="24" />
      <line x1="80" y1="33" x2="125" y2="33" />
      <line x1="80" y1="42" x2="140" y2="42" />
    </svg>
  ),
  "05": (
    /* motion frames */
    <svg
      viewBox="0 0 200 90"
      className="h-full w-full text-primary/70"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
    >
      <rect x="30" y="25" width="40" height="40" rx="6" opacity="0.45" />
      <rect x="80" y="20" width="40" height="50" rx="6" opacity="0.7" />
      <rect x="130" y="15" width="40" height="60" rx="6" />
      <path d="M92 42 l16 8 -16 8 z" fill="currentColor" stroke="none" />
    </svg>
  ),
};

function Services({
  services,
  data,
}: Pick<LegacyPortfolioContent, "services"> & { data?: ServicesData | undefined }) {
  if (services.length === 0) return null;
  return (
    <section id="services" className="container-x cms-section-spacing scroll-mt-24">
      <SectionHead
        label={data?.eyebrow || "Services"}
        title={
          data?.title || (
            <>
              What I <span className="text-primary">make.</span>
            </>
          )
        }
        intro={
          data?.intro ||
          "Two things I do best, and three that keep a brand consistent everywhere it shows up."
        }
      />
      <div className="grid gap-5 md:grid-cols-2">
        {services.map((s, i) => (
          <Reveal key={s.n} delay={(i % 2) * 100}>
            <article className="glow-card h-full p-6 md:p-7">
              <div className="h-28 overflow-hidden rounded-xl border border-border bg-background/60 p-3 md:h-32">
                {serviceArt[s.n]}
              </div>
              <span className={cn("chip mt-5", i < 2 ? "!border-primary/40 !text-primary" : "")}>
                {i < 2 ? "Core" : "Also"}
              </span>
              <h3 className="mt-3 font-display text-xl font-semibold md:text-2xl">{s.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{s.body}</p>
              <ul className="mt-4 flex flex-wrap gap-2">
                {s.items.map((it) => (
                  <li key={it} className="chip">
                    {it}
                  </li>
                ))}
              </ul>
            </article>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ---------- About ---------- */
function About({
  site,
  projects,
  profile,
  mediaUrls,
  data,
}: Pick<LegacyPortfolioContent, "site" | "projects"> & {
  profile?: ContentSnapshot["profile"] | undefined;
  mediaUrls: Record<string, string>;
  data?: ProfileData | undefined;
}) {
  const stats = profile?.stats.length
    ? [...profile.stats]
        .sort((left, right) => left.order - right.order)
        .map(({ value, label }) => ({ v: value, l: label }))
    : [
        { v: `${projects.length}+`, l: "Projects designed" },
        { v: "5", l: "Design disciplines" },
        { v: "3", l: "Studios & teams" },
        { v: "6+", l: "Industries served" },
      ];
  const toolkit = profile?.toolkit.length
    ? [...profile.toolkit].sort((left, right) => left.order - right.order)
    : [
        { name: "Adobe Illustrator", use: "Logos, packaging, marks and vector systems" },
        { name: "Adobe Photoshop", use: "Profesonal retouching, Mockups and image work" },
        { name: "Adobe After Effect", use: "Animations and motion graphics" },
        { name: "Adobe Premiere Pro", use: "Video editing, assemble video clips and audio tracks" },
        { name: "Figma", use: "Brand guidelines, layouts and presentations" },
      ];
  const biography = profile?.biography.length
    ? profile.biography
    : [
        "I'm Hasib Himel, a graphic designer specializing in brand identity, product packaging, and visual communication.",
        "My work brings together creative thinking and practical design execution — transforming visual concepts into cohesive identities, thoughtful packaging, and compelling product presentations.",
      ];
  const portraitUrl = profile?.portrait ? mediaUrls[profile.portrait.mediaId] : undefined;
  return (
    <section id="about" className="container-x cms-section-spacing scroll-mt-24">
      <div className="grid items-start gap-12 lg:grid-cols-12">
        {/* ID pass */}
        <Reveal className="lg:col-span-5">
          <div className="mx-auto max-w-sm">
            <div className="pass-lanyard">{site.name} · Design</div>
            <div className="pass-card">
              <div className="pass-notch" />
              <div className="flex items-center justify-between px-6 pt-4 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                <span>{site.name}</span>
                <span>Designer Pass</span>
              </div>
              <div className="pass-photo">
                {portraitUrl ? (
                  <img
                    src={portraitUrl}
                    alt={profile?.portrait?.alt ?? site.fullName}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="text-center">
                    <span className="font-display text-6xl font-bold text-primary">HH</span>
                    <p className="mt-3 px-6 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                      {profile?.portraitPlaceholder || "Placeholder · replace with your portrait"}
                    </p>
                  </div>
                )}
              </div>
              <div className="px-6 pb-6">
                <p className="font-display text-2xl font-semibold">{site.fullName}</p>
                <p className="text-sm text-muted-foreground">{site.role}</p>
                <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <dt className="eyebrow !text-[9px]">Based in</dt>
                    <dd className="mt-1">{site.location}</dd>
                  </div>
                  <div>
                    <dt className="eyebrow !text-[9px]">Local time</dt>
                    <dd className="mt-1">
                      <DhakaTime />
                    </dd>
                  </div>
                  <div>
                    <dt className="eyebrow !text-[9px]">Focus</dt>
                    <dd className="mt-1">{profile?.focus || "Brands & packaging"}</dd>
                  </div>
                  <div>
                    <dt className="eyebrow !text-[9px]">Status</dt>
                    <dd className="mt-1 flex items-center gap-1.5">
                      <span
                        className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          site.available ? "bg-success" : "bg-muted-foreground",
                        )}
                      />
                      {site.availability}
                    </dd>
                  </div>
                </dl>
                <div className="barcode mt-6" aria-hidden />
              </div>
            </div>
          </div>
        </Reveal>
        {/* Copy + stats + toolkit */}
        <div className="lg:col-span-7">
          <Reveal>
            <p className="eyebrow">{data?.eyebrow || "About"}</p>
            <h2 className="display-lg mt-4">
              {data?.title || (
                <>
                  The person behind the <span className="text-primary">pixels.</span>
                </>
              )}
            </h2>
            <div className="mt-6 space-y-4 text-muted-foreground leading-relaxed">
              {biography.map((paragraph, index) => (
                <p key={`${index}-${paragraph}`}>{paragraph}</p>
              ))}
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
function Experience({
  experience,
  data,
}: Pick<LegacyPortfolioContent, "experience"> & { data?: ExperienceData | undefined }) {
  const [active, setActive] = useState(0);
  const current = experience[active];
  if (!current) return null;
  return (
    <section id="experience" className="container-x cms-section-spacing scroll-mt-24">
      <SectionHead
        label={data?.eyebrow || "Experience"}
        title={
          data?.title || (
            <>
              Three chapters, <span className="text-primary">one timeline.</span>
            </>
          )
        }
        intro={
          data?.intro ||
          "Read it like an edit: every role is a clip on my timeline. Pick a clip to see what I did there."
        }
      />
      <Reveal>
        <div className="glow-card p-6 md:p-8">
          <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-destructive" /> Hasib_Career · Sequence 01
            </span>
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
            <div
              className="playhead"
              style={{ left: `${((active + 0.5) / experience.length) * 100}%` }}
              aria-hidden
            />
          </div>
          {/* current role */}
          <div key={active} className="mt-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <p className="eyebrow">{active === 0 ? "Current role" : "Earlier role"}</p>
            <h3 className="mt-2 font-display text-2xl font-semibold md:text-3xl">{current.role}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {current.company} · {current.dates} · {current.location}
            </p>
            <p className="mt-4 max-w-2xl text-muted-foreground">{current.body}</p>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

/* ---------- Process ---------- */
function Process({
  process,
  processOutcomes,
  data,
}: Pick<LegacyPortfolioContent, "process" | "processOutcomes"> & {
  data?: ProcessData | undefined;
}) {
  if (process.length === 0) return null;
  return (
    <section id="process" className="container-x cms-section-spacing">
      <SectionHead
        label={data?.eyebrow || `Process · ${process.length} steps`}
        title={
          data?.title || (
            <>
              From first brief to <span className="text-primary">final file.</span>
            </>
          )
        }
        intro={
          data?.intro ||
          "Every project travels the same road. Here is what you get at each stop, so you always know where we are."
        }
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
                {processOutcomes[i] && (
                  <p className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">
                    <span className="eyebrow !text-[9px] text-primary">You get</span>
                    <br />
                    <span className="mt-1 block text-sm text-foreground">{processOutcomes[i]}</span>
                  </p>
                )}
              </div>
            </li>
          </Reveal>
        ))}
      </ol>
    </section>
  );
}

/* ---------- FAQ (chat style) ---------- */
function Faq({
  faqs,
  site,
  data,
}: Pick<LegacyPortfolioContent, "faqs" | "site"> & { data?: FaqsData | undefined }) {
  const [open, setOpen] = useState(0);
  const current = faqs[open];
  if (!current) return null;
  return (
    <section id="faqs" className="container-x cms-section-spacing">
      <SectionHead
        label={data?.eyebrow || "FAQ"}
        title={
          data?.title || (
            <>
              Ask me <span className="text-primary">anything.</span>
            </>
          )
        }
        intro={
          data?.intro ||
          "These are the questions clients ask most. Tap one and I'll answer it in the chat."
        }
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
                open === i
                  ? "border-transparent bg-primary text-primary-foreground"
                  : "border-input text-muted-foreground hover:border-primary hover:text-foreground",
              )}
            >
              {f.q}
            </button>
          ))}
        </div>
        <div className="glow-card mt-6 p-6">
          <div className="flex items-center gap-3 border-b border-border pb-4">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-primary font-display text-sm font-bold text-primary-foreground">
              HH
            </span>
            <div>
              <p className="text-sm font-semibold">{site.name}</p>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-success" /> Usually replies within a
                day
              </p>
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
function Contact({
  site,
  data,
  snapshot,
  mediaUrls = {},
}: Pick<LegacyPortfolioContent, "site"> & {
  data?: ContactData | undefined;
  snapshot?: ContentSnapshot | undefined;
  mediaUrls?: Record<string, string>;
}) {
  const socialLinks = snapshot?.contact.socialLinks;
  return (
    <section id="contact" className="relative cms-section-spacing scroll-mt-24 overflow-hidden">
      <div aria-hidden className="absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-0 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-primary/12 blur-[130px]" />
      </div>
      <Sparkle className="absolute left-[10%] top-16 text-3xl animate-floaty" />
      <Sparkle className="absolute right-[12%] top-32 text-xl animate-floaty [animation-delay:1.4s]" />

      <div className="container-x">
        <Reveal className="text-center">
          <h2 className="display-lg mx-auto max-w-2xl">
            <Sparkle className="mr-3 text-3xl" />
            {data?.title || "Creativity is the voice that speaks without words."}
            <Sparkle className="ml-3 text-3xl" />
          </h2>
          <p className="mt-4 text-muted-foreground">
            {data?.intro || "Transforming your vision into creative reality."}
          </p>
          <p className="mx-auto mt-8 inline-flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-xs text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-success shadow-[0_0_10px_var(--success)]" />
            {site.availability}
          </p>
        </Reveal>

        <Reveal delay={120}>
          <h3 className="mt-16 text-center font-display text-3xl font-semibold md:text-4xl">
            Let's build a brand <span className="text-primary">people trust.</span>
          </h3>
          <p className="mt-3 text-center text-muted-foreground">
            Fill in the blanks. Your brief is ready to send in under a minute.
          </p>
        </Reveal>

        <Reveal delay={200}>
          <div className="glow-card mx-auto mt-10 max-w-2xl p-6 md:p-10">
            {snapshot?.contact.form.enabled ? (
              <ContactForm site={site} settings={snapshot.contact} />
            ) : snapshot ? (
              <p className="text-center text-muted-foreground">
                The contact form is currently unavailable. Please use the contact links below.
              </p>
            ) : (
              <ContactForm site={site} />
            )}
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
              <dd>
                <a
                  className="text-hot hover:underline"
                  href={socialLinks?.["behance"] ?? site.behance}
                  target="_blank"
                  rel="noreferrer"
                >
                  {socialLinks?.["behance"] ?? site.behance} ↗
                </a>
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4 py-3">
              <dt className="eyebrow !text-[10px]">LinkedIn</dt>
              <dd>
                <a
                  className="text-hot hover:underline"
                  href={socialLinks?.["linkedin"] ?? site.linkedin}
                  target="_blank"
                  rel="noreferrer"
                >
                  {socialLinks?.["linkedin"] ?? site.linkedin} ↗
                </a>
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4 py-3">
              <dt className="eyebrow !text-[10px]">Time</dt>
              <dd className="text-right">
                <DhakaTime className="text-foreground" />{" "}
                <span className="text-muted-foreground">in Dhaka</span>
                <br />
                <span className="text-xs text-muted-foreground">GMT+6</span>
              </dd>
            </div>
          </dl>
        </Reveal>
      </div>
    </section>
  );
}
