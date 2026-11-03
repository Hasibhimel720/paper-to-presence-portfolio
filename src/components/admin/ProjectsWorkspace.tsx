import { useEffect, useMemo, useRef, useState } from "react";
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
  const id = globalThis.crypto?.randomUUID?.();

  if (id) {
    return `project:${id}`;
  }

  if (!globalThis.crypto?.getRandomValues) {
    throw new Error("Secure ID generation is unavailable. Please use a supported browser.");
  }

  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);

  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;

  const uuid = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");

  return `project:${uuid.slice(0, 8)}-${uuid.slice(8, 12)}-${uuid.slice(12, 16)}-${uuid.slice(16, 20)}-${uuid.slice(20)}`;
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
    galleryLayout: "masonry",
    ctaHeading: "",
    ctaBody: "",
    ctaLabel: "",
    ctaHref: "/#contact",
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
  const [galleryUploads, setGalleryUploads] = useState<{ file: File; preview: string }[]>([]);
  const [galleryUploadBusy, setGalleryUploadBusy] = useState(false);
  const galleryUploadsRef = useRef(galleryUploads);
  const mediaUrls = useCmsMediaUrls(snapshot.media);

  useEffect(
    () => () => {
      if (uploadPreview) URL.revokeObjectURL(uploadPreview);
    },
    [uploadPreview],
  );

  useEffect(() => {
    galleryUploadsRef.current = galleryUploads;
  }, [galleryUploads]);

  useEffect(
    () => () => {
      galleryUploadsRef.current.forEach(({ preview }) => URL.revokeObjectURL(preview));
    },
    [],
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
    if (uploadBusy || galleryUploadBusy) {
      setError("Wait for the current image upload to finish before changing projects.");
      return;
    }
    if (draft && !window.confirm("Discard the current unsaved project draft?")) return;
    try {
      clearProjectUpload();
      clearGalleryUploads();
      setDraft(createProject(snapshot));
      setEditingId(null);
      setError("");
      setSuccess("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to start a project draft.");
    }
  }

  function startEdit(project: CmsProject) {
    if (uploadBusy || galleryUploadBusy) {
      setError("Wait for the current image upload to finish before changing projects.");
      return;
    }
    if (draft && !window.confirm("Discard the current unsaved project draft?")) return;
    clearProjectUpload();
    clearGalleryUploads();
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
    if (galleryUploads.length > 0) {
      setError("Upload or remove the selected gallery files before applying project changes.");
      setSuccess("");
      return;
    }
    const originalSlug = editingId
      ? snapshot.projects.find(({ id }) => id === editingId)?.slug
      : undefined;
    if (
      originalSlug &&
      draft.slug !== originalSlug &&
      !window.confirm(
        `Changing this slug will change the public project URL from /work/${originalSlug} to /work/${draft.slug}. Existing links may stop working. Continue?`,
      )
    ) {
      return;
    }
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
    clearProjectUpload();
    clearGalleryUploads();
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

  function clearGalleryUploads() {
    galleryUploads.forEach(({ preview }) => URL.revokeObjectURL(preview));
    setGalleryUploads([]);
  }

  function chooseGalleryImages(files: FileList | null) {
    if (!files?.length) return;
    const selected = Array.from(files);
    const invalidFile = selected.find((file) => validateCmsImageFile(file));
    if (invalidFile) {
      setError(validateCmsImageFile(invalidFile) ?? "The selected image is invalid.");
      setSuccess("");
      return;
    }
    setGalleryUploads((current) => [
      ...current,
      ...selected.map((file) => ({ file, preview: URL.createObjectURL(file) })),
    ]);
    setError("");
    setSuccess("");
  }

  function discardGalleryUpload(index: number) {
    setGalleryUploads((current) => {
      const selected = current[index];
      if (selected) URL.revokeObjectURL(selected.preview);
      return current.filter((_, itemIndex) => itemIndex !== index);
    });
  }

  async function uploadGalleryImages() {
    if (!draft || galleryUploads.length === 0) return;
    setGalleryUploadBusy(true);
    setError("");
    let updatedSnapshot = snapshot;
    let updatedProject = draft;
    let uploadedCount = 0;
    try {
      for (const { file } of galleryUploads) {
        const asset = await uploadCmsMediaFile(file, {
          alt: file.name,
          caption: file.name.replace(/\.[^.]+$/, ""),
        });
        const validation = contentSnapshotSchema.safeParse({
          ...updatedSnapshot,
          media: [asset, ...updatedSnapshot.media.filter(({ id }) => id !== asset.id)],
        });
        if (!validation.success) {
          throw new Error(validation.error.issues[0]?.message ?? "The media reference is invalid.");
        }
        updatedSnapshot = validation.data;
        updatedProject = {
          ...updatedProject,
          gallery: [
            ...updatedProject.gallery,
            { mediaId: asset.id, alt: asset.alt, caption: asset.caption },
          ],
          ...(updatedProject.coverMedia
            ? {}
            : { coverMedia: { mediaId: asset.id, alt: asset.alt } }),
          ...(updatedProject.heroMedia ? {} : { heroMedia: { mediaId: asset.id, alt: asset.alt } }),
        };
        uploadedCount += 1;
      }
      onChange(updatedSnapshot);
      setDraft(updatedProject);
      setSuccess(
        `${uploadedCount} image${uploadedCount === 1 ? "" : "s"} added to this project's gallery. Apply project changes, then save a draft.`,
      );
      setError("");
    } catch (uploadError) {
      if (uploadedCount > 0) {
        onChange(updatedSnapshot);
        setDraft(updatedProject);
      }
      setError(
        uploadError instanceof Error
          ? `${uploadedCount ? `${uploadedCount} image(s) uploaded; ` : ""}${uploadError.message}`
          : "Some project images could not be uploaded.",
      );
      setSuccess("");
    } finally {
      galleryUploads.forEach(({ preview }) => URL.revokeObjectURL(preview));
      setGalleryUploads([]);
      setGalleryUploadBusy(false);
    }
  }

  function changeGalleryReference(
    index: number,
    update: (reference: CmsProject["gallery"][number]) => CmsProject["gallery"][number],
  ) {
    changeProject((project) => ({
      ...project,
      gallery: project.gallery.map((reference, itemIndex) =>
        itemIndex === index ? update(reference) : reference,
      ),
    }));
  }

  async function replaceGalleryImage(index: number, file: File | undefined) {
    if (!draft || !file) return;
    const validationError = validateCmsImageFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }
    setGalleryUploadBusy(true);
    try {
      const existing = draft.gallery[index];
      if (!existing) return;
      const asset = await uploadCmsMediaFile(file, {
        alt: existing.alt || file.name,
        caption: existing.caption || file.name.replace(/\.[^.]+$/, ""),
      });
      const validation = contentSnapshotSchema.safeParse({
        ...snapshot,
        media: [asset, ...snapshot.media.filter(({ id }) => id !== asset.id)],
      });
      if (!validation.success) {
        throw new Error(validation.error.issues[0]?.message ?? "The media reference is invalid.");
      }
      onChange(validation.data);
      changeProject((project) => ({
        ...project,
        gallery: project.gallery.map((reference, itemIndex) =>
          itemIndex === index
            ? { mediaId: asset.id, alt: asset.alt, caption: asset.caption }
            : reference,
        ),
        coverMedia:
          project.coverMedia?.mediaId === existing.mediaId
            ? { mediaId: asset.id, alt: asset.alt }
            : project.coverMedia,
        heroMedia:
          project.heroMedia?.mediaId === existing.mediaId
            ? { mediaId: asset.id, alt: asset.alt }
            : project.heroMedia,
      }));
      setError("");
      setSuccess("Gallery image replaced. Apply project changes, then save a draft.");
    } catch (replaceError) {
      setError(
        replaceError instanceof Error
          ? replaceError.message
          : "The gallery image could not be replaced.",
      );
      setSuccess("");
    } finally {
      setGalleryUploadBusy(false);
    }
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
        "Image uploaded to the media library and selected as this project's cover and hero image, and added to its gallery. Apply project changes, then save the draft.";
      if (applySnapshot(nextSnapshot, successMessage)) {
        changeProject((project) => ({
          ...project,
          cover: undefined,
          coverMedia: { mediaId: asset.id, alt: asset.alt },
          heroMedia: project.heroMedia ?? { mediaId: asset.id, alt: asset.alt },
          gallery: project.gallery.some(({ mediaId }) => mediaId === asset.id)
            ? project.gallery
            : [...project.gallery, { mediaId: asset.id, alt: asset.alt, caption: asset.caption }],
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
    if (uploadBusy || galleryUploadBusy) {
      setError("Wait for the current image upload to finish before removing a project.");
      return;
    }
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
      clearProjectUpload();
      clearGalleryUploads();
    }
  }

  function addCaseStudySection() {
    if (!draft) return;
    const section = caseStudySectionSchema.safeParse({
      id: `case-section:${crypto.randomUUID()}`,
      order: draft.sections.length,
      title: "New case-study section",
      body: "",
      visible: true,
      galleryLayout: "stacked",
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
  const coverAsset = imageOptions.find(({ id }) => id === draft?.coverMedia?.mediaId);
  const heroReference = draft?.heroMedia ?? draft?.coverMedia;
  const heroAsset = imageOptions.find(({ id }) => id === heroReference?.mediaId);
  const draftHeroPreview =
    heroReference &&
    (mediaUrls.urls[heroReference.mediaId] ??
      (heroAsset?.source.kind === "url" ? heroAsset.source.url : ""))
      ? (mediaUrls.urls[heroReference.mediaId] ??
        (heroAsset?.source.kind === "url" ? heroAsset.source.url : undefined))
      : draftCoverPreview;
  const projectGalleryImages =
    draft?.gallery.map((reference) => {
      const asset = imageOptions.find(({ id }) => id === reference.mediaId);
      return {
        reference,
        asset,
        src:
          mediaUrls.urls[reference.mediaId] ??
          (asset?.source.kind === "url" ? asset.source.url : ""),
      };
    }) ?? [];
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
                  clearGalleryUploads();
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
            <details open className="min-w-0 rounded-xl border border-border p-4">
              <summary className="cursor-pointer font-semibold">Project Information</summary>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
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
                  {editingId &&
                    snapshot.projects.find(({ id }) => id === editingId)?.slug !== draft.slug && (
                      <span className="block text-xs text-warning">
                        Changing this slug changes the public URL. Existing links may break;
                        confirmation is required when you apply.
                      </span>
                    )}
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
                  <span className="text-xs font-medium text-muted-foreground">Client</span>
                  <input
                    value={draft.client ?? ""}
                    onChange={(event) =>
                      changeProject((project) => ({
                        ...project,
                        client: event.target.value || undefined,
                      }))
                    }
                    className={inputClass}
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-muted-foreground">My role</span>
                  <input
                    value={draft.role ?? ""}
                    onChange={(event) =>
                      changeProject((project) => ({
                        ...project,
                        role: event.target.value || undefined,
                      }))
                    }
                    className={inputClass}
                  />
                </label>
                <label className="block space-y-1.5 sm:col-span-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    Services provided · one per line
                  </span>
                  <textarea
                    rows={2}
                    value={draft.services?.join("\n") ?? ""}
                    onChange={(event) =>
                      changeProject((project) => ({
                        ...project,
                        services: event.target.value
                          .split("\n")
                          .map((service) => service.trim())
                          .filter(Boolean),
                      }))
                    }
                    className={`${inputClass} resize-y`}
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
                <fieldset className="grid gap-3 sm:col-span-2 sm:grid-cols-2">
                  <legend className="text-xs font-medium text-muted-foreground">
                    Public metadata visibility
                  </legend>
                  {(
                    [
                      ["showClient", "Show client"],
                      ["showYear", "Show year"],
                      ["showRole", "Show role"],
                      ["showServices", "Show services"],
                    ] as const
                  ).map(([key, label]) => (
                    <label key={key} className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={draft[key] !== false}
                        onChange={(event) =>
                          changeProject((project) => ({ ...project, [key]: event.target.checked }))
                        }
                      />
                      {label}
                    </label>
                  ))}
                </fieldset>
              </div>
            </details>

            <details open className="min-w-0 rounded-xl border border-border p-4">
              <summary className="cursor-pointer font-semibold">Hero Section</summary>
              <div className="mt-4 space-y-4">
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-muted-foreground">Hero heading</span>
                  <input
                    value={draft.heroTitle ?? ""}
                    onChange={(event) =>
                      changeProject((project) => ({
                        ...project,
                        heroTitle: event.target.value || undefined,
                      }))
                    }
                    placeholder={draft.title || "Use project title"}
                    className={inputClass}
                  />
                </label>
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
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-muted-foreground">
                    Hero image from this project’s gallery
                  </span>
                  <select
                    aria-label="Hero image from project gallery"
                    value={draft.heroMedia?.mediaId ?? draft.coverMedia?.mediaId ?? ""}
                    onChange={(event) => {
                      const reference = draft.gallery.find(
                        ({ mediaId }) => mediaId === event.target.value,
                      );
                      const asset = imageOptions.find(({ id }) => id === event.target.value);
                      changeProject((project) => ({
                        ...project,
                        heroMedia: reference
                          ? { ...reference }
                          : asset
                            ? { mediaId: asset.id, alt: asset.alt }
                            : undefined,
                      }));
                    }}
                    className={inputClass}
                  >
                    <option value={draft.coverMedia?.mediaId ?? ""}>Use cover image</option>
                    {draft.gallery.map((reference) => {
                      const asset = imageOptions.find(({ id }) => id === reference.mediaId);
                      return (
                        <option key={reference.mediaId} value={reference.mediaId}>
                          {asset?.caption ||
                            reference.caption ||
                            reference.alt ||
                            reference.mediaId}
                        </option>
                      );
                    })}
                  </select>
                </label>
                <div className="rounded-xl border border-border bg-background p-3">
                  {draftCoverPreview ? (
                    <img
                      src={draftCoverPreview}
                      alt={draft.coverMedia?.alt ?? ""}
                      width={coverAsset?.width}
                      height={coverAsset?.height}
                      className="block h-auto w-full rounded-lg object-contain"
                    />
                  ) : (
                    <div className="grid aspect-[16/9] place-items-center rounded-lg border border-dashed border-border text-center text-xs text-muted-foreground">
                      No supplied cover selected
                      <br />
                      Preview placeholder only
                    </div>
                  )}
                </div>
                {draftHeroPreview && draftHeroPreview !== draftCoverPreview && (
                  <div className="rounded-xl border border-border bg-background p-3">
                    <p className="mb-2 text-xs font-medium text-muted-foreground">Hero preview</p>
                    <img
                      src={draftHeroPreview}
                      alt={heroReference?.alt ?? ""}
                      width={heroAsset?.width}
                      height={heroAsset?.height}
                      className="block h-auto w-full rounded-lg object-contain"
                    />
                  </div>
                )}
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
                        className="block h-auto w-full rounded-lg object-contain"
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
                <details open className="rounded-xl border border-border p-3">
                  <summary className="cursor-pointer font-semibold">Project Gallery</summary>
                  <div className="mt-4 space-y-3">
                    <label className="block space-y-1.5">
                      <span className="text-xs font-medium text-muted-foreground">
                        Add multiple images to this project
                      </span>
                      <input
                        aria-label="Upload project gallery images"
                        type="file"
                        multiple
                        accept="image/jpeg,image/png,image/webp,image/avif"
                        disabled={!cmsEnabled || galleryUploadBusy}
                        onChange={(event) => chooseGalleryImages(event.currentTarget.files)}
                        className="block w-full text-xs file:mr-3 file:rounded-md file:border-0 file:bg-accent file:px-3 file:py-2 file:text-xs file:font-medium"
                      />
                    </label>
                    {galleryUploads.length > 0 && (
                      <div className="space-y-3 rounded-lg border border-border p-3">
                        <p className="text-xs text-muted-foreground">
                          {galleryUploads.length} image{galleryUploads.length === 1 ? "" : "s"}{" "}
                          ready to upload
                        </p>
                        <div className="grid gap-3 sm:grid-cols-2">
                          {galleryUploads.map(({ file, preview }, index) => (
                            <figure key={`${file.name}-${index}`} className="space-y-2">
                              <img
                                src={preview}
                                alt={`Preview ${file.name}`}
                                className="block h-auto w-full rounded-lg"
                              />
                              <figcaption className="flex items-center justify-between gap-2 text-xs">
                                <span className="truncate">{file.name}</span>
                                <button
                                  type="button"
                                  aria-label={`Remove selected ${file.name}`}
                                  onClick={() => discardGalleryUpload(index)}
                                  className="rounded p-1 text-destructive hover:bg-destructive/10"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </figcaption>
                            </figure>
                          ))}
                        </div>
                        <button
                          type="button"
                          onClick={uploadGalleryImages}
                          disabled={!cmsEnabled || galleryUploadBusy}
                          className="rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground disabled:opacity-50"
                        >
                          {galleryUploadBusy
                            ? "Uploading images…"
                            : "Upload images to this project"}
                        </button>
                      </div>
                    )}
                    {!cmsEnabled && (
                      <p className="text-xs text-muted-foreground">
                        Gallery uploads require the connected CMS. Demo mode cannot upload files.
                      </p>
                    )}
                    <label className="block space-y-1.5">
                      <span className="text-xs font-medium text-muted-foreground">
                        Gallery presentation
                      </span>
                      <select
                        aria-label="Project gallery layout"
                        value={draft.galleryLayout ?? "masonry"}
                        onChange={(event) =>
                          changeProject((project) => ({
                            ...project,
                            galleryLayout: event.target.value as CmsProject["galleryLayout"],
                          }))
                        }
                        className={inputClass}
                      >
                        {[
                          ["full-width", "Full-width images"],
                          ["two-column", "Two-column grid"],
                          ["three-column", "Three-column grid"],
                          ["masonry", "Masonry"],
                          ["stacked", "Stacked images"],
                          ["carousel", "Image slider"],
                          ["single", "Single-image feature"],
                        ].map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <fieldset className="rounded-xl border border-border p-3">
                      <legend className="px-1 text-xs font-medium text-muted-foreground">
                        Gallery images · reorderable
                      </legend>
                      <div className="mt-1 max-h-40 space-y-2 overflow-auto">
                        {imageOptions.length === 0 ? (
                          <p className="text-xs text-muted-foreground">
                            No media records are available.
                          </p>
                        ) : (
                          imageOptions.map((asset) => {
                            const checked = draft.gallery.some(
                              ({ mediaId }) => mediaId === asset.id,
                            );
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
                                        ? [
                                            ...project.gallery,
                                            {
                                              mediaId: asset.id,
                                              alt: asset.alt,
                                              caption: asset.caption,
                                            },
                                          ]
                                        : project.gallery.filter(
                                            ({ mediaId }) => mediaId !== asset.id,
                                          ),
                                    }))
                                  }
                                />
                                <span className="truncate">
                                  {asset.caption || asset.alt || asset.id}
                                </span>
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
                            const src =
                              mediaUrls.urls[reference.mediaId] ??
                              (asset?.source.kind === "url" ? asset.source.url : "");
                            return (
                              <li
                                key={reference.mediaId}
                                className="space-y-3 rounded-lg border border-border p-3"
                              >
                                <div className="flex items-start gap-3">
                                  {src ? (
                                    <img
                                      src={src}
                                      alt={reference.alt}
                                      className="h-16 w-20 rounded object-contain"
                                    />
                                  ) : (
                                    <div className="grid h-16 w-20 place-items-center rounded bg-muted text-[10px] text-muted-foreground">
                                      Preview unavailable
                                    </div>
                                  )}
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-xs font-medium">
                                      {index + 1}. {label}
                                    </p>
                                    <label className="mt-2 block space-y-1">
                                      <span className="text-[10px] text-muted-foreground">
                                        Alt text
                                      </span>
                                      <input
                                        aria-label={`Gallery image ${index + 1} alt text`}
                                        value={reference.alt}
                                        onChange={(event) =>
                                          changeGalleryReference(index, (item) => ({
                                            ...item,
                                            alt: event.target.value,
                                          }))
                                        }
                                        className={`${inputClass} py-1.5 text-xs`}
                                      />
                                    </label>
                                    <label className="mt-2 block space-y-1">
                                      <span className="text-[10px] text-muted-foreground">
                                        Caption
                                      </span>
                                      <input
                                        aria-label={`Gallery image ${index + 1} caption`}
                                        value={reference.caption ?? ""}
                                        onChange={(event) =>
                                          changeGalleryReference(index, (item) => ({
                                            ...item,
                                            caption: event.target.value || undefined,
                                          }))
                                        }
                                        className={`${inputClass} py-1.5 text-xs`}
                                      />
                                    </label>
                                  </div>
                                </div>
                                <div className="flex flex-wrap justify-end gap-1">
                                  <label className="cursor-pointer rounded border border-border px-2 py-1 text-[10px] hover:bg-accent">
                                    Replace
                                    <input
                                      aria-label={`Replace ${label}`}
                                      type="file"
                                      accept="image/jpeg,image/png,image/webp,image/avif"
                                      className="sr-only"
                                      disabled={!cmsEnabled || galleryUploadBusy}
                                      onChange={(event) => {
                                        void replaceGalleryImage(
                                          index,
                                          event.currentTarget.files?.[0],
                                        );
                                        event.currentTarget.value = "";
                                      }}
                                    />
                                  </label>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      changeProject((project) => ({
                                        ...project,
                                        cover: undefined,
                                        coverMedia: { ...reference },
                                      }))
                                    }
                                    className="rounded border border-border px-2 py-1 text-[10px] hover:bg-accent"
                                  >
                                    Set cover
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      changeProject((project) => ({
                                        ...project,
                                        heroMedia: { ...reference },
                                      }))
                                    }
                                    className="rounded border border-border px-2 py-1 text-[10px] hover:bg-accent"
                                  >
                                    Set hero
                                  </button>
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
                                  <button
                                    type="button"
                                    aria-label={`Remove ${label} from this project`}
                                    onClick={() =>
                                      changeProject((project) => ({
                                        ...project,
                                        gallery: project.gallery.filter(
                                          ({ mediaId }) => mediaId !== reference.mediaId,
                                        ),
                                      }))
                                    }
                                    className="rounded border border-border p-1 text-destructive hover:bg-destructive/10"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </li>
                            );
                          })}
                        </ol>
                      )}
                    </fieldset>
                  </div>
                </details>
              </div>
            </details>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Select or replace cover and gallery images from the shared media library. Save a draft
            before publishing content changes.
          </p>
          <details open className="mt-5 rounded-xl border border-border p-4">
            <summary className="cursor-pointer font-semibold">Content Sections</summary>
            <section className="mt-4">
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
                            Section {index + 1}
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
                          <label className="flex items-center gap-2 text-xs">
                            <input
                              type="checkbox"
                              aria-label={`Show case-study detail ${index + 1}`}
                              checked={section.visible !== false}
                              onChange={(event) =>
                                changeProject((project) => ({
                                  ...project,
                                  sections: project.sections.map((item) =>
                                    item.id === section.id
                                      ? { ...item, visible: event.target.checked }
                                      : item,
                                  ),
                                }))
                              }
                            />
                            Show this section publicly
                          </label>
                          <label className="block space-y-1">
                            <span className="text-xs text-muted-foreground">Image layout</span>
                            <select
                              aria-label={`Case-study detail ${index + 1} image layout`}
                              value={section.galleryLayout ?? "stacked"}
                              onChange={(event) =>
                                changeProject((project) => ({
                                  ...project,
                                  sections: project.sections.map((item) =>
                                    item.id === section.id
                                      ? {
                                          ...item,
                                          galleryLayout: event.target
                                            .value as CmsProject["galleryLayout"],
                                        }
                                      : item,
                                  ),
                                }))
                              }
                              className={inputClass}
                            >
                              {[
                                ["full-width", "Full-width"],
                                ["two-column", "Two-column"],
                                ["three-column", "Three-column"],
                                ["masonry", "Masonry"],
                                ["stacked", "Stacked"],
                                ["carousel", "Carousel"],
                                ["single", "Single image"],
                              ].map(([value, label]) => (
                                <option key={value} value={value}>
                                  {label}
                                </option>
                              ))}
                            </select>
                          </label>
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
          </details>
          <details className="mt-4 rounded-xl border border-border p-4">
            <summary className="cursor-pointer font-semibold">SEO &amp; Visibility</summary>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <input
                  type="checkbox"
                  checked={draft.visible}
                  onChange={(event) =>
                    changeProject((project) => ({ ...project, visible: event.target.checked }))
                  }
                />
                Publish this project on the public website
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">SEO title</span>
                <input
                  value={draft.seoTitle ?? ""}
                  onChange={(event) =>
                    changeProject((project) => ({
                      ...project,
                      seoTitle: event.target.value || undefined,
                    }))
                  }
                  className={inputClass}
                />
              </label>
              <label className="block space-y-1.5 sm:col-span-2">
                <span className="text-xs font-medium text-muted-foreground">SEO description</span>
                <textarea
                  rows={2}
                  value={draft.seoDescription ?? ""}
                  onChange={(event) =>
                    changeProject((project) => ({
                      ...project,
                      seoDescription: event.target.value || undefined,
                    }))
                  }
                  className={`${inputClass} resize-y`}
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">CTA heading</span>
                <input
                  value={draft.ctaHeading ?? ""}
                  onChange={(event) =>
                    changeProject((project) => ({
                      ...project,
                      ctaHeading: event.target.value || undefined,
                    }))
                  }
                  className={inputClass}
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">
                  CTA supporting text
                </span>
                <input
                  value={draft.ctaBody ?? ""}
                  onChange={(event) =>
                    changeProject((project) => ({
                      ...project,
                      ctaBody: event.target.value || undefined,
                    }))
                  }
                  className={inputClass}
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">CTA button label</span>
                <input
                  value={draft.ctaLabel ?? ""}
                  onChange={(event) =>
                    changeProject((project) => ({
                      ...project,
                      ctaLabel: event.target.value || undefined,
                    }))
                  }
                  className={inputClass}
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">CTA destination</span>
                <input
                  value={draft.ctaHref ?? "/#contact"}
                  onChange={(event) =>
                    changeProject((project) => ({
                      ...project,
                      ctaHref: event.target.value || undefined,
                    }))
                  }
                  placeholder="/#contact or https://example.com"
                  className={inputClass}
                />
              </label>
            </div>
          </details>
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
            clearProjectUpload();
            clearGalleryUploads();
          }}
          className="sr-only"
        >
          <X />
        </button>
      )}
    </div>
  );
}
