import {
  ArrowUpRight,
  BriefcaseBusiness,
  CircleHelp,
  Clock3,
  FileText,
  Layers3,
  Sparkles,
  Tags,
  WandSparkles,
  Images,
  Palette,
  Settings2,
} from "lucide-react";
import type { ContentSnapshot } from "@/lib/cms/schema";

type OverviewPageProps = {
  snapshot: ContentSnapshot;
  onOpenSection: (section: string) => void;
  demoMode: boolean;
};

export function OverviewPage({ snapshot, onOpenSection, demoMode }: OverviewPageProps) {
  const visibleSections = snapshot.pages.reduce(
    (total, page) => total + page.sections.filter(({ visible }) => visible).length,
    0,
  );
  const visibleProjects = snapshot.projects.filter(({ visible }) => visible).length;
  const revisions = [...snapshot.revisions].sort((a, b) => b.number - a.number);
  const formatTimestamp = (value: string | null) =>
    value ? new Date(value).toLocaleString() : "Not yet saved";
  const stats = [
    { label: "Projects", value: snapshot.projects.length, icon: BriefcaseBusiness },
    { label: "Visible projects", value: visibleProjects, icon: BriefcaseBusiness },
    { label: "Categories", value: snapshot.categories.length, icon: Tags },
    { label: "Services", value: snapshot.services.length, icon: Sparkles },
    { label: "Experience", value: snapshot.experience.length, icon: Clock3 },
    { label: "Process steps", value: snapshot.process.length, icon: WandSparkles },
    { label: "FAQs", value: snapshot.faqs.length, icon: CircleHelp },
    { label: "Pages", value: snapshot.pages.length, icon: FileText },
    {
      label: "Visible sections",
      value: visibleSections,
      icon: Layers3,
    },
    {
      label: "Media records",
      value: snapshot.media.length,
      icon: Images,
    },
    {
      label: "Hidden page sections",
      value:
        snapshot.pages.reduce((total, page) => total + page.sections.length, 0) - visibleSections,
      icon: Layers3,
    },
  ];

  return (
    <div className="space-y-8">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Workspace overview</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Good to see you</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            {demoMode
              ? "Demo mode uses temporary session content and cannot save changes to your portfolio."
              : "Edit content, save private drafts, and publish changes to the public portfolio when ready."}
          </p>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium">
          <span className="h-2 w-2 rounded-full bg-primary" />
          {demoMode ? "Static content baseline" : "CMS content"}
        </span>
      </header>

      <section aria-label="Content statistics" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(({ label, value, icon: Icon }) => (
          <article key={label} className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{label}</span>
              <Icon aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="mt-4 text-3xl font-semibold tabular-nums">{value}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">Start managing</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Choose an area to explore the dashboard structure.
              </p>
            </div>
            <Layers3 aria-hidden="true" className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => onOpenSection("projects")}
              className="group flex items-center justify-between rounded-xl border border-border p-4 text-left transition-colors hover:bg-accent"
            >
              <span>
                <span className="block text-sm font-medium">Explore projects</span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {snapshot.projects.length} projects available
                </span>
              </span>
              <ArrowUpRight
                aria-hidden="true"
                className="h-4 w-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
              />
            </button>
            <button
              type="button"
              onClick={() => onOpenSection("pages")}
              className="group flex items-center justify-between rounded-xl border border-border p-4 text-left transition-colors hover:bg-accent"
            >
              <span>
                <span className="block text-sm font-medium">Explore homepage</span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {snapshot.pages[0]?.sections.length ?? 0} ordered sections
                </span>
              </span>
              <ArrowUpRight
                aria-hidden="true"
                className="h-4 w-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
              />
            </button>
            <button
              type="button"
              onClick={() => onOpenSection("services")}
              className="group flex items-center justify-between rounded-xl border border-border p-4 text-left transition-colors hover:bg-accent"
            >
              <span>
                <span className="block text-sm font-medium">Manage services</span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {snapshot.services.length} service entries
                </span>
              </span>
              <ArrowUpRight aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
            </button>
            <button
              type="button"
              onClick={() => onOpenSection("design")}
              className="group flex items-center justify-between rounded-xl border border-border p-4 text-left transition-colors hover:bg-accent"
            >
              <span>
                <span className="block text-sm font-medium">Edit design &amp; SEO</span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  Preview theme and metadata controls
                </span>
              </span>
              <ArrowUpRight aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6">
          <div>
            <h2 className="text-lg font-semibold">Revision history</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {demoMode
                ? "Revisions appear after persistent CMS setup."
                : "Saved draft and publication checkpoints."}
            </p>
          </div>
          {revisions.length > 0 ? (
            <ul className="mt-5 divide-y divide-border">
              {revisions.slice(0, 4).map((revision) => (
                <li
                  key={revision.id}
                  className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0"
                >
                  <div>
                    <p className="text-sm font-medium">
                      Revision {revision.number} · {revision.status}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {revision.publishedAt
                        ? `Published ${formatTimestamp(revision.publishedAt)}`
                        : `Updated ${formatTimestamp(revision.updatedAt)}`}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-5 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
              {demoMode
                ? "No CMS revisions are available in demo mode."
                : "No revisions yet. Save a draft to create the first revision."}
            </p>
          )}
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">Content status</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {demoMode
                  ? "The static baseline has no persistent publication state."
                  : "Draft and published state are read from the CMS."}
              </p>
            </div>
            <Palette aria-hidden="true" className="h-5 w-5 text-muted-foreground" />
          </div>
          <dl className="mt-5 space-y-3 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Content source</dt>
              <dd className="font-medium">{demoMode ? "Static baseline" : "CMS snapshot"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Publication state</dt>
              <dd className="font-medium">{snapshot.publication.status}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Draft revisions</dt>
              <dd className="font-medium">
                {snapshot.revisions.filter(({ status }) => status === "draft").length}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Hidden projects</dt>
              <dd className="font-medium">{snapshot.projects.length - visibleProjects}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Last CMS update</dt>
              <dd className="text-right font-medium">
                {formatTimestamp(snapshot.publication.updatedAt)}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Page sections</dt>
              <dd className="font-medium">
                {visibleSections} visible /{" "}
                {snapshot.pages.reduce((total, page) => total + page.sections.length, 0)} total
              </dd>
            </div>
          </dl>
        </div>
        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">More workspaces</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {demoMode
                  ? "Changes remain temporary in demo mode."
                  : "Choose a workspace to edit and save content."}
              </p>
            </div>
            <Settings2 aria-hidden="true" className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {(
              [
                ["categories", "Categories"],
                ["experience", "Experience"],
                ["process", "Process"],
                ["faqs", "FAQs"],
                ["media", "Media library"],
                ["settings", "Site settings"],
              ] as const
            ).map(([section, label]) => (
              <button
                key={section}
                type="button"
                onClick={() => onOpenSection(section)}
                className="rounded-lg border border-border px-3 py-2 text-sm transition-colors hover:bg-accent"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
