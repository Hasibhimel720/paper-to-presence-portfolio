import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff, Plus, Search, Trash2 } from "lucide-react";
import {
  contentSnapshotSchema,
  serviceRecordSchema,
  type ContentSnapshot,
  type MediaAsset,
} from "@/lib/cms/schema";
import { uploadCmsMediaFile, useCmsMediaUrls, validateCmsImageFile } from "@/lib/cms/media-storage";

type ServiceRecord = ContentSnapshot["services"][number];
type ServicesSection = Extract<
  ContentSnapshot["pages"][number]["sections"][number],
  { type: "services" }
>;

type ServicesWorkspaceProps = {
  snapshot: ContentSnapshot;
  onChange: (snapshot: ContentSnapshot) => void;
};

const imageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

function serviceTitle(service: ServiceRecord) {
  return service.title || "Untitled service";
}

function serviceSection(snapshot: ContentSnapshot) {
  return snapshot.pages
    .find((page) => page.slug === "/")
    ?.sections.find((section): section is ServicesSection => section.type === "services");
}

function setHomeServiceIds(
  snapshot: ContentSnapshot,
  services: ServiceRecord[],
  includeServiceId?: string,
) {
  const existingIds = serviceSection(snapshot)?.data.serviceIds ?? [];
  const linkedIds = new Set(
    existingIds.length ? existingIds : snapshot.services.map(({ id }) => id),
  );
  if (includeServiceId) linkedIds.add(includeServiceId);
  const serviceIds = [...services]
    .sort((a, b) => a.order - b.order)
    .filter(({ id }) => linkedIds.has(id))
    .map(({ id }) => id);
  return {
    ...snapshot,
    pages: snapshot.pages.map((page) =>
      page.slug === "/"
        ? {
            ...page,
            sections: page.sections.map((section) =>
              section.type === "services"
                ? { ...section, data: { ...section.data, serviceIds } }
                : section,
            ),
          }
        : page,
    ),
  };
}

function defaultBadge(order: number) {
  return order < 2 ? "Core" : "Also";
}

export function ServicesWorkspace({ snapshot, onChange }: ServicesWorkspaceProps) {
  const records = useMemo(
    () => [...snapshot.services].sort((a, b) => a.order - b.order),
    [snapshot.services],
  );
  const section = serviceSection(snapshot);
  const { urls: mediaUrls } = useCmsMediaUrls(snapshot.media);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<ServiceRecord | null>(null);
  const [uploadedAssets, setUploadedAssets] = useState<MediaAsset[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const inputClass =
    "w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

  useEffect(
    () => () => {
      if (previewUrl.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  function report(candidate: ContentSnapshot, message: string) {
    const validation = contentSnapshotSchema.safeParse(candidate);
    if (!validation.success) {
      setError(validation.error.issues[0]?.message ?? "The change failed CMS validation.");
      setSuccess("");
      return false;
    }
    onChange(validation.data);
    setError("");
    setSuccess(message);
    return true;
  }

  function clearImageSelection(clearPreview = true) {
    setSelectedFile(null);
    if (clearPreview) setPreviewUrl("");
    if (imageInputRef.current) imageInputRef.current.value = "";
  }

  function updateSection(patch: Partial<ServicesSection["data"]>) {
    if (!section) {
      setError("The homepage Services section could not be found.");
      setSuccess("");
      return;
    }
    const candidate: ContentSnapshot = {
      ...snapshot,
      pages: snapshot.pages.map((page) =>
        page.slug === "/"
          ? {
              ...page,
              sections: page.sections.map((item) =>
                item.id === section.id && item.type === "services"
                  ? { ...item, data: { ...item.data, ...patch } }
                  : item,
              ),
            }
          : page,
      ),
    };
    report(candidate, "Services section copy updated in the dashboard session.");
  }

  function updateServices(
    nextRecords: ServiceRecord[],
    message: string,
    media: ContentSnapshot["media"] = snapshot.media,
    removedServiceId?: string,
    includeServiceId?: string,
  ) {
    let candidate = setHomeServiceIds(
      { ...snapshot, services: nextRecords, media },
      nextRecords,
      includeServiceId,
    );
    if (removedServiceId) {
      candidate = {
        ...candidate,
        pages: candidate.pages.map((page) => ({
          ...page,
          sections: page.sections.map((item) =>
            item.type === "services"
              ? {
                  ...item,
                  data: {
                    ...item.data,
                    serviceIds: item.data.serviceIds.filter((id) => id !== removedServiceId),
                  },
                }
              : item,
          ),
        })),
      };
    }
    return report(candidate, message);
  }

  function startNewService() {
    if (draft && !window.confirm("Discard the current unsaved service changes?")) return;
    const order = records.length;
    setDraft({
      id: `service:${crypto.randomUUID()}`,
      order,
      n: String(order + 1).padStart(2, "0"),
      title: "",
      body: "",
      items: [],
      badge: defaultBadge(order),
      imageFit: "cover",
      visible: true,
    });
    setUploadedAssets([]);
    clearImageSelection();
    setUploadError("");
    setError("");
    setSuccess("");
  }

  function editService(record: ServiceRecord) {
    if (draft && !window.confirm("Discard the current unsaved service changes?")) return;
    setDraft({ ...record, badge: record.badge ?? defaultBadge(record.order) });
    setUploadedAssets([]);
    clearImageSelection();
    setUploadError("");
    setError("");
    setSuccess("");
  }

  function saveService() {
    if (!draft) return;
    const parsed = serviceRecordSchema.safeParse(draft);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check the required service fields.");
      setSuccess("");
      return;
    }
    const exists = records.some(({ id }) => id === parsed.data.id);
    const nextRecords = exists
      ? records.map((record) => (record.id === parsed.data.id ? parsed.data : record))
      : [...records, { ...parsed.data, order: records.length }];
    const nextMedia = [
      ...snapshot.media,
      ...uploadedAssets.filter((asset) => !snapshot.media.some(({ id }) => id === asset.id)),
    ];
    if (
      updateServices(
        nextRecords,
        exists
          ? "Service changes applied to the dashboard session."
          : "Service added to the dashboard session.",
        nextMedia,
        undefined,
        exists ? undefined : parsed.data.id,
      )
    ) {
      setDraft(null);
      setUploadedAssets([]);
      setSelectedFile(null);
      setPreviewUrl("");
    }
  }

  function removeService(record: ServiceRecord) {
    if (!window.confirm(`Remove "${serviceTitle(record)}"?`)) return;
    const nextRecords = records
      .filter(({ id }) => id !== record.id)
      .map((item, order) => ({ ...item, order }));
    if (
      updateServices(
        nextRecords,
        "Service removed from the dashboard session.",
        snapshot.media,
        record.id,
      )
    ) {
      if (draft?.id === record.id) setDraft(null);
    }
  }

  function reorderService(recordId: string, delta: number) {
    const index = records.findIndex(({ id }) => id === recordId);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= records.length) return;
    const nextRecords = [...records];
    [nextRecords[index], nextRecords[target]] = [nextRecords[target]!, nextRecords[index]!];
    updateServices(
      nextRecords.map((record, order) => ({ ...record, order })),
      "Service order updated.",
    );
  }

  function toggleVisibility(recordId: string) {
    const nextRecords = records.map((record) =>
      record.id === recordId ? { ...record, visible: !record.visible } : record,
    );
    const changed = nextRecords.find(({ id }) => id === recordId);
    updateServices(
      nextRecords,
      changed?.visible
        ? "Service shown in the dashboard session."
        : "Service hidden in the dashboard session.",
    );
  }

  function selectImage(file: File | undefined) {
    if (!file || !draft) return;
    const validationError = validateCmsImageFile(file);
    if (validationError) {
      clearImageSelection();
      setUploadError(validationError);
      return;
    }
    if (!imageTypes.has(file.type)) {
      clearImageSelection();
      setUploadError("Choose a JPG, PNG, or WebP image.");
      return;
    }
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setUploadError("");
    setError("");
  }

  async function uploadImage(file: File | undefined) {
    if (!file || !draft) return;
    setUploadBusy(true);
    setUploadError("");
    try {
      const asset = await uploadCmsMediaFile(file, {
        alt: draft.title.trim() || file.name,
        caption: `${draft.title.trim() || "Service"} illustration`,
      });
      setUploadedAssets((current) => [...current.filter(({ id }) => id !== asset.id), asset]);
      setDraft((current) =>
        current
          ? {
              ...current,
              image: { mediaId: asset.id, alt: asset.alt },
              imageFit: current.imageFit ?? "cover",
            }
          : current,
      );
      clearImageSelection(false);
      setSuccess(
        "Image uploaded to the dashboard session. Save the service and then save or publish the CMS draft.",
      );
    } catch (uploadFailure) {
      setUploadError(
        uploadFailure instanceof Error
          ? uploadFailure.message
          : "The service image could not be uploaded. The existing image was not changed.",
      );
    } finally {
      setUploadBusy(false);
    }
  }

  function patchDraft(patch: Partial<ServiceRecord>) {
    setDraft((current) => (current ? { ...current, ...patch } : current));
  }

  const filtered = records.filter((record) =>
    `${record.title} ${record.body}`.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const imageSource = draft?.image ? mediaUrls[draft.image.mediaId] : undefined;
  const inputPreview = previewUrl || imageSource;

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm text-muted-foreground">Portfolio content</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Services</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Edit the section and independently manage each service, image, visibility, and order.
          </p>
        </div>
        <button
          type="button"
          onClick={startNewService}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          <Plus aria-hidden="true" className="h-4 w-4" />
          Add service
        </button>
      </header>

      <section
        aria-label="Services section content"
        className="rounded-2xl border border-border bg-card p-5 sm:p-7"
      >
        <h2 className="text-lg font-semibold">Services section content</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          These fields update the homepage section in the current CMS draft.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">
              Section label / eyebrow
            </span>
            <input
              aria-label="Services section label"
              value={section?.data.eyebrow ?? ""}
              onChange={(event) => updateSection({ eyebrow: event.target.value })}
              className={inputClass}
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Main section heading</span>
            <input
              aria-label="Services section heading"
              value={section?.data.title ?? ""}
              onChange={(event) => updateSection({ title: event.target.value })}
              className={inputClass}
            />
          </label>
          <label className="block space-y-1.5 sm:col-span-2">
            <span className="text-xs font-medium text-muted-foreground">
              Introductory paragraph
            </span>
            <textarea
              aria-label="Services section description"
              rows={3}
              value={section?.data.intro ?? ""}
              onChange={(event) => updateSection({ intro: event.target.value })}
              className={`${inputClass} resize-y`}
            />
          </label>
        </div>
      </section>

      <label className="relative block max-w-xl">
        <span className="sr-only">Search services</span>
        <Search
          aria-hidden="true"
          className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search services…"
          className={`${inputClass} pl-9`}
        />
      </label>

      {error && (
        <p
          role="alert"
          className="rounded-lg border border-destructive/40 bg-card p-3 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      {success && (
        <p
          role="status"
          className="rounded-lg border border-success/30 bg-success/5 p-3 text-sm text-success"
        >
          {success}
        </p>
      )}

      {draft && (
        <section
          aria-label="Edit service"
          className="rounded-2xl border border-primary/30 bg-card p-5 sm:p-7"
        >
          <h2 className="text-lg font-semibold">
            {records.some(({ id }) => id === draft.id) ? "Edit service" : "New service"}
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Number or label</span>
              <input
                aria-label="Number or label"
                value={draft.n}
                onChange={(event) => patchDraft({ n: event.target.value })}
                className={inputClass}
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Service title</span>
              <input
                aria-label="Service title"
                value={draft.title}
                onChange={(event) => patchDraft({ title: event.target.value })}
                className={inputClass}
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Service badge</span>
              <input
                aria-label="Service badge"
                value={draft.badge ?? ""}
                onChange={(event) => patchDraft({ badge: event.target.value })}
                className={inputClass}
              />
            </label>
            <label className="block space-y-1.5 sm:col-span-2">
              <span className="text-xs font-medium text-muted-foreground">Description</span>
              <textarea
                aria-label="Description"
                rows={3}
                value={draft.body}
                onChange={(event) => patchDraft({ body: event.target.value })}
                className={`${inputClass} resize-y`}
              />
            </label>
            <label className="block space-y-1.5 sm:col-span-2">
              <span className="text-xs font-medium text-muted-foreground">Included details</span>
              <textarea
                aria-label="Included details"
                rows={4}
                value={draft.items.join("\n")}
                onChange={(event) =>
                  patchDraft({
                    items: event.target.value
                      .split("\n")
                      .map((item) => item.trim())
                      .filter(Boolean),
                  })
                }
                className={`${inputClass} resize-y`}
              />
              <span className="text-xs text-muted-foreground">One item per line</span>
            </label>
          </div>

          <fieldset className="mt-5 space-y-4 rounded-lg border border-border p-4">
            <legend className="px-1 text-xs font-medium text-muted-foreground">
              Service image
            </legend>
            {inputPreview ? (
              <img
                src={inputPreview}
                alt={
                  selectedFile
                    ? "Selected service image preview"
                    : draft.image?.alt || "Selected service image preview"
                }
                className="h-36 w-full rounded-lg border border-border bg-background p-2"
                style={{
                  objectFit: draft.imageFit ?? "cover",
                  objectPosition: draft.image?.focalPoint
                    ? `${draft.image.focalPoint.x * 100}% ${draft.image.focalPoint.y * 100}%`
                    : "center",
                }}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                {draft.image
                  ? "The current image is referenced but could not be previewed."
                  : "No custom image. The service illustration will be used when available."}
              </p>
            )}
            {draft.image && (
              <>
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-muted-foreground">Image alt text</span>
                  <input
                    aria-label="Service image alt text"
                    value={draft.image.alt}
                    onChange={(event) =>
                      patchDraft({
                        image: { ...draft.image!, alt: event.target.value },
                      })
                    }
                    className={inputClass}
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-muted-foreground">Image fit</span>
                  <select
                    aria-label="Image fit"
                    value={draft.imageFit ?? "cover"}
                    onChange={(event) =>
                      patchDraft({ imageFit: event.target.value as "cover" | "contain" })
                    }
                    className={inputClass}
                  >
                    <option value="cover">Fill the frame</option>
                    <option value="contain">Show the full image</option>
                  </select>
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  {(["x", "y"] as const).map((axis) => (
                    <label key={axis} className="block space-y-1.5">
                      <span className="text-xs font-medium text-muted-foreground">
                        Image {axis === "x" ? "horizontal" : "vertical"} position
                      </span>
                      <input
                        aria-label={`Image ${axis === "x" ? "horizontal" : "vertical"} position`}
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={draft.image?.focalPoint?.[axis] ?? 0.5}
                        onChange={(event) =>
                          patchDraft({
                            image: {
                              ...draft.image!,
                              focalPoint: {
                                x:
                                  axis === "x"
                                    ? Number(event.target.value)
                                    : (draft.image?.focalPoint?.x ?? 0.5),
                                y:
                                  axis === "y"
                                    ? Number(event.target.value)
                                    : (draft.image?.focalPoint?.y ?? 0.5),
                              },
                            },
                          })
                        }
                        className="w-full accent-primary"
                      />
                    </label>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => patchDraft({ image: undefined })}
                  className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-accent"
                >
                  Remove custom image
                </button>
              </>
            )}
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                Upload or replace image
              </span>
              <input
                aria-label="Choose service image"
                ref={imageInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={uploadBusy}
                onChange={(event) => selectImage(event.currentTarget.files?.[0])}
                className="block w-full text-xs file:mr-3 file:rounded-md file:border-0 file:bg-accent file:px-3 file:py-2 file:text-xs file:font-medium"
              />
            </label>
            {selectedFile && (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void uploadImage(selectedFile)}
                  disabled={uploadBusy}
                  className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:cursor-wait disabled:opacity-60"
                >
                  {uploadBusy ? "Uploading…" : "Upload image"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    clearImageSelection();
                    setUploadError("");
                  }}
                  disabled={uploadBusy}
                  className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-accent"
                >
                  Cancel image selection
                </button>
              </div>
            )}
            {uploadError && (
              <p role="alert" className="text-sm text-destructive">
                {uploadError}
              </p>
            )}
          </fieldset>

          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setDraft(null);
                setUploadedAssets([]);
                clearImageSelection();
                setUploadError("");
                setError("");
                setSuccess("Unsaved service changes were discarded.");
              }}
              className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-accent"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={saveService}
              disabled={uploadBusy}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              Apply changes
            </button>
          </div>
        </section>
      )}

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/60 p-10 text-center">
          <p className="font-medium">
            {records.length === 0 ? "No services yet" : "No matching services"}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {records.length === 0
              ? "Add a service to build this part of your portfolio."
              : "Try another search term."}
          </p>
        </div>
      ) : (
        <ol className="grid gap-3">
          {filtered.map((record) => {
            const index = records.findIndex(({ id }) => id === record.id);
            return (
              <li key={record.id} className="rounded-2xl border border-border bg-card p-4 sm:p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="font-semibold">{serviceTitle(record)}</h2>
                      {!record.visible && (
                        <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                          Hidden
                        </span>
                      )}
                    </div>
                    <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">
                      {record.body || "No description provided."}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {record.n} · {record.badge ?? defaultBadge(record.order)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    <button
                      type="button"
                      aria-label={`Move ${serviceTitle(record)} up`}
                      disabled={index === 0}
                      onClick={() => reorderService(record.id, -1)}
                      className="rounded-lg p-2 text-muted-foreground hover:bg-accent disabled:opacity-30"
                    >
                      <ArrowUp aria-hidden="true" className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Move ${serviceTitle(record)} down`}
                      disabled={index === records.length - 1}
                      onClick={() => reorderService(record.id, 1)}
                      className="rounded-lg p-2 text-muted-foreground hover:bg-accent disabled:opacity-30"
                    >
                      <ArrowDown aria-hidden="true" className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      aria-label={`${record.visible ? "Hide" : "Show"} ${serviceTitle(record)}`}
                      onClick={() => toggleVisibility(record.id)}
                      className="rounded-lg p-2 text-muted-foreground hover:bg-accent"
                    >
                      {record.visible ? (
                        <Eye aria-hidden="true" className="h-4 w-4" />
                      ) : (
                        <EyeOff aria-hidden="true" className="h-4 w-4" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => editService(record)}
                      className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-accent"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      aria-label={`Remove ${serviceTitle(record)}`}
                      onClick={() => removeService(record)}
                      className="rounded-lg p-2 text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 aria-hidden="true" className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
