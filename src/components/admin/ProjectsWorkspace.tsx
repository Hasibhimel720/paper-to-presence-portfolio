import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Eye,
  EyeOff,
  Plus,
  Search,
  Star,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  caseStudySectionSchema,
  contentSnapshotSchema,
  projectRecordSchema,
  type ContentSnapshot,
} from "@/lib/cms/schema";
import { uploadCmsMediaFile, useCmsMediaUrls, validateCmsImageFile } from "@/lib/cms/media-storage";

type CmsProject = ContentSnapshot["projects"][number];

type ProjectsWorkspaceProps = {
  snapshot: ContentSnapshot;
  onChange: (snapshot: ContentSnapshot) => void;
  cmsEnabled?: boolean;
};

function createId() {
  return `project:${crypto.randomUUID()}`;
}

function createProject(snapshot: ContentSnapshot): CmsProject {
  const category = snapshot.categories[0];
  if (!category) throw new Error("Add a supported category before creating a project.");
  return {
    id: createId(),
    order: snapshot.projects.length,
    slug: "",
    title: "",
    categoryId: category.id,
    category: category.name,
    type: "",
    description: "",
    tone: "ink",
    gallery: [],
    placeholder: "Preview · no supplied cover",
    sections: [],
    visible: true,
  };
}

function imageForProject(
  project: CmsProject,
  snapshot: ContentSnapshot,
  mediaUrls: Record<string, string>,
) {
  if (project.cover) return project.cover;
  const coverAsset = project.coverMedia
    ? snapshot.media.find(({ id }) => id === project.coverMedia?.mediaId)
    : undefined;
  return coverAsset ? mediaUrls[coverAsset.id] : undefined;
}

export function ProjectsWorkspace({
  snapshot,
  onChange,
  cmsEnabled = false,
}: ProjectsWorkspaceProps) {
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<CmsProject | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState("");
  const [uploadAlt, setUploadAlt] = useState("");
  const [uploadBusy, setUploadBusy] = useState(false);
  const mediaUrls = useCmsMediaUrls(snapshot.media);

  useEffect(
    () => () => {
      if (uploadPreview) URL.revokeObjectURL(uploadPreview);
    },
    [uploadPreview],
  );

  const visibleProjects = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return [...snapshot.projects]
      .sort((a, b) => a.order - b.order)
      .filter((project) => categoryFilter === "all" || project.categoryId === categoryFilter)
      .filter(
        (project) =>
          !normalizedQuery ||
          `${project.title} ${project.slug} ${project.category} ${project.type}`
            .toLowerCase()
            .includes(normalizedQuery),
      );
  }, [snapshot.projects, categoryFilter, query]);

  function startCreate() {
    if (draft && !window.confirm("Discard the current unsaved project draft?")) return;
    try {
      clearProjectUpload();
      setDraft(createProject(snapshot));
      setEditingId(null);
      setError("");
      setSuccess("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to start a project draft.");
    }
  }

  function startEdit(project: CmsProject) {
    if (draft && !window.confirm("Discard the current unsaved project draft?")) return;
    clearProjectUpload();
    setDraft(structuredClone(project));
    setEditingId(project.id);
    setError("");
    setSuccess("");
  }

  function applySnapshot(candidate: unknown, successMessage: string) {
    const validation = contentSnapshotSchema.safeParse(candidate);
    if (!validation.success) {
      setError(validation.error.issues[0]?.message ?? "The change failed CMS validation.");
      setSuccess("");
      return false;
    }
    onChange(validation.data);
    setError("");
    setSuccess(successMessage);
    return true;
  }

  function saveProject() {
    if (!draft) return;
    const projectValidation = projectRecordSchema.safeParse(draft);
    if (!projectValidation.success) {
      setError(
        projectValidation.error.issues[0]?.message ?? "Complete the required project fields.",
      );
      setSuccess("");
      return;
    }

    const projects = editingId
      ? snapshot.projects.map((project) =>
          project.id === editingId ? projectValidation.data : project,
        )
      : [...snapshot.projects, { ...projectValidation.data, order: snapshot.projects.length }];
    const pages = editingId
      ? snapshot.pages
      : addToHomepageGrid(snapshot, projectValidation.data.id);
    if (
      !applySnapshot(
        { ...snapshot, projects, pages },
        editingId
          ? "Project changes applied to the dashboard session."
          : "Project added to the dashboard session.",
      )
    )
      return;
    setDraft(null);
    setEditingId(null);
  }

  function addToHomepageGrid(current: ContentSnapshot, projectId: string) {
    const home = current.pages.find(({ slug }) => slug === "/");
    if (!home) return current.pages;
    let added = false;
    return current.pages.map((page) =>
      page.id !== home.id
        ? page
        : {
            ...page,
            sections: page.sections.map((section) => {
              if (!added && section.type === "project-grid") {
                added = true;
                return {
                  ...section,
                  data: { ...section.data, projectIds: [...section.data.projectIds, projectId] },
                };
              }
              return section;
            }),
          },
    );
  }

  function changeProject(update: (project: CmsProject) => CmsProject) {
    setDraft((current) => (current ? update(current) : current));
    setError("");
    setSuccess("");
  }

  function clearProjectUpload() {
    setUploadFile(null);
    setUploadPreview("");
    setUploadAlt("");
  }

  function chooseProjectImage(file: File | undefined) {
    if (!file) return;
    const validationError = validateCmsImageFile(file);
    if (validationError) {
      setError(validationError);
      setSuccess("");
      setUploadFile(null);
      setUploadPreview("");
      return;
    }
    setUploadFile(file);
    setUploadPreview(URL.createObjectURL(file));
    setUploadAlt(draft?.coverMedia?.alt || draft?.title || "");
    setError("");
    setSuccess("");
  }

  async function uploadProjectImage() {
    if (!draft || !uploadFile) return;
    setUploadBusy(true);
    setError("");
    try {
      const asset = await uploadCmsMediaFile(uploadFile, {
        alt: uploadAlt.trim() || draft.title,
        caption: draft.title,
      });
      const nextSnapshot = {
        ...snapshot,
        media: [asset, ...snapshot.media.filter(({ id }) => id !== asset.id)],
      };
      const successMessage =
        "Image uploaded to the media library and selected as this project's cover. Apply project changes, then save the draft.";
      if (applySnapshot(nextSnapshot, successMessage)) {
        changeProject((project) => ({
          ...project,
          cover: undefined,
          coverMedia: { mediaId: asset.id, alt: asset.alt },
        }));
        setSuccess(successMessage);
        clearProjectUpload();
      }
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "The project image could not be uploaded.",
      );
      setSuccess("");
    } finally {
      setUploadBusy(false);
    }
  }

  function moveGalleryItem(index: number, direction: -1 | 1) {
    changeProject((project) => {
      const target = index + direction;
      if (target < 0 || target >= project.gallery.length) return project;
      const gallery = [...project.gallery];
      [gallery[index], gallery[target]] = [gallery[target]!, gallery[index]!];
      return { ...project, gallery };
    });
  }

  function toggleFeatured(projectId: string) {
    const featuredProjectIds = snapshot.featuredProjectIds.includes(projectId)
      ? snapshot.featuredProjectIds.filter((id) => id !== projectId)
      : [...snapshot.featuredProjectIds, projectId];
    const featured = featuredProjectIds.includes(projectId);
    applySnapshot(
      { ...snapshot, featuredProjectIds },
      featured ? "Project marked as featured." : "Project removed from featured work.",
    );
  }

  function toggleVisibility(projectId: string) {
    const projects = snapshot.projects.map((project) =>
      project.id === projectId ? { ...project, visible: !project.visible } : project,
    );
    const project = projects.find(({ id }) => id === projectId);
    applySnapshot(
      { ...snapshot, projects },
      project?.visible
        ? "Project is visible in the dashboard session."
        : "Project hidden in the dashboard session.",
    );
  }

  function moveProject(projectId: string, delta: number) {
    const projects = [...snapshot.projects].sort((a, b) => a.order - b.order);
    const index = projects.findIndex(({ id }) => id === projectId);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= projects.length) return;
    [projects[index], projects[target]] = [projects[target]!, projects[index]!];
    applySnapshot(
      { ...snapshot, projects: projects.map((project, order) => ({ ...project, order })) },
      "Project order updated in the dashboard session.",
    );
  }

  function removeProject(project: CmsProject) {
    if (!window.confirm(`Remove "${project.title}"?`)) return;
    const projectIds = new Set([project.id]);
    const projects = snapshot.projects
      .filter(({ id }) => id !== project.id)
      .map((item, order) => ({ ...item, order }));
    const pages = snapshot.pages.map((page) => ({
      ...page,
      sections: page.sections.map((section) => {
        if (section.type === "project-highlights" || section.type === "project-grid") {
          return {
            ...section,
            data: {
              ...section.data,
              projectIds: section.data.projectIds.filter((id) => !projectIds.has(id)),
            },
          };
        }
        return section;
      }),
    }));
    const next = {
      ...snapshot,
      projects,
      pages,
      featuredProjectIds: snapshot.featuredProjectIds.filter((id) => !projectIds.has(id)),
    };
    if (!applySnapshot(next, "Project removed from the dashboard session.")) return;
    if (editingId === project.id) {
      setDraft(null);
      setEditingId(null);
    }
  }

  function addCaseStudySection() {
    if (!draft) return;
    const section = caseStudySectionSchema.safeParse({
      id: `case-section:${crypto.randomUUID()}`,
      order: draft.sections.length,
      title: "New case-study section",
      body: "",
      media: [],
    });
    if (!section.success) {
      setError(section.error.issues[0]?.message ?? "The case-study section is invalid.");
      return;
    }
    changeProject((project) => ({ ...project, sections: [...project.sections, section.data] }));
  }

  function moveCaseStudySection(sectionId: string, delta: number) {
    if (!draft) return;
    const sections = [...draft.sections].sort((a, b) => a.order - b.order);
    const index = sections.findIndex(({ id }) => id === sectionId);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= sections.length) return;
    [sections[index], sections[target]] = [sections[target]!, sections[index]!];
    changeProject((project) => ({
      ...project,
      sections: sections.map((section, order) => ({ ...section, order })),
    }));
  }

  function removeCaseStudySection(sectionId: string) {
    const section = draft?.sections.find(({ id }) => id === sectionId);
    if (!section || !window.confirm(`Remove "${section.title}" from this project draft?`)) return;
    changeProject((project) => ({
      ...project,
      sections: project.sections
        .filter(({ id }) => id !== sectionId)
        .map((item, order) => ({ ...item, order })),
    }));
  }

  const imageOptions = snapshot.media;
  const draftCoverPreview = draft
    ? (draft.cover ?? imageForProject(draft, snapshot, mediaUrls.urls))
    : undefined;
  const inputClass =
    "w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-sm text-muted-foreground">Portfolio content</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Projects</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Curate project details, supplied imagery, visibility, ordering, and featured work.
          </p>
        </div>
        <button
          type="button"
          onClick={startCreate}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          <Plus aria-hidden="true" className="h-4 w-4" />
          New project
        </button>
      </header>

      {mediaUrls.error && (
        <p
          role="alert"
          className="rounded-lg border border-destructive/40 bg-card p-3 text-sm text-destructive"
        >
          {mediaUrls.error}
        </p>
      )}

      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Search projects</span>
          <Search
            aria-hidden="true"
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search title, slug, category…"
            className={`${inputClass} pl-9`}
          />
        </label>
        <label>
          <span className="sr-only">Filter by category</span>
          <select
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
            className={`${inputClass} sm:w-56`}
          >
            <option value="all">All categories</option>
            {snapshot.categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-center px-1 text-xs text-muted-foreground">
          {visibleProjects.length} of {snapshot.projects.length} projects
        </div>
      </div>

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

      {draft && (
        <section
          aria-label={editingId ? "Edit project" : "Create project"}
          className="rounded-2xl border border-primary/30 bg-card p-5 sm:p-7"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {editingId ? "Project details" : "New local project draft"}
              </p>
              <h2 className="mt-1 text-xl font-semibold">{draft.title || "Untitled project"}</h2>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setDraft(null);
                  setEditingId(null);
                  clearProjectUpload();
                  setError("");
                  setSuccess("Unsaved project edits were discarded.");
                }}
                className="rounded-lg border border-border px-3 py-2 text-xs hover:bg-accent"
              >
                Discard
              </button>
              <button
                type="button"
                onClick={saveProject}
                className="rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground"
              >
                Apply changes
              </button>
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(260px,0.7fr)]">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">Project title *</span>
                <input
                  value={draft.title}
                  onChange={(event) =>
                    changeProject((project) => ({ ...project, title: event.target.value }))
                  }
                  className={inputClass}
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">URL slug *</span>
                <input
                  value={draft.slug}
                  onChange={(event) =>
                    changeProject((project) => ({ ...project, slug: event.target.value }))
                  }
                  placeholder="lowercase-with-hyphens"
                  className={inputClass}
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">Category *</span>
                <select
                  value={draft.categoryId}
                  onChange={(event) => {
                    const category = snapshot.categories.find(
                      ({ id }) => id === event.target.value,
                    );
                    if (category)
                      changeProject((project) => ({
                        ...project,
                        categoryId: category.id,
                        category: category.name,
                      }));
                  }}
                  className={inputClass}
                >
                  {snapshot.categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">Project type *</span>
                <input
                  value={draft.type}
                  onChange={(event) =>
                    changeProject((project) => ({ ...project, type: event.target.value }))
                  }
                  className={inputClass}
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">Year</span>
                <input
                  value={draft.year ?? ""}
                  onChange={(event) =>
                    changeProject((project) => ({
                      ...project,
                      year: event.target.value || undefined,
                    }))
                  }
                  className={inputClass}
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">Visual tone</span>
                <select
                  value={draft.tone}
                  onChange={(event) =>
                    changeProject((project) => ({
                      ...project,
                      tone: event.target.value as CmsProject["tone"],
                    }))
                  }
                  className={inputClass}
                >
                  {["tea", "ghee", "black", "lentil", "steel", "gold", "ink", "motion"].map(
                    (tone) => (
                      <option key={tone} value={tone}>
                        {tone}
                      </option>
                    ),
                  )}
                </select>
              </label>
              <label className="block space-y-1.5 sm:col-span-2">
                <span className="text-xs font-medium text-muted-foreground">Description</span>
                <textarea
                  rows={3}
                  value={draft.description}
                  onChange={(event) =>
                    changeProject((project) => ({ ...project, description: event.target.value }))
                  }
                  className={`${inputClass} resize-y`}
                />
              </label>
              <label className="block space-y-1.5 sm:col-span-2">
                <span className="text-xs font-medium text-muted-foreground">
                  External case study URL (optional)
                </span>
                <input
                  type="url"
                  value={draft.behance ?? ""}
                  onChange={(event) =>
                    changeProject((project) => ({
                      ...project,
                      behance: event.target.value || undefined,
                    }))
                  }
                  className={inputClass}
                />
              </label>
              <label className="block space-y-1.5 sm:col-span-2">
                <span className="text-xs font-medium text-muted-foreground">
                  Project palette · comma-separated color tokens
                </span>
                <input
                  aria-label="Project palette"
                  value={draft.palette?.join(", ") ?? ""}
                  onChange={(event) =>
                    changeProject((project) => ({
                      ...project,
                      palette: event.target.value
                        .split(",")
                        .map((color) => color.trim())
                        .filter(Boolean),
                    }))
                  }
                  placeholder="e.g. #1f2937, #f8fafc"
                  className={inputClass}
                />
              </label>
            </div>

            <div className="space-y-4">
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">
                  Cover image from existing media
                </span>
                <select
                  value={draft.coverMedia?.mediaId ?? ""}
                  onChange={(event) => {
                    const asset = imageOptions.find(({ id }) => id === event.target.value);
                    changeProject((project) =>
                      asset
                        ? {
                            ...project,
                            cover: asset.source.kind === "url" ? asset.source.url : undefined,
                            coverMedia: { mediaId: asset.id, alt: asset.alt },
                          }
                        : { ...project, cover: undefined, coverMedia: undefined },
                    );
                  }}
                  className={inputClass}
                >
                  <option value="">No cover image</option>
                  {imageOptions.map((asset) => (
                    <option key={asset.id} value={asset.id}>
                      {asset.caption || asset.alt || asset.id}
                    </option>
                  ))}
                </select>
              </label>
              <div className="rounded-xl border border-border bg-background p-3">
                {draftCoverPreview ? (
                  <img
                    src={draftCoverPreview}
                    alt={draft.coverMedia?.alt ?? ""}
                    className="aspect-[16/9] w-full rounded-lg object-cover"
                  />
                ) : (
                  <div className="grid aspect-[16/9] place-items-center rounded-lg border border-dashed border-border text-center text-xs text-muted-foreground">
                    No supplied cover selected
                    <br />
                    Preview placeholder only
                  </div>
                )}
              </div>
              <div className="space-y-3 rounded-xl border border-border bg-background p-3">
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-muted-foreground">
                    Upload a project cover image
                  </span>
                  <input
                    aria-label="Upload project image"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/avif"
                    onChange={(event) => chooseProjectImage(event.currentTarget.files?.[0])}
                    disabled={!cmsEnabled || uploadBusy}
                    className="block w-full text-xs file:mr-3 file:rounded-md file:border-0 file:bg-accent file:px-3 file:py-2 file:text-xs file:font-medium"
                  />
                </label>
                {cmsEnabled && uploadPreview && uploadFile && (
                  <>
                    <img
                      src={uploadPreview}
                      alt="Selected project image preview"
                      className="aspect-[16/9] w-full rounded-lg object-cover"
                    />
                    <label className="block space-y-1.5">
                      <span className="text-xs font-medium text-muted-foreground">
                        Image alt text
                      </span>
                      <input
                        aria-label="Project image alt text"
                        value={uploadAlt}
                        onChange={(event) => setUploadAlt(event.target.value)}
                        className={inputClass}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={uploadProjectImage}
                      disabled={uploadBusy}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground disabled:cursor-wait disabled:opacity-60"
                    >
                      <Upload aria-hidden="true" className="h-4 w-4" />
                      {uploadBusy ? "Uploading image…" : "Upload and use as cover"}
                    </button>
                  </>
                )}
                <p className="text-xs text-muted-foreground">
                  {cmsEnabled
                    ? "Uploads are added to shared media. Apply project changes, then save a draft to retain the project reference."
                    : "Project image uploads require the connected CMS. Demo mode can select existing media but cannot upload files."}
                </p>
              </div>
              <fieldset className="rounded-xl border border-border p-3">
                <legend className="px-1 text-xs font-medium text-muted-foreground">
                  Gallery images · reorderable
                </legend>
                <div className="mt-1 max-h-40 space-y-2 overflow-auto">
                  {imageOptions.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No media records are available.</p>
                  ) : (
                    imageOptions.map((asset) => {
                      const checked = draft.gallery.some(({ mediaId }) => mediaId === asset.id);
                      return (
                        <label
                          key={asset.id}
                          className="flex cursor-pointer items-center gap-2 text-xs"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(event) =>
                              changeProject((project) => ({
                                ...project,
                                gallery: event.target.checked
                                  ? [...project.gallery, { mediaId: asset.id, alt: asset.alt }]
                                  : project.gallery.filter(({ mediaId }) => mediaId !== asset.id),
                              }))
                            }
                          />
                          <span className="truncate">{asset.caption || asset.alt || asset.id}</span>
                        </label>
                      );
                    })
                  )}
                </div>
                {draft.gallery.length > 0 && (
                  <ol
                    aria-label="Gallery order"
                    className="mt-3 space-y-2 border-t border-border pt-3"
                  >
                    {draft.gallery.map((reference, index) => {
                      const asset = imageOptions.find(({ id }) => id === reference.mediaId);
                      const label = asset?.caption || asset?.alt || reference.mediaId;
                      return (
                        <li
                          key={reference.mediaId}
                          className="flex items-center justify-between gap-2 text-xs"
                        >
                          <span className="truncate">
                            {index + 1}. {label}
                          </span>
                          <span className="flex shrink-0 gap-1">
                            <button
                              type="button"
                              aria-label={`Move ${label} up`}
                              disabled={index === 0}
                              onClick={() => moveGalleryItem(index, -1)}
                              className="rounded border border-border p-1 disabled:opacity-40"
                            >
                              <ArrowUp className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              aria-label={`Move ${label} down`}
                              disabled={index === draft.gallery.length - 1}
                              onClick={() => moveGalleryItem(index, 1)}
                              className="rounded border border-border p-1 disabled:opacity-40"
                            >
                              <ArrowDown className="h-3.5 w-3.5" />
                            </button>
                          </span>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </fieldset>
            </div>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Select or replace cover and gallery images from the shared media library. Save a draft
            before publishing content changes.
          </p>
          <section className="mt-5 rounded-xl border border-border p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold">Case-study content</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Add ordered narrative sections and attach existing media.
                </p>
              </div>
              <button
                type="button"
                onClick={addCaseStudySection}
                className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs hover:bg-accent"
              >
                <Plus className="h-4 w-4" />
                Add detail
              </button>
            </div>
            {draft.sections.length === 0 ? (
              <p className="mt-3 rounded-lg border border-dashed border-border p-4 text-xs text-muted-foreground">
                No case-study details yet.
              </p>
            ) : (
              <ol className="mt-4 space-y-3">
                {[...draft.sections]
                  .sort((a, b) => a.order - b.order)
                  .map((section, index) => (
                    <li
                      key={section.id}
                      className="rounded-lg border border-border bg-background/50 p-3"
                    >
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-muted-foreground">
                          Detail {index + 1}
                        </span>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            aria-label={`Move case-study detail ${index + 1} up`}
                            disabled={index === 0}
                            onClick={() => moveCaseStudySection(section.id, -1)}
                            className="rounded p-1.5 hover:bg-accent disabled:opacity-30"
                          >
                            <ArrowUp className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            aria-label={`Move case-study detail ${index + 1} down`}
                            disabled={index === draft.sections.length - 1}
                            onClick={() => moveCaseStudySection(section.id, 1)}
                            className="rounded p-1.5 hover:bg-accent disabled:opacity-30"
                          >
                            <ArrowDown className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            aria-label={`Remove case-study detail ${index + 1}`}
                            onClick={() => removeCaseStudySection(section.id)}
                            className="rounded p-1.5 text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="block space-y-1">
                          <span className="text-xs text-muted-foreground">Section title</span>
                          <input
                            aria-label={`Case-study detail ${index + 1} title`}
                            value={section.title}
                            onChange={(event) =>
                              changeProject((project) => ({
                                ...project,
                                sections: project.sections.map((item) =>
                                  item.id === section.id
                                    ? { ...item, title: event.target.value }
                                    : item,
                                ),
                              }))
                            }
                            className={inputClass}
                          />
                        </label>
                        <label className="block space-y-1 sm:col-span-2">
                          <span className="text-xs text-muted-foreground">Section narrative</span>
                          <textarea
                            aria-label={`Case-study detail ${index + 1} narrative`}
                            rows={3}
                            value={section.body}
                            onChange={(event) =>
                              changeProject((project) => ({
                                ...project,
                                sections: project.sections.map((item) =>
                                  item.id === section.id
                                    ? { ...item, body: event.target.value }
                                    : item,
                                ),
                              }))
                            }
                            className={`${inputClass} resize-y`}
                          />
                        </label>
                        <label className="block space-y-1 sm:col-span-2">
                          <span className="text-xs text-muted-foreground">Visual note</span>
                          <input
                            aria-label={`Case-study detail ${index + 1} visual note`}
                            value={section.visual ?? ""}
                            onChange={(event) =>
                              changeProject((project) => ({
                                ...project,
                                sections: project.sections.map((item) =>
                                  item.id === section.id
                                    ? { ...item, visual: event.target.value || undefined }
                                    : item,
                                ),
                              }))
                            }
                            className={inputClass}
                          />
                        </label>
                        {imageOptions.length > 0 && (
                          <fieldset className="rounded-lg border border-border p-3 sm:col-span-2">
                            <legend className="px-1 text-xs text-muted-foreground">
                              Existing media
                            </legend>
                            <div className="grid gap-2 sm:grid-cols-2">
                              {imageOptions.map((asset) => (
                                <label key={asset.id} className="flex items-center gap-2 text-xs">
                                  <input
                                    type="checkbox"
                                    aria-label={`Use ${asset.caption || asset.alt} in detail ${index + 1}`}
                                    checked={section.media.some(
                                      ({ mediaId }) => mediaId === asset.id,
                                    )}
                                    onChange={(event) =>
                                      changeProject((project) => ({
                                        ...project,
                                        sections: project.sections.map((item) =>
                                          item.id !== section.id
                                            ? item
                                            : {
                                                ...item,
                                                media: event.target.checked
                                                  ? [
                                                      ...item.media,
                                                      { mediaId: asset.id, alt: asset.alt },
                                                    ]
                                                  : item.media.filter(
                                                      ({ mediaId }) => mediaId !== asset.id,
                                                    ),
                                              },
                                        ),
                                      }))
                                    }
                                  />
                                  {asset.caption || asset.alt}
                                </label>
                              ))}
                            </div>
                          </fieldset>
                        )}
                      </div>
                    </li>
                  ))}
              </ol>
            )}
          </section>
          <p role="status" className="mt-2 text-xs text-primary">
            Apply these project edits to the dashboard session, then save a CMS draft to persist.
          </p>
        </section>
      )}

      {visibleProjects.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/60 p-10 text-center">
          <Search aria-hidden="true" className="mx-auto h-8 w-8 text-muted-foreground" />
          <h2 className="mt-4 text-lg font-semibold">
            {snapshot.projects.length === 0 ? "No projects yet" : "No matching projects"}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {snapshot.projects.length === 0
              ? "Create a project to start the collection."
              : "Try another search or category filter."}
          </p>
          {snapshot.projects.length === 0 && (
            <button
              type="button"
              onClick={startCreate}
              className="mt-5 rounded-lg border border-border px-4 py-2 text-sm hover:bg-accent"
            >
              Create project
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {visibleProjects.map((project) => {
            const image = imageForProject(project, snapshot, mediaUrls.urls);
            const featured = snapshot.featuredProjectIds.includes(project.id);
            const actualIndex = snapshot.projects.findIndex(({ id }) => id === project.id);
            return (
              <article
                key={project.id}
                className="overflow-hidden rounded-2xl border border-border bg-card"
              >
                <button
                  type="button"
                  onClick={() => startEdit(project)}
                  className="group block w-full text-left"
                >
                  <div className="relative aspect-[16/9] overflow-hidden bg-background">
                    {image ? (
                      <img
                        src={image}
                        alt={project.coverMedia?.alt ?? `${project.title} cover`}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                      />
                    ) : (
                      <div
                        className={`grid h-full place-items-center bg-tone-${project.tone}/20 p-5 text-center`}
                      >
                        <div>
                          <span className="inline-flex rounded-full border border-border bg-background/70 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                            Preview · no supplied cover
                          </span>
                          <p className="mt-3 text-lg font-semibold">{project.title}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {project.placeholder}
                          </p>
                        </div>
                      </div>
                    )}
                    <span
                      className={`absolute right-3 top-3 rounded-full border px-2.5 py-1 text-[10px] font-medium backdrop-blur ${project.visible ? "border-success/30 bg-background/80 text-success" : "border-border bg-background/80 text-muted-foreground"}`}
                    >
                      {project.visible ? "Visible" : "Hidden"}
                    </span>
                  </div>
                  <div className="p-4 pb-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="truncate text-base font-semibold">{project.title}</h2>
                        <p className="mt-1 truncate text-xs text-muted-foreground">
                          {project.category} · {project.type}
                          {project.year ? ` · ${project.year}` : ""}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-lg bg-background px-2 py-1 text-[10px] text-muted-foreground">
                        /{project.slug}
                      </span>
                    </div>
                    <p className="mt-3 line-clamp-2 min-h-10 text-xs leading-5 text-muted-foreground">
                      {project.description || "No description added."}
                    </p>
                  </div>
                </button>
                <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2">
                  <button
                    type="button"
                    aria-pressed={featured}
                    onClick={() => toggleFeatured(project.id)}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs ${featured ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent"}`}
                  >
                    <Star className={`h-3.5 w-3.5 ${featured ? "fill-current" : ""}`} />
                    {featured ? "Featured" : "Feature"}
                  </button>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      aria-label={
                        project.visible ? `Hide ${project.title}` : `Show ${project.title}`
                      }
                      onClick={() => toggleVisibility(project.id)}
                      className="rounded-lg p-2 text-muted-foreground hover:bg-accent"
                    >
                      {project.visible ? (
                        <Eye className="h-4 w-4" />
                      ) : (
                        <EyeOff className="h-4 w-4" />
                      )}
                    </button>
                    <button
                      type="button"
                      aria-label={`Move ${project.title} up`}
                      disabled={actualIndex === 0}
                      onClick={() => moveProject(project.id, -1)}
                      className="rounded-lg p-2 text-muted-foreground hover:bg-accent disabled:opacity-30"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Move ${project.title} down`}
                      disabled={actualIndex === snapshot.projects.length - 1}
                      onClick={() => moveProject(project.id, 1)}
                      className="rounded-lg p-2 text-muted-foreground hover:bg-accent disabled:opacity-30"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Remove ${project.title}`}
                      onClick={() => removeProject(project)}
                      className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {snapshot.projects.length > 0 && (
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Check className="h-3.5 w-3.5" />
          Project ordering and featured selections are stored only in this page session.
        </div>
      )}
      {draft && (
        <button
          type="button"
          onClick={() => {
            setDraft(null);
            setEditingId(null);
          }}
          className="sr-only"
        >
          <X />
        </button>
      )}
    </div>
  );
}
