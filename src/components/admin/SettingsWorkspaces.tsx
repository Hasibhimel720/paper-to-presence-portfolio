import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2, Upload } from "lucide-react";
import { SoftwareToolIcon } from "@/components/site/SoftwareToolIcon";
import { uploadCmsMediaFile, useCmsMediaUrls, validateCmsImageFile } from "@/lib/cms/media-storage";
import { contentSnapshotSchema, softwareIconSchema, type ContentSnapshot } from "@/lib/cms/schema";
import { inferSoftwareIcon } from "@/lib/cms/software-icons";

type WorkspaceProps = {
  snapshot: ContentSnapshot;
  onChange: (snapshot: ContentSnapshot) => void;
};

const inputClass =
  "w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";
const cardClass = "rounded-2xl border border-border bg-card p-5 sm:p-6";
const profilePhotoTypes = ["image/jpeg", "image/png", "image/webp"];

function validateProfilePhotoFile(file: File) {
  if (!profilePhotoTypes.includes(file.type)) {
    return "Choose a JPG, JPEG, PNG, or WebP profile photograph.";
  }
  return validateCmsImageFile(file);
}

function TextField({
  label,
  value,
  onChange,
  multiline = false,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  type?: string;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {multiline ? (
        <textarea
          rows={3}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={`${inputClass} resize-y`}
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={inputClass}
        />
      )}
    </label>
  );
}

function CheckField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-muted-foreground">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      {label}
    </label>
  );
}

function NavigationEditor({
  title,
  items,
  pages,
  sections,
  onChange,
}: {
  title: string;
  items: ContentSnapshot["navigation"];
  pages: ContentSnapshot["pages"];
  sections: { id: string; label: string }[];
  onChange: (items: ContentSnapshot["navigation"]) => void;
}) {
  const sortedItems = [...items].sort((a, b) => a.order - b.order);

  function reorder(id: string, delta: number) {
    const index = sortedItems.findIndex((item) => item.id === id);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= sortedItems.length) return;
    [sortedItems[index], sortedItems[target]] = [sortedItems[target]!, sortedItems[index]!];
    onChange(sortedItems.map((item, order) => ({ ...item, order })));
  }

  function addItem() {
    const suffix = crypto.randomUUID();
    const newItem: ContentSnapshot["navigation"][number] = {
      id: `navigation:${suffix}`,
      order: items.length,
      label: "New link",
      target: { kind: "external", url: `https://example.com/${suffix}` },
      visible: true,
    };
    onChange([...items, newItem]);
  }

  return (
    <section className={cardClass}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">{title}</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Edit labels, destinations, visibility, and order.
          </p>
        </div>
        <button
          type="button"
          onClick={addItem}
          className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs hover:bg-accent"
        >
          <Plus className="h-4 w-4" />
          Add link
        </button>
      </div>
      {sortedItems.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
          No links configured.
        </p>
      ) : (
        <ol className="mt-4 space-y-3">
          {sortedItems.map((item, index) => {
            const targetValue =
              item.target.kind === "section"
                ? item.target.sectionId
                : item.target.kind === "page"
                  ? item.target.path
                  : item.target.url;
            return (
              <li
                key={item.id}
                className="grid gap-3 rounded-xl border border-border bg-background/50 p-3 lg:grid-cols-[minmax(130px,0.7fr)_150px_minmax(160px,1fr)_auto] lg:items-end"
              >
                <TextField
                  label="Label"
                  value={item.label}
                  onChange={(label) =>
                    onChange(
                      items.map((entry) => (entry.id === item.id ? { ...entry, label } : entry)),
                    )
                  }
                />
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-muted-foreground">
                    Destination type
                  </span>
                  <select
                    aria-label={`${item.label} destination type`}
                    value={item.target.kind}
                    onChange={(event) => {
                      const kind = event.target.value;
                      const target: ContentSnapshot["navigation"][number]["target"] =
                        kind === "section"
                          ? { kind: "section", sectionId: sections[0]?.id ?? "section:missing" }
                          : kind === "page"
                            ? { kind: "page", path: pages[0]?.slug ?? "/" }
                            : { kind: "external", url: "https://example.com/" };
                      onChange(
                        items.map((entry) => (entry.id === item.id ? { ...entry, target } : entry)),
                      );
                    }}
                    className={inputClass}
                  >
                    <option value="section">Section</option>
                    <option value="page">Page</option>
                    <option value="external">External URL</option>
                  </select>
                </label>
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-muted-foreground">
                    {item.target.kind === "section"
                      ? "Section"
                      : item.target.kind === "page"
                        ? "Page path"
                        : "External URL"}
                  </span>
                  {item.target.kind === "section" ? (
                    <select
                      aria-label={`${item.label} target`}
                      value={targetValue}
                      onChange={(event) =>
                        onChange(
                          items.map((entry) =>
                            entry.id === item.id && entry.target.kind === "section"
                              ? {
                                  ...entry,
                                  target: { ...entry.target, sectionId: event.target.value },
                                }
                              : entry,
                          ),
                        )
                      }
                      className={inputClass}
                    >
                      {sections.map((section) => (
                        <option key={section.id} value={section.id}>
                          {section.label}
                        </option>
                      ))}
                    </select>
                  ) : item.target.kind === "page" ? (
                    <select
                      aria-label={`${item.label} target`}
                      value={targetValue}
                      onChange={(event) =>
                        onChange(
                          items.map((entry) =>
                            entry.id === item.id
                              ? { ...entry, target: { kind: "page", path: event.target.value } }
                              : entry,
                          ),
                        )
                      }
                      className={inputClass}
                    >
                      {pages.map((page) => (
                        <option key={page.id} value={page.slug}>
                          {page.title} · {page.slug}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      aria-label={`${item.label} target`}
                      type="url"
                      value={targetValue}
                      onChange={(event) =>
                        onChange(
                          items.map((entry) =>
                            entry.id === item.id && entry.target.kind === "external"
                              ? { ...entry, target: { ...entry.target, url: event.target.value } }
                              : entry,
                          ),
                        )
                      }
                      className={inputClass}
                    />
                  )}
                </label>
                <div className="flex items-center justify-end gap-1">
                  <CheckField
                    label="Visible"
                    checked={item.visible}
                    onChange={(visible) =>
                      onChange(
                        items.map((entry) =>
                          entry.id === item.id ? { ...entry, visible } : entry,
                        ),
                      )
                    }
                  />
                  <button
                    type="button"
                    aria-label={`Move ${item.label} up`}
                    disabled={index === 0}
                    onClick={() => reorder(item.id, -1)}
                    className="rounded-lg p-2 hover:bg-accent disabled:opacity-30"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Move ${item.label} down`}
                    disabled={index === sortedItems.length - 1}
                    onClick={() => reorder(item.id, 1)}
                    className="rounded-lg p-2 hover:bg-accent disabled:opacity-30"
                  >
                    <ArrowDown className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Remove ${item.label}`}
                    onClick={() => {
                      if (window.confirm(`Remove "${item.label}"?`))
                        onChange(
                          items
                            .filter(({ id }) => id !== item.id)
                            .map((entry, order) => ({ ...entry, order })),
                        );
                    }}
                    className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

type SiteSettingsScope = "all" | "site" | "about" | "contact";

export function SiteSettingsWorkspace({
  snapshot,
  onChange,
  scope = "all",
}: WorkspaceProps & { scope?: SiteSettingsScope }) {
  const showSite = scope === "all" || scope === "site";
  const showAbout = scope === "all" || scope === "about";
  const showContact = scope === "all" || scope === "contact";
  const [draft, setDraft] = useState(() => structuredClone(snapshot));
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState("");
  const [logoBusy, setLogoBusy] = useState(false);
  const [logoError, setLogoError] = useState("");
  const [portraitFile, setPortraitFile] = useState<File | null>(null);
  const [portraitPreview, setPortraitPreview] = useState("");
  const [portraitBusy, setPortraitBusy] = useState(false);
  const [portraitError, setPortraitError] = useState("");
  const [toolIconBusyId, setToolIconBusyId] = useState<string | null>(null);
  const portraitInputRef = useRef<HTMLInputElement>(null);
  const { urls: mediaUrls, error: mediaUrlError } = useCmsMediaUrls(draft.media);
  const logoAsset = draft.media.find((asset) => asset.id === draft.navigationLogo?.mediaId);
  const logoUrl = draft.navigationLogo
    ? (mediaUrls[draft.navigationLogo.mediaId] ??
      (logoAsset?.source.kind === "url" ? logoAsset.source.url : undefined))
    : undefined;
  const portraitAsset = draft.media.find((asset) => asset.id === draft.profile.portrait?.mediaId);
  const portraitUrl = draft.profile.portrait
    ? (mediaUrls[draft.profile.portrait.mediaId] ??
      (portraitAsset?.source.kind === "url" ? portraitAsset.source.url : undefined))
    : undefined;

  useEffect(
    () => () => {
      if (logoPreview) URL.revokeObjectURL(logoPreview);
    },
    [logoPreview],
  );

  useEffect(
    () => () => {
      if (portraitPreview) URL.revokeObjectURL(portraitPreview);
    },
    [portraitPreview],
  );

  useEffect(() => {
    if (!dirty) setDraft(structuredClone(snapshot));
  }, [snapshot, dirty]);

  function update(updateSnapshot: (current: ContentSnapshot) => ContentSnapshot) {
    setDraft((current) => updateSnapshot(structuredClone(current)));
    setDirty(true);
    setError("");
    setSuccess("");
  }

  async function uploadSoftwareIcon(toolId: string, file: File | undefined) {
    if (!file) return;
    const validationError = validateCmsImageFile(file);
    if (validationError) {
      setError(validationError);
      setSuccess("");
      return;
    }
    const tool = draft.profile.toolkit.find(({ id }) => id === toolId);
    if (!tool) {
      setError("The selected software icon entry no longer exists.");
      return;
    }
    setToolIconBusyId(toolId);
    setError("");
    try {
      const asset = await uploadCmsMediaFile(file, {
        alt: `${tool.name} software icon`,
        caption: `${tool.name} icon`,
      });
      update((current) => ({
        ...current,
        media: [asset, ...current.media.filter(({ id }) => id !== asset.id)],
        profile: {
          ...current.profile,
          toolkit: current.profile.toolkit.map((item) =>
            item.id === toolId
              ? {
                  ...item,
                  icon: "custom" as const,
                  iconMedia: { mediaId: asset.id, alt: asset.alt },
                }
              : item,
          ),
        },
      }));
      setSuccess("Software icon uploaded. Apply About changes, then save a CMS draft.");
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "The software icon could not be uploaded.",
      );
      setSuccess("");
    } finally {
      setToolIconBusyId(null);
    }
  }

  async function uploadLogo() {
    if (!logoFile) return;
    setLogoBusy(true);
    setLogoError("");
    try {
      const asset = await uploadCmsMediaFile(logoFile, {
        alt: logoFile.name,
        caption: logoFile.name,
      });
      update((current) => ({
        ...current,
        media: [asset, ...current.media.filter(({ id }) => id !== asset.id)],
        navigationLogo: { mediaId: asset.id, alt: asset.alt },
      }));
      setLogoFile(null);
      setLogoPreview("");
    } catch (uploadError) {
      setLogoError(
        uploadError instanceof Error
          ? uploadError.message
          : "The navigation logo could not be uploaded.",
      );
    } finally {
      setLogoBusy(false);
    }
  }

  function cancelPortraitSelection() {
    setPortraitFile(null);
    setPortraitPreview("");
    setPortraitError("");
    if (portraitInputRef.current) portraitInputRef.current.value = "";
  }

  async function uploadPortrait() {
    if (!portraitFile) return;
    setPortraitBusy(true);
    setPortraitError("");
    try {
      const asset = await uploadCmsMediaFile(portraitFile, {
        alt: `${draft.profile.fullName} profile photograph`,
        caption: "Profile photograph",
      });
      update((current) => ({
        ...current,
        media: [asset, ...current.media.filter(({ id }) => id !== asset.id)],
        profile: {
          ...current.profile,
          portrait: { mediaId: asset.id, alt: asset.alt },
        },
      }));
      cancelPortraitSelection();
    } catch (uploadError) {
      setPortraitError(
        uploadError instanceof Error
          ? uploadError.message
          : "The profile photograph could not be uploaded.",
      );
    } finally {
      setPortraitBusy(false);
    }
  }

  function save() {
    const mergeMedia = () => {
      const mediaById = new Map(snapshot.media.map((asset) => [asset.id, asset]));
      draft.media.forEach((asset) => mediaById.set(asset.id, asset));
      return [...mediaById.values()];
    };
    const updateSectionCopy = (pages: ContentSnapshot["pages"], type: "profile" | "contact") =>
      pages.map((page) => {
        if (page.slug !== "/") return page;
        const draftSection = draft.pages
          .find(({ id }) => id === page.id)
          ?.sections.find((section) => section.type === type);
        if (!draftSection || draftSection.type !== type) return page;
        return {
          ...page,
          sections: page.sections.map((section) => {
            if (section.type === "profile" && draftSection.type === "profile") {
              return {
                ...section,
                data: {
                  ...section.data,
                  eyebrow: draftSection.data.eyebrow,
                  title: draftSection.data.title,
                },
              };
            }
            if (section.type === "contact" && draftSection.type === "contact") {
              return {
                ...section,
                data: {
                  ...section.data,
                  eyebrow: draftSection.data.eyebrow,
                  title: draftSection.data.title,
                  intro: draftSection.data.intro,
                },
              };
            }
            return section;
          }),
        };
      });
    const candidate =
      scope === "site"
        ? {
            ...snapshot,
            identity: draft.identity,
            navigationLogo: draft.navigationLogo,
            navigation: draft.navigation,
            footer: draft.footer,
            media: mergeMedia(),
          }
        : scope === "about"
          ? {
              ...snapshot,
              profile: draft.profile,
              pages: updateSectionCopy(snapshot.pages, "profile"),
              media: mergeMedia(),
            }
          : scope === "contact"
            ? {
                ...snapshot,
                contact: draft.contact,
                pages: updateSectionCopy(snapshot.pages, "contact"),
              }
            : draft;
    const validation = contentSnapshotSchema.safeParse(candidate);
    if (!validation.success) {
      setError(validation.error.issues[0]?.message ?? "Review the site settings and link values.");
      setSuccess("");
      return;
    }
    onChange(validation.data);
    setDraft(validation.data);
    setDirty(false);
    setError("");
    setSuccess(
      `${scope === "about" ? "About" : scope === "contact" ? "Contact" : "Site settings"} applied to the dashboard session. Save a draft to persist them.`,
    );
  }

  function cancel() {
    if (dirty && !window.confirm("Discard unsaved site settings?")) return;
    setDraft(structuredClone(snapshot));
    setDirty(false);
    setError("");
    cancelPortraitSelection();
    setSuccess(
      `Unsaved ${scope === "about" ? "About" : scope === "contact" ? "Contact" : "site settings"} were discarded.`,
    );
  }

  const sectionOptions = draft.pages.flatMap((page) =>
    page.sections.map((section) => ({
      id: section.id,
      label: `${page.title} · ${section.type}`,
    })),
  );
  const homepageSections = draft.pages.find(({ slug }) => slug === "/")?.sections ?? [];
  const aboutSection = homepageSections.find((section) => section.type === "profile");
  const contactSection = homepageSections.find((section) => section.type === "contact");

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm text-muted-foreground">
            {scope === "about"
              ? "Profile and About section"
              : scope === "contact"
                ? "Contact details and form"
                : "Identity and site chrome"}
          </p>
          <h1 className="mt-1 text-3xl font-semibold">
            {scope === "about" ? "About" : scope === "contact" ? "Contact" : "Site settings"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {scope === "about"
              ? "Manage the public profile, portrait, toolkit, statistics, and About section copy."
              : scope === "contact"
                ? "Manage public contact details, form behavior, social links, and Contact section copy."
                : "Edit public identity, navigation, and footer content."}
          </p>
        </div>
        {dirty && (
          <span className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground">
            Unsaved{" "}
            {scope === "about" ? "About" : scope === "contact" ? "Contact" : "site settings"}
          </span>
        )}
      </header>
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
      {(showSite || showAbout) && (
        <section className={cardClass}>
          <h2 className="font-semibold">{scope === "about" ? "Profile" : "Site identity"}</h2>
          {showSite && (
            <fieldset className="mt-4 space-y-3 rounded-xl border border-border p-4">
              <legend className="px-1 text-xs font-medium text-muted-foreground">
                Navigation logo
              </legend>
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">
                  Select an existing media image
                </span>
                <select
                  aria-label="Navigation logo media"
                  value={draft.navigationLogo?.mediaId ?? ""}
                  onChange={(event) => {
                    const asset = draft.media.find(({ id }) => id === event.target.value);
                    update((current) => ({
                      ...current,
                      navigationLogo: asset ? { mediaId: asset.id, alt: asset.alt } : undefined,
                    }));
                  }}
                  className={inputClass}
                >
                  <option value="">No logo · use H fallback</option>
                  {draft.media.map((asset) => (
                    <option key={asset.id} value={asset.id}>
                      {asset.caption || asset.alt || asset.id}
                    </option>
                  ))}
                </select>
              </label>
              {logoUrl && (
                <div className="flex min-h-20 items-center rounded-lg border border-border bg-background p-3">
                  <img
                    src={logoUrl}
                    alt={draft.navigationLogo?.alt || `${draft.identity.name} logo`}
                    className="max-h-16 max-w-48 object-contain"
                  />
                </div>
              )}
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">
                  Upload or replace logo
                </span>
                <input
                  aria-label="Upload navigation logo"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/avif"
                  disabled={logoBusy}
                  onChange={(event) => {
                    const file = event.currentTarget.files?.[0];
                    if (!file) return;
                    const validationError = validateCmsImageFile(file);
                    if (validationError) {
                      setLogoFile(null);
                      setLogoPreview("");
                      setLogoError(validationError);
                      return;
                    }
                    setLogoFile(file);
                    setLogoPreview(URL.createObjectURL(file));
                    setLogoError("");
                  }}
                  className="block w-full text-xs file:mr-3 file:rounded-md file:border-0 file:bg-accent file:px-3 file:py-2 file:text-xs file:font-medium"
                />
              </label>
              {logoFile && (
                <>
                  <div className="flex min-h-20 items-center rounded-lg border border-border bg-background p-3">
                    <img
                      src={logoPreview}
                      alt="Selected navigation logo preview"
                      className="max-h-16 max-w-48 object-contain"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => void uploadLogo()}
                    disabled={logoBusy}
                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground disabled:cursor-wait disabled:opacity-60"
                  >
                    <Upload aria-hidden="true" className="h-4 w-4" />
                    {logoBusy ? "Uploading logo…" : "Upload and use logo"}
                  </button>
                </>
              )}
              {draft.navigationLogo && (
                <button
                  type="button"
                  onClick={() => update((current) => ({ ...current, navigationLogo: undefined }))}
                  className="rounded-lg border border-border px-3 py-2 text-xs hover:bg-accent"
                >
                  Remove navigation logo
                </button>
              )}
              {logoError && (
                <p role="alert" className="text-xs text-destructive">
                  {logoError}
                </p>
              )}
            </fieldset>
          )}
          {showAbout && (
            <fieldset className="mt-4 space-y-3 rounded-xl border border-border p-4">
              <legend className="px-1 text-xs font-medium text-muted-foreground">
                Profile Photograph
              </legend>
              {portraitUrl ? (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Current profile photograph</p>
                  <img
                    src={portraitUrl}
                    alt={
                      draft.profile.portrait?.alt || `${draft.profile.fullName} profile photograph`
                    }
                    className="h-48 w-48 rounded-xl object-cover"
                  />
                </div>
              ) : draft.profile.portrait ? (
                <p
                  role={mediaUrlError ? "alert" : "status"}
                  className="text-xs text-muted-foreground"
                >
                  {mediaUrlError
                    ? "The saved profile photograph could not be previewed. Check Storage access and retry."
                    : "Loading the saved profile photograph preview…"}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  No profile photograph is saved. The public About section will show its existing
                  fallback.
                </p>
              )}
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">
                  Upload or change photo · JPG, PNG, or WebP · up to 10 MB
                </span>
                <input
                  ref={portraitInputRef}
                  aria-label="Upload profile photograph"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                  disabled={portraitBusy}
                  onChange={(event) => {
                    const file = event.currentTarget.files?.[0];
                    if (!file) return;
                    const validationError = validateProfilePhotoFile(file);
                    if (validationError) {
                      setPortraitFile(null);
                      setPortraitPreview("");
                      setPortraitError(validationError);
                      event.currentTarget.value = "";
                      return;
                    }
                    setPortraitFile(file);
                    setPortraitPreview(URL.createObjectURL(file));
                    setPortraitError("");
                  }}
                  className="block w-full text-xs file:mr-3 file:rounded-md file:border-0 file:bg-accent file:px-3 file:py-2 file:text-xs file:font-medium"
                />
              </label>
              {portraitFile && (
                <>
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">Selected photo preview</p>
                    <img
                      src={portraitPreview}
                      alt="Selected profile photograph preview"
                      className="h-48 w-48 rounded-xl object-cover"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void uploadPortrait()}
                      disabled={portraitBusy}
                      className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground disabled:cursor-wait disabled:opacity-60"
                    >
                      <Upload aria-hidden="true" className="h-4 w-4" />
                      {portraitBusy ? "Uploading photo…" : "Upload and use photo"}
                    </button>
                    <button
                      type="button"
                      onClick={cancelPortraitSelection}
                      disabled={portraitBusy}
                      className="rounded-lg border border-border px-3 py-2 text-xs hover:bg-accent disabled:opacity-50"
                    >
                      Cancel photo selection
                    </button>
                  </div>
                </>
              )}
              {portraitError && (
                <p role="alert" className="text-xs text-destructive">
                  {portraitError}
                </p>
              )}
            </fieldset>
          )}
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {(
              [
                ["name", "Public name"],
                ["fullName", "Full name"],
                ["role", "Role"],
                ["location", "Location"],
                ["availability", "Availability"],
              ] as const
            )
              .filter(() => showSite)
              .map(([key, label]) => (
                <TextField
                  key={key}
                  label={label}
                  value={draft.identity[key]}
                  onChange={(value) =>
                    update((current) => ({
                      ...current,
                      identity: { ...current.identity, [key]: value },
                    }))
                  }
                  type="text"
                />
              ))}
            {showSite && (
              <CheckField
                label="Available for new work"
                checked={draft.identity.available}
                onChange={(available) =>
                  update((current) => ({
                    ...current,
                    identity: { ...current.identity, available },
                  }))
                }
              />
            )}
            {showAbout && (
              <TextField
                label="Profile full name"
                value={draft.profile.fullName}
                onChange={(fullName) =>
                  update((current) => ({
                    ...current,
                    profile: { ...current.profile, fullName },
                  }))
                }
              />
            )}
            {showAbout && (
              <TextField
                label="Profile role"
                value={draft.profile.role}
                onChange={(role) =>
                  update((current) => ({ ...current, profile: { ...current.profile, role } }))
                }
              />
            )}
            {showAbout && (
              <TextField
                label="Profile location"
                value={draft.profile.location}
                onChange={(location) =>
                  update((current) => ({ ...current, profile: { ...current.profile, location } }))
                }
              />
            )}
            {showAbout && (
              <TextField
                label="Profile focus"
                value={draft.profile.focus}
                onChange={(focus) =>
                  update((current) => ({ ...current, profile: { ...current.profile, focus } }))
                }
              />
            )}
            {showAbout && (
              <TextField
                label="Profile biography · one paragraph per line"
                multiline
                value={draft.profile.biography.join("\n")}
                onChange={(value) =>
                  update((current) => ({
                    ...current,
                    profile: { ...current.profile, biography: value.split("\n") },
                  }))
                }
              />
            )}
          </div>
          {showAbout && (
            <div className="mt-6 grid gap-5 lg:grid-cols-2">
              <section className="rounded-xl border border-border p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold">
                      Digital Portfolio Pass — Software Icons
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Choose a supported icon or upload a custom image. Only the icons appear on the
                      public pass.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      update((current) => ({
                        ...current,
                        profile: {
                          ...current.profile,
                          toolkit: [
                            ...current.profile.toolkit,
                            {
                              id: `toolkit:${crypto.randomUUID()}`,
                              order: current.profile.toolkit.length,
                              name: "New tool",
                              use: "",
                              icon: "illustrator",
                            },
                          ],
                        },
                      }))
                    }
                    className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs hover:bg-accent"
                  >
                    <Plus className="h-4 w-4" /> Add tool
                  </button>
                </div>
                {draft.profile.toolkit.length === 0 ? (
                  <p className="mt-4 rounded-lg border border-dashed border-border p-4 text-xs text-muted-foreground">
                    No software icons yet.
                  </p>
                ) : (
                  <ol className="mt-4 space-y-3">
                    {[...draft.profile.toolkit]
                      .sort((a, b) => a.order - b.order)
                      .map((tool, index) => (
                        <li key={tool.id} className="rounded-lg border border-border p-3">
                          <div className="grid gap-3 sm:grid-cols-2">
                            <TextField
                              label="Software name"
                              value={tool.name}
                              onChange={(name) =>
                                update((current) => ({
                                  ...current,
                                  profile: {
                                    ...current.profile,
                                    toolkit: current.profile.toolkit.map((item) =>
                                      item.id === tool.id ? { ...item, name } : item,
                                    ),
                                  },
                                }))
                              }
                            />
                            <label className="block space-y-1.5">
                              <span className="text-xs font-medium text-muted-foreground">
                                Software icon
                              </span>
                              <select
                                aria-label={`${tool.name} software icon`}
                                value={tool.icon ?? inferSoftwareIcon(tool.name)}
                                onChange={(event) =>
                                  update((current) => ({
                                    ...current,
                                    profile: {
                                      ...current.profile,
                                      toolkit: current.profile.toolkit.map((item) => {
                                        if (item.id !== tool.id) return item;
                                        const { iconMedia, ...toolWithoutMedia } = item;
                                        return {
                                          ...toolWithoutMedia,
                                          icon: softwareIconSchema.parse(event.target.value),
                                          ...(event.target.value === "custom" && iconMedia
                                            ? { iconMedia }
                                            : {}),
                                        };
                                      }),
                                    },
                                  }))
                                }
                                className={inputClass}
                              >
                                {softwareIconSchema.options.map((icon) => (
                                  <option key={icon} value={icon}>
                                    {icon === "after-effects"
                                      ? "Adobe After Effects"
                                      : icon === "premiere-pro"
                                        ? "Adobe Premiere Pro"
                                        : icon === "custom"
                                          ? "Custom uploaded icon"
                                          : icon === "other"
                                            ? "Other"
                                            : icon === "figma"
                                              ? "Figma"
                                              : `Adobe ${icon === "illustrator" ? "Illustrator" : "Photoshop"}`}
                                  </option>
                                ))}
                              </select>
                            </label>
                          </div>
                          <div className="mt-3 flex flex-wrap items-center gap-3">
                            {(() => {
                              const iconAsset = tool.iconMedia
                                ? draft.media.find(({ id }) => id === tool.iconMedia?.mediaId)
                                : undefined;
                              const iconUrl = tool.iconMedia
                                ? (mediaUrls[tool.iconMedia.mediaId] ??
                                  (iconAsset?.source.kind === "url"
                                    ? iconAsset.source.url
                                    : undefined))
                                : undefined;
                              return (
                                <SoftwareToolIcon
                                  label={`${tool.name} icon preview`}
                                  icon={tool.icon ?? inferSoftwareIcon(tool.name)}
                                  mediaUrl={iconUrl}
                                  className="h-10 w-10"
                                />
                              );
                            })()}
                            <label className="block min-w-0 flex-1 space-y-1.5">
                              <span className="text-xs font-medium text-muted-foreground">
                                Upload custom icon · JPG, PNG, WebP, or AVIF
                              </span>
                              <input
                                aria-label={`Upload ${tool.name} custom icon`}
                                type="file"
                                accept="image/jpeg,image/png,image/webp,image/avif"
                                disabled={toolIconBusyId === tool.id}
                                onChange={(event) => {
                                  void uploadSoftwareIcon(tool.id, event.currentTarget.files?.[0]);
                                  event.currentTarget.value = "";
                                }}
                                className="block w-full text-xs file:mr-3 file:rounded-md file:border-0 file:bg-accent file:px-3 file:py-2 file:text-xs file:font-medium"
                              />
                            </label>
                            {toolIconBusyId === tool.id && (
                              <span role="status" className="text-xs text-muted-foreground">
                                Uploading…
                              </span>
                            )}
                          </div>
                          <div className="mt-2 flex justify-end gap-1">
                            <button
                              type="button"
                              aria-label={`Move tool ${tool.name} up`}
                              disabled={index === 0}
                              onClick={() => {
                                const sorted = [...draft.profile.toolkit].sort(
                                  (a, b) => a.order - b.order,
                                );
                                [sorted[index], sorted[index - 1]] = [
                                  sorted[index - 1]!,
                                  sorted[index]!,
                                ];
                                update((current) => ({
                                  ...current,
                                  profile: {
                                    ...current.profile,
                                    toolkit: sorted.map((item, order) => ({ ...item, order })),
                                  },
                                }));
                              }}
                              className="rounded p-1.5 hover:bg-accent disabled:opacity-30"
                            >
                              <ArrowUp className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              aria-label={`Move tool ${tool.name} down`}
                              disabled={index === draft.profile.toolkit.length - 1}
                              onClick={() => {
                                const sorted = [...draft.profile.toolkit].sort(
                                  (a, b) => a.order - b.order,
                                );
                                [sorted[index], sorted[index + 1]] = [
                                  sorted[index + 1]!,
                                  sorted[index]!,
                                ];
                                update((current) => ({
                                  ...current,
                                  profile: {
                                    ...current.profile,
                                    toolkit: sorted.map((item, order) => ({ ...item, order })),
                                  },
                                }));
                              }}
                              className="rounded p-1.5 hover:bg-accent disabled:opacity-30"
                            >
                              <ArrowDown className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              aria-label={`Remove tool ${tool.name}`}
                              onClick={() => {
                                if (
                                  !window.confirm(`Remove "${tool.name}" from the profile draft?`)
                                )
                                  return;
                                update((current) => ({
                                  ...current,
                                  profile: {
                                    ...current.profile,
                                    toolkit: current.profile.toolkit
                                      .filter((item) => item.id !== tool.id)
                                      .map((item, order) => ({ ...item, order })),
                                  },
                                }));
                              }}
                              className="rounded p-1.5 text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </li>
                      ))}
                  </ol>
                )}
              </section>
              <section className="rounded-xl border border-border p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold">Profile statistics</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Edit the values and labels displayed in the profile.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      update((current) => ({
                        ...current,
                        profile: {
                          ...current.profile,
                          stats: [
                            ...current.profile.stats,
                            {
                              id: `stat:${crypto.randomUUID()}`,
                              order: current.profile.stats.length,
                              value: "",
                              label: "New statistic",
                            },
                          ],
                        },
                      }))
                    }
                    className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs hover:bg-accent"
                  >
                    <Plus className="h-4 w-4" /> Add statistic
                  </button>
                </div>
                {draft.profile.stats.length === 0 ? (
                  <p className="mt-4 rounded-lg border border-dashed border-border p-4 text-xs text-muted-foreground">
                    No profile statistics yet.
                  </p>
                ) : (
                  <ol className="mt-4 space-y-3">
                    {[...draft.profile.stats]
                      .sort((a, b) => a.order - b.order)
                      .map((stat, index) => (
                        <li key={stat.id} className="rounded-lg border border-border p-3">
                          <div className="grid gap-3 sm:grid-cols-2">
                            <TextField
                              label="Statistic value"
                              value={stat.value}
                              onChange={(value) =>
                                update((current) => ({
                                  ...current,
                                  profile: {
                                    ...current.profile,
                                    stats: current.profile.stats.map((item) =>
                                      item.id === stat.id ? { ...item, value } : item,
                                    ),
                                  },
                                }))
                              }
                            />
                            <TextField
                              label="Statistic label"
                              value={stat.label}
                              onChange={(label) =>
                                update((current) => ({
                                  ...current,
                                  profile: {
                                    ...current.profile,
                                    stats: current.profile.stats.map((item) =>
                                      item.id === stat.id ? { ...item, label } : item,
                                    ),
                                  },
                                }))
                              }
                            />
                          </div>
                          <div className="mt-2 flex justify-end gap-1">
                            <button
                              type="button"
                              aria-label={`Move statistic ${stat.label} up`}
                              disabled={index === 0}
                              onClick={() => {
                                const sorted = [...draft.profile.stats].sort(
                                  (a, b) => a.order - b.order,
                                );
                                [sorted[index], sorted[index - 1]] = [
                                  sorted[index - 1]!,
                                  sorted[index]!,
                                ];
                                update((current) => ({
                                  ...current,
                                  profile: {
                                    ...current.profile,
                                    stats: sorted.map((item, order) => ({ ...item, order })),
                                  },
                                }));
                              }}
                              className="rounded p-1.5 hover:bg-accent disabled:opacity-30"
                            >
                              <ArrowUp className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              aria-label={`Move statistic ${stat.label} down`}
                              disabled={index === draft.profile.stats.length - 1}
                              onClick={() => {
                                const sorted = [...draft.profile.stats].sort(
                                  (a, b) => a.order - b.order,
                                );
                                [sorted[index], sorted[index + 1]] = [
                                  sorted[index + 1]!,
                                  sorted[index]!,
                                ];
                                update((current) => ({
                                  ...current,
                                  profile: {
                                    ...current.profile,
                                    stats: sorted.map((item, order) => ({ ...item, order })),
                                  },
                                }));
                              }}
                              className="rounded p-1.5 hover:bg-accent disabled:opacity-30"
                            >
                              <ArrowDown className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              aria-label={`Remove statistic ${stat.label}`}
                              onClick={() => {
                                if (
                                  !window.confirm(`Remove "${stat.label}" from the profile draft?`)
                                )
                                  return;
                                update((current) => ({
                                  ...current,
                                  profile: {
                                    ...current.profile,
                                    stats: current.profile.stats
                                      .filter((item) => item.id !== stat.id)
                                      .map((item, order) => ({ ...item, order })),
                                  },
                                }));
                              }}
                              className="rounded p-1.5 text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </li>
                      ))}
                  </ol>
                )}
              </section>
            </div>
          )}
        </section>
      )}
      {showAbout && aboutSection?.type === "profile" && (
        <section className={cardClass}>
          <h2 className="font-semibold">About section copy</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Adjust the eyebrow and heading shown above the public profile.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <TextField
              label="About section eyebrow"
              value={aboutSection.data.eyebrow}
              onChange={(value) =>
                update((current) => ({
                  ...current,
                  pages: current.pages.map((page) =>
                    page.slug !== "/"
                      ? page
                      : {
                          ...page,
                          sections: page.sections.map((section) =>
                            section.type === "profile"
                              ? { ...section, data: { ...section.data, eyebrow: value } }
                              : section,
                          ),
                        },
                  ),
                }))
              }
            />
            <TextField
              label="About section heading"
              value={aboutSection.data.title}
              onChange={(value) =>
                update((current) => ({
                  ...current,
                  pages: current.pages.map((page) =>
                    page.slug !== "/"
                      ? page
                      : {
                          ...page,
                          sections: page.sections.map((section) =>
                            section.type === "profile"
                              ? { ...section, data: { ...section.data, title: value } }
                              : section,
                          ),
                        },
                  ),
                }))
              }
            />
          </div>
        </section>
      )}
      {showContact && contactSection?.type === "contact" && (
        <section className={cardClass}>
          <h2 className="font-semibold">Contact section copy</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Edit the public contact heading and introduction.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <TextField
              label="Contact section eyebrow"
              value={contactSection.data.eyebrow}
              onChange={(value) =>
                update((current) => ({
                  ...current,
                  pages: current.pages.map((page) =>
                    page.slug !== "/"
                      ? page
                      : {
                          ...page,
                          sections: page.sections.map((section) =>
                            section.type === "contact"
                              ? { ...section, data: { ...section.data, eyebrow: value } }
                              : section,
                          ),
                        },
                  ),
                }))
              }
            />
            <TextField
              label="Contact section heading"
              value={contactSection.data.title}
              onChange={(value) =>
                update((current) => ({
                  ...current,
                  pages: current.pages.map((page) =>
                    page.slug !== "/"
                      ? page
                      : {
                          ...page,
                          sections: page.sections.map((section) =>
                            section.type === "contact"
                              ? { ...section, data: { ...section.data, title: value } }
                              : section,
                          ),
                        },
                  ),
                }))
              }
            />
            <TextField
              label="Contact section introduction"
              multiline
              value={contactSection.data.intro}
              onChange={(value) =>
                update((current) => ({
                  ...current,
                  pages: current.pages.map((page) =>
                    page.slug !== "/"
                      ? page
                      : {
                          ...page,
                          sections: page.sections.map((section) =>
                            section.type === "contact"
                              ? { ...section, data: { ...section.data, intro: value } }
                              : section,
                          ),
                        },
                  ),
                }))
              }
            />
          </div>
        </section>
      )}
      {showContact && (
        <section className={cardClass}>
          <h2 className="font-semibold">Contact form behavior</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <TextField
              label="Public contact email"
              type="email"
              value={draft.contact.publicEmail}
              onChange={(publicEmail) =>
                update((current) => ({
                  ...current,
                  contact: { ...current.contact, publicEmail },
                }))
              }
            />
            <TextField
              label="WhatsApp"
              value={draft.contact.whatsapp}
              onChange={(whatsapp) =>
                update((current) => ({
                  ...current,
                  contact: { ...current.contact, whatsapp },
                }))
              }
            />
            <CheckField
              label="Contact form enabled"
              checked={draft.contact.form.enabled}
              onChange={(enabled) =>
                update((current) => ({
                  ...current,
                  contact: { ...current.contact, form: { ...current.contact.form, enabled } },
                }))
              }
            />
            <CheckField
              label="Allow company field"
              checked={draft.contact.form.allowCompany}
              onChange={(allowCompany) =>
                update((current) => ({
                  ...current,
                  contact: { ...current.contact, form: { ...current.contact.form, allowCompany } },
                }))
              }
            />
            <CheckField
              label="Allow additional details"
              checked={draft.contact.form.allowAdditionalDetails}
              onChange={(allowAdditionalDetails) =>
                update((current) => ({
                  ...current,
                  contact: {
                    ...current.contact,
                    form: { ...current.contact.form, allowAdditionalDetails },
                  },
                }))
              }
            />
            <label className="block space-y-1.5">
              <span className="text-xs text-muted-foreground">Form delivery mode</span>
              <select
                value={draft.contact.form.delivery}
                onChange={(event) =>
                  update((current) => ({
                    ...current,
                    contact: {
                      ...current.contact,
                      form: {
                        ...current.contact.form,
                        delivery: event.target.value as "mailto" | "none",
                      },
                    },
                  }))
                }
                className={inputClass}
              >
                <option value="mailto">Email client (mailto)</option>
                <option value="none">Disabled delivery</option>
              </select>
            </label>
            <TextField
              label="Additional details label"
              value={draft.contact.form.additionalDetailsLabel}
              onChange={(additionalDetailsLabel) =>
                update((current) => ({
                  ...current,
                  contact: {
                    ...current.contact,
                    form: { ...current.contact.form, additionalDetailsLabel },
                  },
                }))
              }
            />
            <TextField
              label="Project types · one per line"
              multiline
              value={draft.contact.form.projectTypes.join("\n")}
              onChange={(value) =>
                update((current) => ({
                  ...current,
                  contact: {
                    ...current.contact,
                    form: { ...current.contact.form, projectTypes: value.split("\n") },
                  },
                }))
              }
            />
            <TextField
              label="Timelines · one per line"
              multiline
              value={draft.contact.form.timelines.join("\n")}
              onChange={(value) =>
                update((current) => ({
                  ...current,
                  contact: {
                    ...current.contact,
                    form: { ...current.contact.form, timelines: value.split("\n") },
                  },
                }))
              }
            />
          </div>
        </section>
      )}
      {showContact && (
        <section className={cardClass}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">Social links</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Add, edit, or remove supported URL entries.
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                update((current) => {
                  const key = `social-${crypto.randomUUID().slice(0, 8)}`;
                  return {
                    ...current,
                    contact: {
                      ...current.contact,
                      socialLinks: {
                        ...current.contact.socialLinks,
                        [key]: "https://example.com/",
                      },
                    },
                  };
                })
              }
              className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs hover:bg-accent"
            >
              <Plus className="h-4 w-4" /> Add social link
            </button>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {Object.entries(draft.contact.socialLinks).map(([name, url]) => (
              <div key={name} className="flex items-end gap-2">
                <TextField
                  label={`${name} URL`}
                  value={url}
                  type="url"
                  onChange={(value) =>
                    update((current) => ({
                      ...current,
                      contact: {
                        ...current.contact,
                        socialLinks: { ...current.contact.socialLinks, [name]: value },
                      },
                    }))
                  }
                />
                <button
                  type="button"
                  aria-label={`Remove ${name} social link`}
                  onClick={() => {
                    if (!window.confirm(`Remove the ${name} social link?`)) return;
                    update((current) => {
                      const socialLinks = { ...current.contact.socialLinks };
                      delete socialLinks[name];
                      return { ...current, contact: { ...current.contact, socialLinks } };
                    });
                  }}
                  className="mb-0.5 rounded-lg p-2 text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
      {showSite && (
        <>
          <NavigationEditor
            title="Primary navigation"
            items={draft.navigation}
            pages={draft.pages}
            sections={sectionOptions}
            onChange={(navigation) => update((current) => ({ ...current, navigation }))}
          />
          <section className={cardClass}>
            <h2 className="font-semibold">Footer content</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {(
                [
                  ["identityLabel", "Identity label"],
                  ["ctaEyebrow", "Call-to-action eyebrow"],
                  ["ctaFallback", "Call-to-action text"],
                  ["socialHeading", "Social heading"],
                  ["navigationHeading", "Navigation heading"],
                  ["locationHeading", "Location heading"],
                  ["locationText", "Location text"],
                  ["timezone", "Timezone"],
                  ["copyrightText", "Copyright text"],
                  ["backToTopLabel", "Back-to-top label"],
                ] as const
              ).map(([key, label]) => (
                <TextField
                  key={key}
                  label={label}
                  value={draft.footer[key]}
                  onChange={(value) =>
                    update((current) => ({
                      ...current,
                      footer: { ...current.footer, [key]: value },
                    }))
                  }
                />
              ))}
            </div>
          </section>
          <NavigationEditor
            title="Footer links"
            items={draft.footer.navigation}
            pages={draft.pages}
            sections={sectionOptions}
            onChange={(navigation) =>
              update((current) => ({ ...current, footer: { ...current.footer, navigation } }))
            }
          />
        </>
      )}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={cancel}
          className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-accent"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={save}
          disabled={!dirty}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          Apply changes
        </button>
      </div>
    </div>
  );
}

export function DesignSeoWorkspace({ snapshot, onChange }: WorkspaceProps) {
  const [draft, setDraft] = useState(() => structuredClone(snapshot));
  const [dirty, setDirty] = useState(false);
  const [pageId, setPageId] = useState(snapshot.pages[0]?.id ?? "");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!dirty) {
      setDraft(structuredClone(snapshot));
    }
  }, [snapshot, dirty]);

  function update(updateSnapshot: (current: ContentSnapshot) => ContentSnapshot) {
    setDraft((current) => updateSnapshot(structuredClone(current)));
    setDirty(true);
    setError("");
    setSuccess("");
  }

  function save() {
    const validation = contentSnapshotSchema.safeParse(draft);
    if (!validation.success) {
      setError(validation.error.issues[0]?.message ?? "Check the design and SEO fields.");
      setSuccess("");
      return;
    }
    onChange(validation.data);
    setDraft(validation.data);
    setDirty(false);
    setError("");
    setSuccess("Design and SEO changes applied to the dashboard session. Save a draft to persist.");
  }

  function cancel() {
    if (dirty && !window.confirm("Discard unsaved design and SEO changes?")) return;
    setDraft(structuredClone(snapshot));
    setDirty(false);
    setError("");
    setSuccess("Unsaved design and SEO changes were discarded.");
  }

  const activePage = draft.pages.find(({ id }) => id === pageId) ?? draft.pages[0];
  const imageOptions = draft.media;
  const sampleColor = draft.theme.colors["primary"] ?? "currentColor";

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-muted-foreground">Preview appearance and metadata</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Design &amp; SEO</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Edit schema-supported theme tokens and global or page-level search and social metadata.
        </p>
      </header>
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
      {dirty && <p className="text-xs text-primary">Unsaved design and SEO changes</p>}
      <section className={cardClass}>
        <div>
          <h2 className="font-semibold">Theme tokens</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Values are validated by the existing CMS theme schema.
          </p>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Object.entries(draft.theme.colors).map(([name, value]) => (
            <TextField
              key={name}
              label={`Color: ${name}`}
              value={value}
              onChange={(color) =>
                update((current) => ({
                  ...current,
                  theme: { ...current.theme, colors: { ...current.theme.colors, [name]: color } },
                }))
              }
            />
          ))}
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Display font</span>
            <select
              value={draft.theme.typography.displayFont}
              onChange={(event) =>
                update((current) => ({
                  ...current,
                  theme: {
                    ...current.theme,
                    typography: {
                      ...current.theme.typography,
                      displayFont: event.target
                        .value as typeof current.theme.typography.displayFont,
                    },
                  },
                }))
              }
              className={inputClass}
            >
              {["Space Grotesk", "Manrope", "system-ui", "sans-serif", "serif"].map((font) => (
                <option key={font}>{font}</option>
              ))}
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Body font</span>
            <select
              value={draft.theme.typography.bodyFont}
              onChange={(event) =>
                update((current) => ({
                  ...current,
                  theme: {
                    ...current.theme,
                    typography: {
                      ...current.theme.typography,
                      bodyFont: event.target.value as typeof current.theme.typography.bodyFont,
                    },
                  },
                }))
              }
              className={inputClass}
            >
              {["Space Grotesk", "Manrope", "system-ui", "sans-serif", "serif"].map((font) => (
                <option key={font}>{font}</option>
              ))}
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Display font weight</span>
            <select
              aria-label="Display font weight"
              value={draft.theme.typography.displayWeight}
              onChange={(event) =>
                update((current) => ({
                  ...current,
                  theme: {
                    ...current.theme,
                    typography: {
                      ...current.theme.typography,
                      displayWeight: Number(event.target.value),
                    },
                  },
                }))
              }
              className={inputClass}
            >
              {[300, 400, 500, 600, 700, 800, 900].map((weight) => (
                <option key={weight} value={weight}>
                  {weight}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Body font weight</span>
            <select
              aria-label="Body font weight"
              value={draft.theme.typography.bodyWeight}
              onChange={(event) =>
                update((current) => ({
                  ...current,
                  theme: {
                    ...current.theme,
                    typography: {
                      ...current.theme.typography,
                      bodyWeight: Number(event.target.value),
                    },
                  },
                }))
              }
              className={inputClass}
            >
              {[300, 400, 500, 600, 700, 800, 900].map((weight) => (
                <option key={weight} value={weight}>
                  {weight}
                </option>
              ))}
            </select>
          </label>
          <TextField
            label="Section spacing (px)"
            type="number"
            value={String(draft.theme.spacing.sectionBlock)}
            onChange={(value) =>
              update((current) => ({
                ...current,
                theme: {
                  ...current.theme,
                  spacing: { ...current.theme.spacing, sectionBlock: Number(value) },
                },
              }))
            }
          />
          <TextField
            label="Spacing scale · comma-separated pixels"
            value={draft.theme.spacing.scale.join(", ")}
            onChange={(value) =>
              update((current) => ({
                ...current,
                theme: {
                  ...current.theme,
                  spacing: {
                    ...current.theme.spacing,
                    scale: value
                      .split(",")
                      .map((item) => item.trim())
                      .filter(Boolean)
                      .map(Number),
                  },
                },
              }))
            }
          />
          <TextField
            label="Content max width (px)"
            type="number"
            value={String(draft.theme.layout.contentMaxWidth)}
            onChange={(value) =>
              update((current) => ({
                ...current,
                theme: {
                  ...current.theme,
                  layout: { ...current.theme.layout, contentMaxWidth: Number(value) },
                },
              }))
            }
          />
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Project grid</span>
            <select
              value={draft.theme.layout.projectGrid}
              onChange={(event) =>
                update((current) => ({
                  ...current,
                  theme: {
                    ...current.theme,
                    layout: {
                      ...current.theme.layout,
                      projectGrid: event.target.value as typeof current.theme.layout.projectGrid,
                    },
                  },
                }))
              }
              className={inputClass}
            >
              <option value="grid">Grid</option>
              <option value="masonry">Masonry</option>
              <option value="editorial">Editorial</option>
            </select>
          </label>
          <TextField
            label="Corner radius (px)"
            type="number"
            value={String(draft.theme.radius)}
            onChange={(value) =>
              update((current) => ({
                ...current,
                theme: { ...current.theme, radius: Number(value) },
              }))
            }
          />
          <div className="sm:col-span-2 xl:col-span-3">
            <h3 className="text-sm font-medium">Section layout variants</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {Object.entries(draft.theme.layout.sectionVariants).map(([section, variant]) => (
                <TextField
                  key={section}
                  label={`${section} variant`}
                  value={variant}
                  onChange={(value) =>
                    update((current) => ({
                      ...current,
                      theme: {
                        ...current.theme,
                        layout: {
                          ...current.theme.layout,
                          sectionVariants: {
                            ...current.theme.layout.sectionVariants,
                            [section]: value,
                          },
                        },
                      },
                    }))
                  }
                />
              ))}
            </div>
          </div>
        </div>
        <div className="mt-5 rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground">Theme sample preview</p>
          <div
            className="mt-3 rounded-xl border border-border p-5"
            style={{ borderColor: sampleColor, fontFamily: draft.theme.typography.bodyFont }}
          >
            <p className="text-xs" style={{ color: sampleColor }}>
              Selected accent · {sampleColor}
            </p>
            <p
              className="mt-2 text-xl font-semibold"
              style={{ fontFamily: draft.theme.typography.displayFont }}
            >
              A preview of your visual system
            </p>
            <p className="mt-1 text-sm text-muted-foreground">Local demo preview only</p>
          </div>
        </div>
      </section>
      <section className={cardClass}>
        <h2 className="font-semibold">Global SEO and social metadata</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <TextField
            label="Website title"
            value={draft.seo.title}
            onChange={(title) =>
              update((current) => ({ ...current, seo: { ...current.seo, title } }))
            }
          />
          <TextField
            label="Canonical path"
            value={draft.seo.canonicalPath ?? ""}
            onChange={(canonicalPath) =>
              update((current) => ({ ...current, seo: { ...current.seo, canonicalPath } }))
            }
          />
          <div className="sm:col-span-2">
            <TextField
              label="Website description"
              multiline
              value={draft.seo.description}
              onChange={(description) =>
                update((current) => ({ ...current, seo: { ...current.seo, description } }))
              }
            />
          </div>
          <TextField
            label="Open Graph title"
            value={draft.seo.social.openGraphTitle}
            onChange={(openGraphTitle) =>
              update((current) => ({
                ...current,
                seo: { ...current.seo, social: { ...current.seo.social, openGraphTitle } },
              }))
            }
          />
          <TextField
            label="Open Graph description"
            multiline
            value={draft.seo.social.openGraphDescription}
            onChange={(openGraphDescription) =>
              update((current) => ({
                ...current,
                seo: { ...current.seo, social: { ...current.seo.social, openGraphDescription } },
              }))
            }
          />
          <TextField
            label="Twitter title"
            value={draft.seo.social.twitterTitle}
            onChange={(twitterTitle) =>
              update((current) => ({
                ...current,
                seo: { ...current.seo, social: { ...current.seo.social, twitterTitle } },
              }))
            }
          />
          <TextField
            label="Twitter description"
            multiline
            value={draft.seo.social.twitterDescription}
            onChange={(twitterDescription) =>
              update((current) => ({
                ...current,
                seo: { ...current.seo, social: { ...current.seo.social, twitterDescription } },
              }))
            }
          />
          <label className="block space-y-1.5">
            <span className="text-xs text-muted-foreground">Social card format</span>
            <select
              value={draft.seo.social.twitterCard}
              onChange={(event) =>
                update((current) => ({
                  ...current,
                  seo: {
                    ...current.seo,
                    social: {
                      ...current.seo.social,
                      twitterCard: event.target.value as typeof current.seo.social.twitterCard,
                    },
                  },
                }))
              }
              className={inputClass}
            >
              <option value="summary">Summary</option>
              <option value="summary_large_image">Large image</option>
            </select>
          </label>
          <CheckField
            label="Allow indexing"
            checked={draft.seo.robots.index}
            onChange={(index) =>
              update((current) => ({
                ...current,
                seo: { ...current.seo, robots: { ...current.seo.robots, index } },
              }))
            }
          />
          <CheckField
            label="Allow following links"
            checked={draft.seo.robots.follow}
            onChange={(follow) =>
              update((current) => ({
                ...current,
                seo: { ...current.seo, robots: { ...current.seo.robots, follow } },
              }))
            }
          />
          <label className="block space-y-1.5 sm:col-span-2">
            <span className="text-xs text-muted-foreground">Open Graph image · existing media</span>
            <select
              aria-label="Global SEO image"
              value={draft.seo.social.openGraphImage?.mediaId ?? ""}
              onChange={(event) => {
                const asset = imageOptions.find(({ id }) => id === event.target.value);
                update((current) => ({
                  ...current,
                  seo: {
                    ...current.seo,
                    social: {
                      ...current.seo.social,
                      openGraphImage: asset ? { mediaId: asset.id, alt: asset.alt } : undefined,
                    },
                  },
                }));
              }}
              className={inputClass}
            >
              <option value="">No image selected</option>
              {imageOptions.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.caption || asset.alt}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1.5 sm:col-span-2">
            <span className="text-xs text-muted-foreground">Twitter image · existing media</span>
            <select
              aria-label="Global Twitter image"
              value={draft.seo.social.twitterImage?.mediaId ?? ""}
              onChange={(event) => {
                const asset = imageOptions.find(({ id }) => id === event.target.value);
                update((current) => ({
                  ...current,
                  seo: {
                    ...current.seo,
                    social: {
                      ...current.seo.social,
                      twitterImage: asset ? { mediaId: asset.id, alt: asset.alt } : undefined,
                    },
                  },
                }));
              }}
              className={inputClass}
            >
              <option value="">No image selected</option>
              {imageOptions.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.caption || asset.alt}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>
      {activePage && (
        <section className={cardClass}>
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h2 className="font-semibold">Page-specific SEO</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Page metadata is stored with each page record.
              </p>
            </div>
            <select
              aria-label="SEO page"
              value={activePage.id}
              onChange={(event) => setPageId(event.target.value)}
              className={`${inputClass} sm:w-64`}
            >
              {draft.pages.map((page) => (
                <option key={page.id} value={page.id}>
                  {page.title} · {page.slug}
                </option>
              ))}
            </select>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <TextField
              label="Page title"
              value={activePage.seo.title}
              onChange={(title) =>
                update((current) => ({
                  ...current,
                  pages: current.pages.map((page) =>
                    page.id === activePage.id ? { ...page, seo: { ...page.seo, title } } : page,
                  ),
                }))
              }
            />
            <TextField
              label="Canonical path"
              value={activePage.seo.canonicalPath ?? ""}
              onChange={(canonicalPath) =>
                update((current) => ({
                  ...current,
                  pages: current.pages.map((page) =>
                    page.id === activePage.id
                      ? { ...page, seo: { ...page.seo, canonicalPath } }
                      : page,
                  ),
                }))
              }
            />
            <div className="sm:col-span-2">
              <TextField
                label="Page description"
                multiline
                value={activePage.seo.description}
                onChange={(description) =>
                  update((current) => ({
                    ...current,
                    pages: current.pages.map((page) =>
                      page.id === activePage.id
                        ? { ...page, seo: { ...page.seo, description } }
                        : page,
                    ),
                  }))
                }
              />
            </div>
            <TextField
              label="Open Graph title"
              value={activePage.seo.social.openGraphTitle}
              onChange={(openGraphTitle) =>
                update((current) => ({
                  ...current,
                  pages: current.pages.map((page) =>
                    page.id === activePage.id
                      ? {
                          ...page,
                          seo: { ...page.seo, social: { ...page.seo.social, openGraphTitle } },
                        }
                      : page,
                  ),
                }))
              }
            />
            <TextField
              label="Open Graph description"
              multiline
              value={activePage.seo.social.openGraphDescription}
              onChange={(openGraphDescription) =>
                update((current) => ({
                  ...current,
                  pages: current.pages.map((page) =>
                    page.id === activePage.id
                      ? {
                          ...page,
                          seo: {
                            ...page.seo,
                            social: { ...page.seo.social, openGraphDescription },
                          },
                        }
                      : page,
                  ),
                }))
              }
            />
            <TextField
              label="Twitter title"
              value={activePage.seo.social.twitterTitle}
              onChange={(twitterTitle) =>
                update((current) => ({
                  ...current,
                  pages: current.pages.map((page) =>
                    page.id === activePage.id
                      ? {
                          ...page,
                          seo: { ...page.seo, social: { ...page.seo.social, twitterTitle } },
                        }
                      : page,
                  ),
                }))
              }
            />
            <TextField
              label="Twitter description"
              multiline
              value={activePage.seo.social.twitterDescription}
              onChange={(twitterDescription) =>
                update((current) => ({
                  ...current,
                  pages: current.pages.map((page) =>
                    page.id === activePage.id
                      ? {
                          ...page,
                          seo: {
                            ...page.seo,
                            social: { ...page.seo.social, twitterDescription },
                          },
                        }
                      : page,
                  ),
                }))
              }
            />
            <label className="block space-y-1.5">
              <span className="text-xs text-muted-foreground">Twitter card</span>
              <select
                aria-label="Page Twitter card"
                value={activePage.seo.social.twitterCard}
                onChange={(event) =>
                  update((current) => ({
                    ...current,
                    pages: current.pages.map((page) =>
                      page.id === activePage.id
                        ? {
                            ...page,
                            seo: {
                              ...page.seo,
                              social: {
                                ...page.seo.social,
                                twitterCard: event.target
                                  .value as typeof page.seo.social.twitterCard,
                              },
                            },
                          }
                        : page,
                    ),
                  }))
                }
                className={inputClass}
              >
                <option value="summary">Summary</option>
                <option value="summary_large_image">Large image</option>
              </select>
            </label>
            <CheckField
              label="Allow indexing"
              checked={activePage.seo.robots.index}
              onChange={(index) =>
                update((current) => ({
                  ...current,
                  pages: current.pages.map((page) =>
                    page.id === activePage.id
                      ? {
                          ...page,
                          seo: { ...page.seo, robots: { ...page.seo.robots, index } },
                        }
                      : page,
                  ),
                }))
              }
            />
            <CheckField
              label="Allow following links"
              checked={activePage.seo.robots.follow}
              onChange={(follow) =>
                update((current) => ({
                  ...current,
                  pages: current.pages.map((page) =>
                    page.id === activePage.id
                      ? {
                          ...page,
                          seo: { ...page.seo, robots: { ...page.seo.robots, follow } },
                        }
                      : page,
                  ),
                }))
              }
            />
            <label className="block space-y-1.5 sm:col-span-2">
              <span className="text-xs text-muted-foreground">
                Open Graph image · existing media
              </span>
              <select
                aria-label="Page SEO image"
                value={activePage.seo.social.openGraphImage?.mediaId ?? ""}
                onChange={(event) => {
                  const asset = imageOptions.find(({ id }) => id === event.target.value);
                  update((current) => ({
                    ...current,
                    pages: current.pages.map((page) =>
                      page.id === activePage.id
                        ? {
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
                          }
                        : page,
                    ),
                  }));
                }}
                className={inputClass}
              >
                <option value="">No image selected</option>
                {imageOptions.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.caption || asset.alt}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1.5 sm:col-span-2">
              <span className="text-xs text-muted-foreground">Twitter image · existing media</span>
              <select
                aria-label="Page SEO Twitter image"
                value={activePage.seo.social.twitterImage?.mediaId ?? ""}
                onChange={(event) => {
                  const asset = imageOptions.find(({ id }) => id === event.target.value);
                  update((current) => ({
                    ...current,
                    pages: current.pages.map((page) =>
                      page.id === activePage.id
                        ? {
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
                          }
                        : page,
                    ),
                  }));
                }}
                className={inputClass}
              >
                <option value="">No image selected</option>
                {imageOptions.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.caption || asset.alt}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>
      )}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={cancel}
          className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-accent"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={!dirty}
          onClick={save}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          Apply changes
        </button>
      </div>
    </div>
  );
}
