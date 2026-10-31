import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, FilePlus2, Eye, EyeOff, Layers3, Plus, Trash2 } from "lucide-react";
import {
  contentSnapshotSchema,
  pageSectionSchema,
  type ContentSnapshot,
  type PageSection,
} from "@/lib/cms/schema";

type PagesWorkspaceProps = {
  snapshot: ContentSnapshot;
  onChange: (snapshot: ContentSnapshot) => void;
};

type CtaTarget = Extract<PageSection, { type: "hero" }>["data"]["primaryCta"]["target"];

const sectionTypes = [
  "hero",
  "project-highlights",
  "project-grid",
  "services",
  "profile",
  "experience",
  "process",
  "faqs",
  "contact",
] as const;

function createId(kind: string) {
  return `${kind}:${crypto.randomUUID()}`;
}

function createSeo(title: string, slug: string): ContentSnapshot["seo"] {
  return {
    title,
    description: "",
    canonicalPath: slug,
    robots: { index: true, follow: true },
    social: {
      openGraphTitle: title,
      openGraphDescription: "",
      twitterCard: "summary_large_image",
      twitterTitle: title,
      twitterDescription: "",
    },
  };
}

function createSection(
  type: (typeof sectionTypes)[number],
  order: number,
  slug: string,
): PageSection {
  const base = { id: createId("section"), order, visible: true };
  switch (type) {
    case "hero":
      return {
        ...base,
        type,
        data: {
          eyebrow: "",
          title: "Hero heading",
          body: "",
          primaryCta: { label: "Explore", target: { kind: "page", path: slug } },
        },
      };
    case "project-highlights":
      return { ...base, type, data: { label: "", projectIds: [] } };
    case "project-grid":
      return {
        ...base,
        type,
        data: {
          eyebrow: "",
          title: "",
          intro: "",
          projectIds: [],
          categoryIds: [],
          layout: "grid",
        },
      };
    case "services":
      return { ...base, type, data: { eyebrow: "", title: "", intro: "", serviceIds: [] } };
    case "profile":
      return {
        ...base,
        type,
        data: { eyebrow: "", title: "", profileId: "" },
      };
    case "experience":
      return { ...base, type, data: { eyebrow: "", title: "", intro: "", experienceIds: [] } };
    case "process":
      return { ...base, type, data: { eyebrow: "", title: "", intro: "", processStepIds: [] } };
    case "faqs":
      return { ...base, type, data: { eyebrow: "", title: "", intro: "", faqIds: [] } };
    case "contact":
      return { ...base, type, data: { eyebrow: "", title: "", intro: "" } };
  }
}

function Field({
  label,
  value,
  onChange,
  multiline = false,
  type = "text",
  error,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  type?: string;
  error?: string;
}) {
  const controlClass =
    "w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring";
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {multiline ? (
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          rows={3}
          className={`${controlClass} resize-y`}
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={controlClass}
        />
      )}
      {error && <span className="block text-xs text-destructive">{error}</span>}
    </label>
  );
}

function SectionFields({
  section,
  snapshot,
  pageSlug,
  pageSections,
  onChange,
}: {
  section: PageSection;
  snapshot: ContentSnapshot;
  pageSlug: string;
  pageSections: PageSection[];
  onChange: (section: PageSection) => void;
}) {
  const setData = (data: PageSection["data"]) => onChange({ ...section, data } as PageSection);
  const input = (label: string, key: string, multiline = false) => (
    <Field
      label={label}
      value={String(section.data[key as keyof typeof section.data] ?? "")}
      multiline={multiline}
      onChange={(value) => setData({ ...section.data, [key]: value } as PageSection["data"])}
    />
  );
  const relationPicker = (
    label: string,
    options: { id: string; label: string }[],
    selectedIds: string[],
    onSelect: (ids: string[]) => void,
  ) => (
    <fieldset className="rounded-lg border border-border p-3 sm:col-span-2">
      <legend className="px-1 text-xs font-medium text-muted-foreground">{label}</legend>
      {options.length === 0 ? (
        <p className="text-xs text-muted-foreground">No entries are available to select.</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {options.map((option) => (
            <label key={option.id} className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={selectedIds.includes(option.id)}
                onChange={(event) =>
                  onSelect(
                    event.target.checked
                      ? [...selectedIds, option.id]
                      : selectedIds.filter((id) => id !== option.id),
                  )
                }
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      )}
    </fieldset>
  );

  if (section.type === "hero") {
    const targetOptions = [
      ...snapshot.pages
        .filter((page) => page.slug !== pageSlug)
        .flatMap((page) =>
          page.sections.map((item) => ({
            id: item.id,
            label: `${page.title} · ${item.type}`,
          })),
        ),
      ...pageSections.map((item) => ({ id: item.id, label: `${pageSlug} · ${item.type}` })),
    ];
    const renderTarget = (
      label: string,
      target: CtaTarget,
      onTargetChange: (target: CtaTarget) => void,
    ) => (
      <>
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">{label} target type</span>
          <select
            aria-label={`${label} target type`}
            value={target.kind}
            onChange={(event) => {
              const nextTarget =
                event.target.value === "section"
                  ? {
                      kind: "section" as const,
                      sectionId: targetOptions[0]?.id ?? "section:missing",
                    }
                  : event.target.value === "external"
                    ? { kind: "external" as const, url: "https://example.com/" }
                    : { kind: "page" as const, path: pageSlug || "/" };
              onTargetChange(nextTarget);
            }}
            className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm"
          >
            <option value="page">Page path</option>
            <option value="section">Section</option>
            <option value="external">External URL</option>
          </select>
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">{label} destination</span>
          {target.kind === "section" && targetOptions.length > 0 ? (
            <select
              aria-label={`${label} destination`}
              value={target.sectionId}
              onChange={(event) =>
                onTargetChange({ kind: "section", sectionId: event.target.value })
              }
              className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm"
            >
              {targetOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              aria-label={`${label} destination`}
              type={target.kind === "external" ? "url" : "text"}
              value={
                target.kind === "section" ? "" : target.kind === "page" ? target.path : target.url
              }
              onChange={(event) =>
                onTargetChange(
                  target.kind === "external"
                    ? { kind: "external", url: event.target.value }
                    : { kind: "page", path: event.target.value },
                )
              }
              className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm"
            />
          )}
        </label>
      </>
    );
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {input("Eyebrow", "eyebrow")}
        {input("Heading", "title")}
        <div className="sm:col-span-2">{input("Description", "body", true)}</div>
        <Field
          label="Primary button label"
          value={section.data.primaryCta.label}
          onChange={(label) =>
            setData({ ...section.data, primaryCta: { ...section.data.primaryCta, label } })
          }
        />
        {renderTarget("Primary button", section.data.primaryCta.target, (target) =>
          setData({ ...section.data, primaryCta: { ...section.data.primaryCta, target } }),
        )}
        <label className="flex items-center gap-2 text-sm text-muted-foreground sm:col-span-2">
          <input
            type="checkbox"
            checked={Boolean(section.data.secondaryCta)}
            onChange={(event) =>
              setData({
                ...section.data,
                secondaryCta: event.target.checked
                  ? (section.data.secondaryCta ?? {
                      label: "Learn more",
                      target: { kind: "page", path: pageSlug || "/" },
                    })
                  : undefined,
              })
            }
          />
          Show secondary button
        </label>
        {section.data.secondaryCta && (
          <>
            <Field
              label="Secondary button label"
              value={section.data.secondaryCta.label}
              onChange={(label) =>
                setData({
                  ...section.data,
                  secondaryCta: { ...section.data.secondaryCta!, label },
                })
              }
            />
            {renderTarget("Secondary button", section.data.secondaryCta.target, (target) =>
              setData({
                ...section.data,
                secondaryCta: { ...section.data.secondaryCta!, target },
              }),
            )}
          </>
        )}
      </div>
    );
  }
  if (section.type === "project-highlights") {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label="Section label"
          value={section.data.label}
          onChange={(label) => setData({ ...section.data, label })}
        />
        {relationPicker(
          "Featured projects",
          snapshot.projects.map(({ id, title }) => ({ id, label: title })),
          section.data.projectIds,
          (projectIds) => setData({ ...section.data, projectIds }),
        )}
      </div>
    );
  }
  if (section.type === "project-grid") {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {input("Eyebrow", "eyebrow")}
        {input("Heading", "title")}
        <div className="sm:col-span-2">{input("Description", "intro", true)}</div>
        {relationPicker(
          "Projects in this grid",
          snapshot.projects.map(({ id, title }) => ({ id, label: title })),
          section.data.projectIds,
          (projectIds) => setData({ ...section.data, projectIds }),
        )}
        {relationPicker(
          "Categories available in the filter",
          snapshot.categories.map(({ id, name }) => ({ id, label: name })),
          section.data.categoryIds,
          (categoryIds) => setData({ ...section.data, categoryIds }),
        )}
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">Layout</span>
          <select
            value={section.data.layout}
            onChange={(event) =>
              setData({ ...section.data, layout: event.target.value as typeof section.data.layout })
            }
            className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm"
          >
            <option value="grid">Grid</option>
            <option value="masonry">Masonry</option>
            <option value="editorial">Editorial</option>
          </select>
        </label>
      </div>
    );
  }
  if (
    section.type === "services" ||
    section.type === "experience" ||
    section.type === "process" ||
    section.type === "faqs"
  ) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {input("Eyebrow", "eyebrow")}
        {input("Heading", "title")}
        <div className="sm:col-span-2">{input("Introduction", "intro", true)}</div>
        <p className="text-xs text-muted-foreground sm:col-span-2">
          Connected content remains managed in its own workspace.
        </p>
        {section.type === "services" &&
          relationPicker(
            "Services included",
            snapshot.services.map(({ id, title }) => ({ id, label: title })),
            section.data.serviceIds,
            (serviceIds) => setData({ ...section.data, serviceIds }),
          )}
        {section.type === "experience" &&
          relationPicker(
            "Experience entries included",
            snapshot.experience.map(({ id, company, role }) => ({
              id,
              label: `${role} · ${company}`,
            })),
            section.data.experienceIds,
            (experienceIds) => setData({ ...section.data, experienceIds }),
          )}
        {section.type === "process" &&
          relationPicker(
            "Process steps included",
            snapshot.process.map(({ id, title }) => ({ id, label: title })),
            section.data.processStepIds,
            (processStepIds) => setData({ ...section.data, processStepIds }),
          )}
        {section.type === "faqs" &&
          relationPicker(
            "FAQs included",
            snapshot.faqs.map(({ id, q }) => ({ id, label: q })),
            section.data.faqIds,
            (faqIds) => setData({ ...section.data, faqIds }),
          )}
      </div>
    );
  }
  if (section.type === "profile") {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {input("Eyebrow", "eyebrow")}
        {input("Heading", "title")}
        <p className="text-xs text-muted-foreground sm:col-span-2">
          Profile content is linked to the existing profile record.
        </p>
      </div>
    );
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {input("Eyebrow", "eyebrow")}
      {input("Heading", "title")}
      <div className="sm:col-span-2">{input("Introduction", "intro", true)}</div>
    </div>
  );
}

export function PagesWorkspace({ snapshot, onChange }: PagesWorkspaceProps) {
  const [selectedId, setSelectedId] = useState(snapshot.pages[0]?.id ?? "");
  const [draftPage, setDraftPage] = useState<ContentSnapshot["pages"][number] | null>(null);
  const [addingPage, setAddingPage] = useState(false);
  const [addingSection, setAddingSection] = useState<(typeof sectionTypes)[number]>("hero");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const selectedPage = useMemo(
    () => snapshot.pages.find(({ id }) => id === selectedId) ?? null,
    [snapshot.pages, selectedId],
  );
  const pageDraft = draftPage;

  function updatePageDraft(
    update: (page: ContentSnapshot["pages"][number]) => ContentSnapshot["pages"][number],
  ) {
    if (pageDraft) setDraftPage(update(structuredClone(pageDraft)));
    setError("");
    setSuccess("");
  }

  function savePage() {
    if (!pageDraft) return;
    const currentPage = snapshot.pages.find(({ id }) => id === pageDraft.id);
    const currentSections = new Map(currentPage?.sections.map((section) => [section.id, section]));
    const mergedSections = pageDraft.sections.map((section) => {
      const current = currentSections.get(section.id);
      if (!current) return section;
      if (section.type === "project-highlights" && current.type === "project-highlights") {
        return { ...section, data: { ...section.data, projectIds: current.data.projectIds } };
      }
      if (section.type === "project-grid" && current.type === "project-grid") {
        return {
          ...section,
          data: {
            ...section.data,
            projectIds: current.data.projectIds,
            categoryIds: current.data.categoryIds,
          },
        };
      }
      return section;
    });
    const committedPage = {
      ...pageDraft,
      order: currentPage?.order ?? snapshot.pages.length,
      sections: mergedSections,
    };
    const pages = currentPage
      ? snapshot.pages.map((page) => (page.id === committedPage.id ? committedPage : page))
      : [...snapshot.pages, committedPage];
    const validation = contentSnapshotSchema.safeParse({ ...snapshot, pages });
    if (!validation.success) {
      setError(validation.error.issues[0]?.message ?? "Check the page fields and references.");
      setSuccess("");
      return;
    }
    onChange(validation.data);
    setSelectedId(pageDraft.id);
    setDraftPage(null);
    setAddingPage(false);
    setError("");
    setSuccess("Page changes are applied to the dashboard session. Save a draft to persist them.");
  }

  function startEditingPage() {
    if (!selectedPage) return;
    setDraftPage(structuredClone(selectedPage));
    setAddingPage(false);
    setError("");
    setSuccess("");
  }

  function discardPageDraft() {
    setDraftPage(null);
    setAddingPage(false);
    setSelectedId((id) =>
      snapshot.pages.some((page) => page.id === id) ? id : (snapshot.pages[0]?.id ?? ""),
    );
    setError("");
    setSuccess("Unsaved page changes were discarded.");
  }

  function selectPage(pageId: string) {
    if (draftPage && !window.confirm("Discard unsaved page changes and open another page?")) return;
    setSelectedId(pageId);
    setDraftPage(null);
    setAddingPage(false);
    setError("");
    setSuccess("");
  }

  function createPage() {
    if (draftPage && !window.confirm("Discard unsaved page changes and create a new page?")) return;
    const id = createId("page");
    let slugIndex = snapshot.pages.length + 1;
    while (snapshot.pages.some((page) => page.slug === `/new-page-${slugIndex}`)) slugIndex += 1;
    const slug = `/new-page-${slugIndex}`;
    setDraftPage({
      id,
      slug,
      title: "",
      order: snapshot.pages.length,
      sections: [],
      seo: createSeo("", slug),
    });
    setSelectedId(id);
    setAddingPage(true);
    setError("");
    setSuccess("");
  }

  function deletePage() {
    if (!selectedPage || !window.confirm(`Remove the page "${selectedPage.title}"?`)) return;
    const pages = snapshot.pages.filter(({ id }) => id !== selectedPage.id);
    const validation = contentSnapshotSchema.safeParse({ ...snapshot, pages });
    if (!validation.success) {
      setError("This page is referenced by other content and cannot be removed yet.");
      return;
    }
    onChange({ ...validation.data, pages: pages.map((page, order) => ({ ...page, order })) });
    setSelectedId(pages[0]?.id ?? "");
    setDraftPage(null);
    setError("");
    setSuccess("Page removed from the dashboard session.");
  }

  function reorderPage(pageId: string, delta: number) {
    const pages = [...snapshot.pages].sort((a, b) => a.order - b.order);
    const index = pages.findIndex(({ id }) => id === pageId);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= pages.length) return;
    [pages[index], pages[target]] = [pages[target]!, pages[index]!];
    const validation = contentSnapshotSchema.safeParse({
      ...snapshot,
      pages: pages.map((page, order) => ({ ...page, order })),
    });
    if (!validation.success) {
      setError(validation.error.issues[0]?.message ?? "Page order is invalid.");
      setSuccess("");
      return;
    }
    onChange(validation.data);
    setSuccess("Page order updated in the dashboard session.");
    setError("");
  }

  function updateSection(sectionId: string, update: (section: PageSection) => PageSection) {
    updatePageDraft((page) => ({
      ...page,
      sections: page.sections.map((section) =>
        section.id === sectionId ? update(section) : section,
      ),
    }));
  }

  function reorderSection(sectionId: string, delta: number) {
    updatePageDraft((page) => {
      const index = page.sections.findIndex(({ id }) => id === sectionId);
      const target = index + delta;
      if (index < 0 || target < 0 || target >= page.sections.length) return page;
      const sections = [...page.sections];
      [sections[index], sections[target]] = [sections[target]!, sections[index]!];
      return { ...page, sections: sections.map((section, order) => ({ ...section, order })) };
    });
  }

  function addSection() {
    if (!pageDraft) return;
    const next = createSection(addingSection, pageDraft.sections.length, pageDraft.slug);
    if (next.type === "profile") next.data.profileId = snapshot.profile.id;
    const validation = pageSectionSchema.safeParse(next);
    if (!validation.success) {
      setError(validation.error.issues[0]?.message ?? "The section could not be created.");
      setSuccess("");
      return;
    }
    setDraftPage({ ...pageDraft, sections: [...pageDraft.sections, validation.data] });
    setError("");
    setSuccess("Section added to the page draft. Save the page to apply it.");
  }

  const inputClass =
    "w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";
  const orderedPages = [...snapshot.pages].sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-sm text-muted-foreground">Structure and content</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Pages</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Arrange page sections and edit supported page-level content in this temporary demo.
          </p>
        </div>
        <button
          type="button"
          onClick={createPage}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          <FilePlus2 aria-hidden="true" className="h-4 w-4" />
          Add page
        </button>
      </header>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/40 bg-card px-4 py-3 text-sm text-destructive"
        >
          {error}
        </div>
      )}
      {success && (
        <p
          role="status"
          className="rounded-lg border border-success/30 bg-success/5 px-4 py-3 text-sm text-success"
        >
          {success}
        </p>
      )}

      {snapshot.pages.length === 0 && !addingPage ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/60 p-10 text-center">
          <FilePlus2 aria-hidden="true" className="mx-auto h-8 w-8 text-muted-foreground" />
          <h2 className="mt-4 text-lg font-semibold">No pages yet</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Create a page to start building your page structure.
          </p>
          <button
            type="button"
            onClick={createPage}
            className="mt-5 rounded-lg border border-border px-4 py-2 text-sm hover:bg-accent"
          >
            Create first page
          </button>
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[270px_minmax(0,1fr)]">
          <aside className="h-fit rounded-2xl border border-border bg-card p-3">
            <div className="flex items-center justify-between px-2 py-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Site pages
              </span>
              <span className="text-xs text-muted-foreground">{snapshot.pages.length}</span>
            </div>
            <div className="mt-2 space-y-1">
              {orderedPages.map((page, index) => (
                <div
                  key={page.id}
                  className={`flex items-center gap-1 rounded-xl p-1 ${selectedId === page.id ? "bg-accent" : ""}`}
                >
                  <button
                    type="button"
                    onClick={() => selectPage(page.id)}
                    className="min-w-0 flex-1 px-2 py-2 text-left"
                  >
                    <span className="block truncate text-sm font-medium">
                      {page.title || "Untitled page"}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {page.slug}
                    </span>
                  </button>
                  <button
                    type="button"
                    aria-label={`Move ${page.title || "page"} up`}
                    disabled={index === 0}
                    onClick={() => reorderPage(page.id, -1)}
                    className="rounded p-1.5 text-muted-foreground hover:bg-background disabled:opacity-30"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Move ${page.title || "page"} down`}
                    disabled={index === orderedPages.length - 1}
                    onClick={() => {
                      reorderPage(page.id, 1);
                    }}
                    className="rounded p-1.5 text-muted-foreground hover:bg-background disabled:opacity-30"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              {addingPage && (
                <p className="rounded-xl bg-primary/10 px-3 py-3 text-sm font-medium text-primary">
                  New page draft
                </p>
              )}
            </div>
          </aside>

          {pageDraft ? (
            <div className="space-y-5">
              <section
                aria-label={addingPage ? "Create page details" : "Edit page details"}
                className="rounded-2xl border border-border bg-card p-5 sm:p-7"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {addingPage ? "Create page" : "Edit page"}
                    </p>
                    <h2 className="mt-1 text-xl font-semibold">{pageDraft.title || "New page"}</h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Unsaved edits stay here while you visit another workspace.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {!addingPage && (
                      <button
                        type="button"
                        onClick={deletePage}
                        className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Remove
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={discardPageDraft}
                      className="rounded-lg border border-border px-3 py-2 text-xs hover:bg-accent"
                    >
                      Cancel changes
                    </button>
                    <button
                      type="button"
                      onClick={savePage}
                      className="rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground"
                    >
                      Apply changes
                    </button>
                  </div>
                </div>
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <Field
                    label="Page title"
                    value={pageDraft.title}
                    onChange={(title) => updatePageDraft((page) => ({ ...page, title }))}
                  />
                  <Field
                    label="Path / slug"
                    value={pageDraft.slug}
                    onChange={(slug) =>
                      updatePageDraft((page) => ({
                        ...page,
                        slug,
                        seo: { ...page.seo, canonicalPath: slug },
                      }))
                    }
                  />
                  <Field
                    label="SEO title"
                    value={pageDraft.seo.title}
                    onChange={(title) =>
                      updatePageDraft((page) => ({ ...page, seo: { ...page.seo, title } }))
                    }
                  />
                  <Field
                    label="SEO description"
                    value={pageDraft.seo.description}
                    multiline
                    onChange={(description) =>
                      updatePageDraft((page) => ({ ...page, seo: { ...page.seo, description } }))
                    }
                  />
                  <Field
                    label="Canonical path"
                    value={pageDraft.seo.canonicalPath ?? ""}
                    onChange={(canonicalPath) =>
                      updatePageDraft((page) => ({
                        ...page,
                        seo: { ...page.seo, canonicalPath },
                      }))
                    }
                  />
                  <Field
                    label="Open Graph title"
                    value={pageDraft.seo.social.openGraphTitle}
                    onChange={(openGraphTitle) =>
                      updatePageDraft((page) => ({
                        ...page,
                        seo: {
                          ...page.seo,
                          social: { ...page.seo.social, openGraphTitle },
                        },
                      }))
                    }
                  />
                  <Field
                    label="Open Graph description"
                    value={pageDraft.seo.social.openGraphDescription}
                    multiline
                    onChange={(openGraphDescription) =>
                      updatePageDraft((page) => ({
                        ...page,
                        seo: {
                          ...page.seo,
                          social: { ...page.seo.social, openGraphDescription },
                        },
                      }))
                    }
                  />
                  <Field
                    label="Twitter title"
                    value={pageDraft.seo.social.twitterTitle}
                    onChange={(twitterTitle) =>
                      updatePageDraft((page) => ({
                        ...page,
                        seo: {
                          ...page.seo,
                          social: { ...page.seo.social, twitterTitle },
                        },
                      }))
                    }
                  />
                  <Field
                    label="Twitter description"
                    value={pageDraft.seo.social.twitterDescription}
                    multiline
                    onChange={(twitterDescription) =>
                      updatePageDraft((page) => ({
                        ...page,
                        seo: {
                          ...page.seo,
                          social: { ...page.seo.social, twitterDescription },
                        },
                      }))
                    }
                  />
                  <label className="block space-y-1.5">
                    <span className="text-xs font-medium text-muted-foreground">
                      Open Graph image · existing media
                    </span>
                    <select
                      aria-label="Page social image"
                      value={pageDraft.seo.social.openGraphImage?.mediaId ?? ""}
                      onChange={(event) => {
                        const asset = snapshot.media.find(({ id }) => id === event.target.value);
                        updatePageDraft((page) => ({
                          ...page,
                          seo: {
                            ...page.seo,
                            social: {
                              ...page.seo.social,
                              openGraphImage: asset
                                ? { mediaId: asset.id, alt: asset.alt }
                                : undefined,
                            },
                          },
                        }));
                      }}
                      className={inputClass}
                    >
                      <option value="">No social image</option>
                      {snapshot.media.map((asset) => (
                        <option key={asset.id} value={asset.id}>
                          {asset.caption || asset.alt || asset.id}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block space-y-1.5">
                    <span className="text-xs font-medium text-muted-foreground">
                      Twitter image · existing media
                    </span>
                    <select
                      aria-label="Page Twitter image"
                      value={pageDraft.seo.social.twitterImage?.mediaId ?? ""}
                      onChange={(event) => {
                        const asset = snapshot.media.find(({ id }) => id === event.target.value);
                        updatePageDraft((page) => ({
                          ...page,
                          seo: {
                            ...page.seo,
                            social: {
                              ...page.seo.social,
                              twitterImage: asset
                                ? { mediaId: asset.id, alt: asset.alt }
                                : undefined,
                            },
                          },
                        }));
                      }}
                      className={inputClass}
                    >
                      <option value="">No Twitter image</option>
                      {snapshot.media.map((asset) => (
                        <option key={asset.id} value={asset.id}>
                          {asset.caption || asset.alt || asset.id}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex items-center gap-2 text-sm text-muted-foreground sm:col-span-2">
                    <input
                      type="checkbox"
                      checked={pageDraft.seo.robots.index}
                      onChange={(event) =>
                        updatePageDraft((page) => ({
                          ...page,
                          seo: {
                            ...page.seo,
                            robots: { ...page.seo.robots, index: event.target.checked },
                          },
                        }))
                      }
                    />
                    Allow search engines to index this page
                  </label>
                  <label className="flex items-center gap-2 text-sm text-muted-foreground sm:col-span-2">
                    <input
                      type="checkbox"
                      checked={pageDraft.seo.robots.follow}
                      onChange={(event) =>
                        updatePageDraft((page) => ({
                          ...page,
                          seo: {
                            ...page.seo,
                            robots: { ...page.seo.robots, follow: event.target.checked },
                          },
                        }))
                      }
                    />
                    Allow search engines to follow links
                  </label>
                </div>
              </section>

              <section className="rounded-2xl border border-border bg-card p-5 sm:p-7">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Visual page structure
                    </p>
                    <h2 className="mt-1 text-xl font-semibold">
                      Sections{" "}
                      <span className="text-sm font-normal text-muted-foreground">
                        ({pageDraft.sections.length})
                      </span>
                    </h2>
                  </div>
                  <div className="flex gap-2">
                    <select
                      aria-label="Section type"
                      value={addingSection}
                      onChange={(event) =>
                        setAddingSection(event.target.value as (typeof sectionTypes)[number])
                      }
                      className={`${inputClass} w-auto`}
                    >
                      {sectionTypes.map((type) => (
                        <option key={type} value={type}>
                          {type.replaceAll("-", " ")}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={addSection}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm hover:bg-accent"
                    >
                      <Plus className="h-4 w-4" />
                      Add section
                    </button>
                  </div>
                </div>
                {pageDraft.sections.length === 0 ? (
                  <div className="mt-5 rounded-xl border border-dashed border-border p-8 text-center">
                    <Layers3 aria-hidden="true" className="mx-auto h-7 w-7 text-muted-foreground" />
                    <p className="mt-3 text-sm font-medium">This page has no sections</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Add a section to begin the page layout.
                    </p>
                  </div>
                ) : (
                  <ol className="mt-5 space-y-3">
                    {pageDraft.sections.map((section, index) => (
                      <li
                        key={section.id}
                        className="rounded-xl border border-border bg-background/50"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
                          <div className="flex items-center gap-3">
                            <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent text-xs font-semibold">
                              {String(index + 1).padStart(2, "0")}
                            </span>
                            <div>
                              <p className="text-sm font-medium capitalize">
                                {section.type.replaceAll("-", " ")}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {section.visible ? "Visible in preview" : "Hidden from preview"}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              aria-label={`Move section ${index + 1} up`}
                              disabled={index === 0}
                              onClick={() => reorderSection(section.id, -1)}
                              className="rounded-lg p-2 text-muted-foreground hover:bg-accent disabled:opacity-30"
                            >
                              <ArrowUp className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              aria-label={`Move section ${index + 1} down`}
                              disabled={index === pageDraft.sections.length - 1}
                              onClick={() => reorderSection(section.id, 1)}
                              className="rounded-lg p-2 text-muted-foreground hover:bg-accent disabled:opacity-30"
                            >
                              <ArrowDown className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              aria-label={section.visible ? "Hide section" : "Show section"}
                              onClick={() =>
                                updateSection(section.id, (current) => ({
                                  ...current,
                                  visible: !current.visible,
                                }))
                              }
                              className="rounded-lg p-2 text-muted-foreground hover:bg-accent"
                            >
                              {section.visible ? (
                                <Eye className="h-4 w-4" />
                              ) : (
                                <EyeOff className="h-4 w-4" />
                              )}
                            </button>
                            <button
                              type="button"
                              aria-label="Remove section"
                              onClick={() => {
                                if (
                                  window.confirm("Remove this section from the local page draft?")
                                )
                                  updatePageDraft((page) => ({
                                    ...page,
                                    sections: page.sections
                                      .filter(({ id }) => id !== section.id)
                                      .map((item, order) => ({ ...item, order })),
                                  }));
                              }}
                              className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                        <div className="p-4">
                          <SectionFields
                            section={section}
                            snapshot={snapshot}
                            pageSlug={pageDraft.slug}
                            pageSections={pageDraft.sections}
                            onChange={(next) => updateSection(section.id, () => next)}
                          />
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            </div>
          ) : selectedPage ? (
            <section className="rounded-2xl border border-border bg-card p-6 sm:p-8">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Selected page
              </p>
              <h2 className="mt-2 text-2xl font-semibold">{selectedPage.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{selectedPage.slug}</p>
              <p className="mt-5 text-sm text-muted-foreground">
                {selectedPage.sections.length} ordered sections · SEO{" "}
                {selectedPage.seo.title ? "configured" : "not configured"}
              </p>
              <button
                type="button"
                onClick={startEditingPage}
                className="mt-6 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground"
              >
                Edit page
              </button>
            </section>
          ) : null}
        </div>
      )}
      <p
        role={draftPage ? "status" : undefined}
        className="text-center text-xs text-muted-foreground"
      >
        {draftPage
          ? "Unsaved page edits remain in this workspace until applied or canceled."
          : "Applied changes remain in the dashboard session until you save a CMS draft."}
      </p>
    </div>
  );
}
