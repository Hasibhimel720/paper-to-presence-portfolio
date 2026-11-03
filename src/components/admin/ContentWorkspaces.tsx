import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff, Image, Plus, Search, Trash2 } from "lucide-react";
import {
  categorySchema,
  contentSnapshotSchema,
  experienceRecordSchema,
  faqRecordSchema,
  processStepSchema,
  serviceRecordSchema,
  type ContentSnapshot,
} from "@/lib/cms/schema";
import { experienceDateRangeLabel } from "@/lib/cms/experience-dates";
import {
  deleteCmsMedia,
  updateCmsMediaMetadata,
  uploadCmsMediaFile,
  useCmsMediaUrls,
  validateCmsImageFile,
} from "@/lib/cms/media-storage";

type CollectionKind = "services" | "experience" | "process" | "faqs";
type ServiceRecord = ContentSnapshot["services"][number];
type ExperienceRecord = ContentSnapshot["experience"][number];
type ProcessRecord = ContentSnapshot["process"][number];
type FaqRecord = ContentSnapshot["faqs"][number];
type CollectionRecord = ServiceRecord | ExperienceRecord | ProcessRecord | FaqRecord;
type RecordFields = Record<string, string>;
type CollectionDraft = {
  id: string;
  order: number;
  visible: boolean;
  fields: RecordFields;
};

type CollectionWorkspaceProps = {
  kind: CollectionKind;
  snapshot: ContentSnapshot;
  onChange: (snapshot: ContentSnapshot) => void;
};

const collectionDetails: Record<
  CollectionKind,
  {
    title: string;
    description: string;
    fields: { key: string; label: string; multiline?: boolean }[];
  }
> = {
  services: {
    title: "Services",
    description: "Shape the services displayed in your portfolio.",
    fields: [
      { key: "n", label: "Number or label" },
      { key: "title", label: "Service title" },
      { key: "body", label: "Description", multiline: true },
      { key: "items", label: "Included details", multiline: true },
    ],
  },
  experience: {
    title: "Experience",
    description: "Manage the roles and studios in your professional timeline.",
    fields: [
      { key: "company", label: "Company" },
      { key: "role", label: "Role" },
      { key: "type", label: "Work type" },
      { key: "location", label: "Location" },
      { key: "body", label: "Description", multiline: true },
    ],
  },
  process: {
    title: "Process",
    description: "Edit each process step and its matching outcome.",
    fields: [
      { key: "n", label: "Step number or label" },
      { key: "title", label: "Step title" },
      { key: "body", label: "Description", multiline: true },
      { key: "outcomes", label: "Outcomes", multiline: true },
    ],
  },
  faqs: {
    title: "FAQs",
    description: "Answer common questions and control which answers are visible.",
    fields: [
      { key: "q", label: "Question" },
      { key: "a", label: "Answer", multiline: true },
    ],
  },
};

function collectionRecords(snapshot: ContentSnapshot, kind: CollectionKind): CollectionRecord[] {
  switch (kind) {
    case "services":
      return [...snapshot.services];
    case "experience":
      return [...snapshot.experience];
    case "process":
      return [...snapshot.process];
    case "faqs":
      return [...snapshot.faqs];
  }
}

function fieldsFromRecord(kind: CollectionKind, record: object): RecordFields {
  const value = record as Record<string, unknown>;
  const fields: RecordFields = {};
  for (const { key } of collectionDetails[kind].fields) {
    const fieldValue = value[key];
    fields[key] = Array.isArray(fieldValue) ? fieldValue.join("\n") : String(fieldValue ?? "");
  }
  if (kind === "experience") {
    const experience = record as ExperienceRecord;
    fields["legacyDates"] = experience.dates;
    fields["startDate"] = experience.startDate ?? "";
    fields["endDate"] = experience.endDate ?? "";
    fields["isCurrent"] = String(experience.isCurrent ?? false);
  }
  return fields;
}

function newDraft(kind: CollectionKind, snapshot: ContentSnapshot): CollectionDraft {
  const id = `${kind}:${crypto.randomUUID()}`;
  const order = collectionRecords(snapshot, kind).length;
  const fields: RecordFields = {};
  for (const { key } of collectionDetails[kind].fields) fields[key] = "";
  if (kind === "services") fields["n"] = String(order + 1);
  if (kind === "experience") {
    fields["type"] = "Full-time";
    fields["legacyDates"] = "";
    fields["startDate"] = "";
    fields["endDate"] = "";
    fields["isCurrent"] = "false";
  }
  if (kind === "process") fields["n"] = String(order + 1);
  return { id, order, visible: true, fields };
}

function recordDraft(kind: CollectionKind, record: object): CollectionDraft {
  const value = record as { id: string; order: number; visible: boolean };
  return {
    id: value.id,
    order: value.order,
    visible: value.visible,
    fields: fieldsFromRecord(kind, record),
  };
}

function parseDraft(kind: CollectionKind, draft: CollectionDraft) {
  const { fields } = draft;
  switch (kind) {
    case "services":
      return serviceRecordSchema.safeParse({
        ...draft,
        ...fields,
        items: (fields["items"] ?? "")
          .split("\n")
          .map((item) => item.trim())
          .filter(Boolean),
      });
    case "experience": {
      const startDate = fields["startDate"] || undefined;
      const isCurrent = fields["isCurrent"] === "true";
      const endDate = isCurrent ? undefined : fields["endDate"] || undefined;
      return experienceRecordSchema.safeParse({
        id: draft.id,
        order: draft.order,
        visible: draft.visible,
        company: fields["company"] ?? "",
        role: fields["role"] ?? "",
        type: fields["type"] ?? "",
        location: fields["location"] ?? "",
        body: fields["body"] ?? "",
        dates: startDate
          ? experienceDateRangeLabel(startDate, endDate ?? "", isCurrent)
          : (fields["legacyDates"] ?? ""),
        ...(startDate ? { startDate } : {}),
        ...(endDate ? { endDate } : {}),
        ...(isCurrent ? { isCurrent: true } : {}),
      });
    }
    case "process":
      return processStepSchema.safeParse({
        ...draft,
        ...fields,
        outcomes: (fields["outcomes"] ?? "")
          .split("\n")
          .map((item) => item.trim())
          .filter(Boolean),
      });
    case "faqs":
      return faqRecordSchema.safeParse({ ...draft, ...fields });
  }
}

function recordTitle(kind: CollectionKind, record: object) {
  const value = record as Record<string, unknown>;
  if (kind === "services" || kind === "process") return String(value["title"] ?? "");
  if (kind === "experience") return String(value["company"] ?? "");
  return String(value["q"] ?? "");
}

function updateCollection(
  snapshot: ContentSnapshot,
  kind: CollectionKind,
  records: CollectionRecord[],
): ContentSnapshot {
  switch (kind) {
    case "services":
      return {
        ...snapshot,
        services: records.filter((record): record is ServiceRecord => "items" in record),
      };
    case "experience":
      return {
        ...snapshot,
        experience: records.filter((record): record is ExperienceRecord => "company" in record),
      };
    case "process":
      return {
        ...snapshot,
        process: records.filter((record): record is ProcessRecord => "outcomes" in record),
      };
    case "faqs":
      return {
        ...snapshot,
        faqs: records.filter((record): record is FaqRecord => "q" in record),
      };
  }
}

function syncCollectionReferences(
  snapshot: ContentSnapshot,
  kind: CollectionKind,
  records: CollectionRecord[],
) {
  const ids = [...records].sort((a, b) => a.order - b.order).map(({ id }) => id);
  return {
    ...snapshot,
    pages: snapshot.pages.map((page) => ({
      ...page,
      sections: page.sections.map((section) => {
        if (kind === "services" && section.type === "services")
          return {
            ...section,
            data: { ...section.data, serviceIds: ids },
          };
        if (kind === "experience" && section.type === "experience")
          return {
            ...section,
            data: { ...section.data, experienceIds: ids },
          };
        if (kind === "process" && section.type === "process")
          return {
            ...section,
            data: { ...section.data, processStepIds: ids },
          };
        if (kind === "faqs" && section.type === "faqs")
          return {
            ...section,
            data: { ...section.data, faqIds: ids },
          };
        return section;
      }),
    })),
  };
}

export function CollectionWorkspace({ kind, snapshot, onChange }: CollectionWorkspaceProps) {
  const details = collectionDetails[kind];
  const records = useMemo(
    () => [...collectionRecords(snapshot, kind)].sort((a, b) => a.order - b.order),
    [snapshot, kind],
  );
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<CollectionDraft | null>(null);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const inputClass =
    "w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

  function commit(candidate: ContentSnapshot, message: string) {
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

  function save() {
    if (!draft) return;
    if (kind === "experience" && !editing && !draft.fields["startDate"]) {
      setError("Choose a Start Date before adding an experience entry.");
      setSuccess("");
      return;
    }
    const parsed = parseDraft(kind, draft);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check the required fields.");
      setSuccess("");
      return;
    }
    const updated = editing
      ? records.map((record) => (record.id === draft.id ? parsed.data : record))
      : [...records, { ...parsed.data, order: records.length }];
    const candidate = syncCollectionReferences(
      updateCollection(snapshot, kind, updated),
      kind,
      updated,
    );
    if (commit(candidate, `${details.title} changes applied to the dashboard session.`)) {
      setDraft(null);
      setEditing(false);
    }
  }

  function remove(record: (typeof records)[number]) {
    if (!window.confirm(`Remove "${recordTitle(kind, record)}"?`)) return;
    const nextRecords = records
      .filter(({ id }) => id !== record.id)
      .map((item, order) => ({ ...item, order }));
    const candidate = syncCollectionReferences(
      updateCollection(snapshot, kind, nextRecords),
      kind,
      nextRecords,
    );
    if (commit(candidate, `${details.title.slice(0, -1)} removed from the dashboard session.`)) {
      if (draft?.id === record.id) setDraft(null);
    }
  }

  function reorder(recordId: string, delta: number) {
    const index = records.findIndex(({ id }) => id === recordId);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= records.length) return;
    const next = [...records];
    [next[index], next[target]] = [next[target]!, next[index]!];
    commit(
      syncCollectionReferences(
        updateCollection(
          snapshot,
          kind,
          next.map((record, order) => ({ ...record, order })),
        ),
        kind,
        next.map((record, order) => ({ ...record, order })),
      ),
      `${details.title} order updated.`,
    );
  }

  function toggleVisible(recordId: string) {
    const next = records.map((record) =>
      record.id === recordId ? { ...record, visible: !record.visible } : record,
    );
    const record = next.find(({ id }) => id === recordId);
    commit(
      syncCollectionReferences(updateCollection(snapshot, kind, next), kind, next),
      record?.visible
        ? "Entry shown in the dashboard session."
        : "Entry hidden in the dashboard session.",
    );
  }

  function updateSectionCopy(field: "eyebrow" | "title" | "intro", value: string) {
    if (kind === "services") return;
    const pages = snapshot.pages.map((page) => {
      if (page.slug !== "/") return page;
      return {
        ...page,
        sections: page.sections.map((section) => {
          if (kind === "experience" && section.type === "experience") {
            return { ...section, data: { ...section.data, [field]: value } };
          }
          if (kind === "process" && section.type === "process") {
            return { ...section, data: { ...section.data, [field]: value } };
          }
          if (kind === "faqs" && section.type === "faqs") {
            return { ...section, data: { ...section.data, [field]: value } };
          }
          return section;
        }),
      };
    });
    commit({ ...snapshot, pages }, `${details.title} section text updated.`);
  }

  const homepageSections = snapshot.pages.find(({ slug }) => slug === "/")?.sections ?? [];
  const homepageSection =
    kind === "experience"
      ? homepageSections.find((section) => section.type === "experience")
      : kind === "process"
        ? homepageSections.find((section) => section.type === "process")
        : kind === "faqs"
          ? homepageSections.find((section) => section.type === "faqs")
          : undefined;

  const filtered = records.filter((record) =>
    `${recordTitle(kind, record)} ${fieldsFromRecord(kind, record)["body"] ?? ""}`
      .toLowerCase()
      .includes(query.trim().toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm text-muted-foreground">Portfolio content</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">{details.title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{details.description}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            if (draft && !window.confirm("Discard the current unsaved changes?")) return;
            setDraft(newDraft(kind, snapshot));
            setEditing(false);
            setError("");
            setSuccess("");
          }}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          <Plus aria-hidden="true" className="h-4 w-4" />
          Add{" "}
          {kind === "faqs"
            ? "FAQ"
            : kind === "process"
              ? "step"
              : kind === "services"
                ? "service"
                : "experience"}
        </button>
      </header>

      <label className="relative block max-w-xl">
        <span className="sr-only">Search {details.title.toLowerCase()}</span>
        <Search
          aria-hidden="true"
          className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={`Search ${details.title.toLowerCase()}…`}
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

      {kind !== "services" && homepageSection && (
        <section
          aria-label={`${details.title} section heading`}
          className="rounded-2xl border border-border bg-card p-5 sm:p-6"
        >
          <h2 className="font-semibold">Homepage section copy</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            These fields update the public section heading and introduction.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Section eyebrow</span>
              <input
                aria-label={`${details.title} section eyebrow`}
                value={homepageSection.data.eyebrow}
                onChange={(event) => updateSectionCopy("eyebrow", event.target.value)}
                className={inputClass}
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Section heading</span>
              <input
                aria-label={`${details.title} section heading`}
                value={homepageSection.data.title}
                onChange={(event) => updateSectionCopy("title", event.target.value)}
                className={inputClass}
              />
            </label>
            <label className="block space-y-1.5 sm:col-span-2">
              <span className="text-xs font-medium text-muted-foreground">
                Section introduction
              </span>
              <textarea
                aria-label={`${details.title} section introduction`}
                rows={3}
                value={homepageSection.data.intro}
                onChange={(event) => updateSectionCopy("intro", event.target.value)}
                className={`${inputClass} resize-y`}
              />
            </label>
          </div>
        </section>
      )}

      {draft && (
        <section
          aria-label={`Edit ${details.title}`}
          className="rounded-2xl border border-primary/30 bg-card p-5 sm:p-7"
        >
          <h2 className="text-lg font-semibold">{editing ? "Edit entry" : "New entry"}</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {details.fields.map(({ key, label, multiline }) => (
              <label key={key} className={`block space-y-1.5 ${multiline ? "sm:col-span-2" : ""}`}>
                <span className="text-xs font-medium text-muted-foreground">{label}</span>
                {multiline ? (
                  <textarea
                    aria-label={label}
                    rows={3}
                    value={draft.fields[key] ?? ""}
                    onChange={(event) =>
                      setDraft({ ...draft, fields: { ...draft.fields, [key]: event.target.value } })
                    }
                    className={`${inputClass} resize-y`}
                  />
                ) : (
                  <input
                    aria-label={label}
                    value={draft.fields[key] ?? ""}
                    onChange={(event) =>
                      setDraft({ ...draft, fields: { ...draft.fields, [key]: event.target.value } })
                    }
                    className={inputClass}
                  />
                )}
                {key === "items" || key === "outcomes" ? (
                  <span className="text-xs text-muted-foreground">One item per line</span>
                ) : null}
              </label>
            ))}
            {kind === "experience" && (
              <>
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-muted-foreground">Start Date</span>
                  <input
                    aria-label="Start Date"
                    type="date"
                    value={draft.fields["startDate"] ?? ""}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        fields: { ...draft.fields, startDate: event.target.value },
                      })
                    }
                    className={inputClass}
                  />
                </label>
                {!editing || draft.fields["isCurrent"] !== "true" ? (
                  <label className="block space-y-1.5">
                    <span className="text-xs font-medium text-muted-foreground">End Date</span>
                    <input
                      aria-label="End Date"
                      type="date"
                      min={draft.fields["startDate"] || undefined}
                      value={draft.fields["endDate"] ?? ""}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          fields: { ...draft.fields, endDate: event.target.value },
                        })
                      }
                      className={inputClass}
                    />
                  </label>
                ) : null}
                <label className="flex items-center gap-2 text-sm sm:col-span-2">
                  <input
                    aria-label="I currently work here"
                    type="checkbox"
                    checked={draft.fields["isCurrent"] === "true"}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        fields: {
                          ...draft.fields,
                          isCurrent: String(event.target.checked),
                          ...(event.target.checked ? { endDate: "" } : {}),
                        },
                      })
                    }
                  />
                  I currently work here
                </label>
                {!draft.fields["startDate"] && draft.fields["legacyDates"] && (
                  <p className="text-xs text-muted-foreground sm:col-span-2">
                    Existing date range is preserved as written: {draft.fields["legacyDates"]}
                  </p>
                )}
              </>
            )}
          </div>
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setDraft(null);
                setEditing(false);
                setError("");
                setSuccess("Unsaved changes were discarded.");
              }}
              className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-accent"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              Apply changes
            </button>
          </div>
        </section>
      )}

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/60 p-10 text-center">
          <p className="font-medium">
            {records.length === 0 ? `No ${details.title.toLowerCase()} yet` : "No matching entries"}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {records.length === 0
              ? "Add an entry to build this part of your portfolio."
              : "Try another search term."}
          </p>
        </div>
      ) : (
        <ol className="grid gap-3">
          {filtered.map((record) => {
            const index = records.findIndex(({ id }) => id === record.id);
            const fields = fieldsFromRecord(kind, record);
            return (
              <li key={record.id} className="rounded-2xl border border-border bg-card p-4 sm:p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="font-semibold">
                        {recordTitle(kind, record) || "Untitled entry"}
                      </h2>
                      {!record.visible && (
                        <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                          Hidden
                        </span>
                      )}
                    </div>
                    <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">
                      {fields["body"] ||
                        fields["a"] ||
                        fields["outcomes"] ||
                        fields["legacyDates"] ||
                        "No description provided."}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    <button
                      type="button"
                      aria-label={`Move ${recordTitle(kind, record)} up`}
                      disabled={index === 0}
                      onClick={() => reorder(record.id, -1)}
                      className="rounded-lg p-2 text-muted-foreground hover:bg-accent disabled:opacity-30"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Move ${recordTitle(kind, record)} down`}
                      disabled={index === records.length - 1}
                      onClick={() => reorder(record.id, 1)}
                      className="rounded-lg p-2 text-muted-foreground hover:bg-accent disabled:opacity-30"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      aria-label={
                        record.visible
                          ? `Hide ${recordTitle(kind, record)}`
                          : `Show ${recordTitle(kind, record)}`
                      }
                      onClick={() => toggleVisible(record.id)}
                      className="rounded-lg p-2 text-muted-foreground hover:bg-accent"
                    >
                      {record.visible ? (
                        <Eye className="h-4 w-4" />
                      ) : (
                        <EyeOff className="h-4 w-4" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDraft(recordDraft(kind, record));
                        setEditing(true);
                        setError("");
                        setSuccess("");
                      }}
                      className="rounded-lg border border-border px-3 py-2 text-xs hover:bg-accent"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      aria-label={`Remove ${recordTitle(kind, record)}`}
                      onClick={() => remove(record)}
                      className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
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

type CategoriesWorkspaceProps = {
  snapshot: ContentSnapshot;
  onChange: (snapshot: ContentSnapshot) => void;
};

export function CategoriesWorkspace({ snapshot, onChange }: CategoriesWorkspaceProps) {
  const [newCategory, setNewCategory] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [replacementById, setReplacementById] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const inputClass = "rounded-lg border border-input bg-background px-3 py-2.5 text-sm";

  function makeSlug(name: string, exceptId?: string) {
    const base =
      name
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") || `category-${crypto.randomUUID().slice(0, 8)}`;
    const used = new Set(
      snapshot.categories.filter(({ id }) => id !== exceptId).map(({ slug }) => slug.toLowerCase()),
    );
    if (!used.has(base)) return base;
    let suffix = 2;
    while (used.has(`${base}-${suffix}`)) suffix += 1;
    return `${base}-${suffix}`;
  }

  function commit(candidate: ContentSnapshot, message: string) {
    const result = contentSnapshotSchema.safeParse(candidate);
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "The category change is invalid.");
      setSuccess("");
      return false;
    }
    onChange(result.data);
    setError("");
    setSuccess(message);
    return true;
  }

  function addCategory() {
    const name = categorySchema.safeParse(newCategory);
    if (!name.success) {
      setError(name.error.issues[0]?.message ?? "Enter a category name.");
      return;
    }
    if (
      snapshot.categories.some(
        (category) => category.name.toLocaleLowerCase() === name.data.toLocaleLowerCase(),
      )
    ) {
      setError("That category name is already in use.");
      setSuccess("");
      return;
    }
    const categoryId = `category:${crypto.randomUUID()}`;
    const category = {
      id: categoryId,
      slug: makeSlug(name.data),
      name: name.data,
      order: snapshot.categories.length,
    };
    const pages = snapshot.pages.map((page) => ({
      ...page,
      sections: page.sections.map((section) =>
        section.type === "project-grid"
          ? {
              ...section,
              data: {
                ...section.data,
                categoryIds: section.data.categoryIds.length
                  ? [...new Set([...section.data.categoryIds, categoryId])]
                  : [],
              },
            }
          : section,
      ),
    }));
    const candidate = {
      ...snapshot,
      categories: [...snapshot.categories, category],
      pages,
    };
    if (commit(candidate, "Category added to the dashboard session.")) setNewCategory("");
  }

  function removeCategory(id: string) {
    const category = snapshot.categories.find((item) => item.id === id);
    if (!category) return;
    const affected = snapshot.projects.filter((project) => project.categoryId === id);
    const replacementId = replacementById[id] ?? "";
    if (affected.length > 0 && !replacementId) {
      setError("Select a replacement category before removing a category assigned to projects.");
      setSuccess("");
      return;
    }
    if (
      !window.confirm(
        `Remove "${category.name}"?${affected.length ? ` ${affected.length} project(s) will be reassigned.` : ""}`,
      )
    )
      return;
    const replacement = snapshot.categories.find(
      ({ id: categoryId }) => categoryId === replacementId,
    );
    const categories = snapshot.categories
      .filter((item) => item.id !== id)
      .map((item, order) => ({ ...item, order }));
    const projects = snapshot.projects.map((project) =>
      project.categoryId === id && replacement
        ? { ...project, categoryId: replacement.id, category: replacement.name }
        : project,
    );
    const pages = snapshot.pages.map((page) => ({
      ...page,
      sections: page.sections.map((section) =>
        section.type === "project-grid"
          ? {
              ...section,
              data: {
                ...section.data,
                categoryIds: [
                  ...new Set(
                    section.data.categoryIds.map((categoryId) =>
                      categoryId === id && replacement ? replacement.id : categoryId,
                    ),
                  ),
                ].filter((categoryId) => categoryId !== id),
              },
            }
          : section,
      ),
    }));
    if (
      commit(
        { ...snapshot, categories, projects, pages },
        "Category removed and relationships updated.",
      )
    ) {
      setReplacementById((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
    }
  }

  function renameCategory(id: string) {
    const parsedName = categorySchema.safeParse(editingName);
    if (!parsedName.success) {
      setError("Choose a supported category name.");
      return;
    }
    if (
      snapshot.categories.some(
        (category) =>
          category.id !== id &&
          category.name.toLocaleLowerCase() === parsedName.data.toLocaleLowerCase(),
      )
    ) {
      setError("That category name is already in use.");
      return;
    }
    const slug = makeSlug(parsedName.data, id);
    const categories = snapshot.categories.map((category) =>
      category.id === id ? { ...category, name: parsedName.data, slug } : category,
    );
    const projects = snapshot.projects.map((project) =>
      project.categoryId === id ? { ...project, category: parsedName.data } : project,
    );
    if (
      commit(
        { ...snapshot, categories, projects },
        "Category updated and project labels synchronized.",
      )
    ) {
      setEditingId(null);
      setEditingName("");
    }
  }

  function reorder(id: string, delta: number) {
    const categories = [...snapshot.categories].sort((a, b) => a.order - b.order);
    const index = categories.findIndex((category) => category.id === id);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= categories.length) return;
    [categories[index], categories[target]] = [categories[target]!, categories[index]!];
    commit(
      { ...snapshot, categories: categories.map((category, order) => ({ ...category, order })) },
      "Category order updated.",
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-muted-foreground">Project organization</p>
        <h1 className="mt-1 text-3xl font-semibold">Categories</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Manage supported category labels and keep project and page-filter references aligned.
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
      <section className="rounded-2xl border border-border bg-card p-4 sm:p-6">
        <h2 className="font-semibold">Add category</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Add a category name for project organization and public work filters.
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input
            aria-label="New category"
            maxLength={64}
            value={newCategory}
            onChange={(event) => setNewCategory(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addCategory();
              }
            }}
            className={`${inputClass} flex-1`}
            placeholder="e.g. Art Direction"
          />
          <button
            type="button"
            disabled={!newCategory.trim()}
            onClick={addCategory}
            className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            <Plus className="mr-1 inline h-4 w-4" />
            Add category
          </button>
        </div>
      </section>
      {snapshot.categories.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No categories are configured.
        </p>
      ) : (
        <ol className="grid gap-3 md:grid-cols-2">
          {[...snapshot.categories]
            .sort((a, b) => a.order - b.order)
            .map((category, index) => {
              const count = snapshot.projects.filter(
                (project) => project.categoryId === category.id,
              ).length;
              const replacements = snapshot.categories.filter(({ id }) => id !== category.id);
              return (
                <li key={category.id} className="rounded-2xl border border-border bg-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h2 className="font-semibold">{category.name}</h2>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {count} assigned project{count === 1 ? "" : "s"} · /{category.slug}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(category.id);
                          setEditingName(category.name);
                          setError("");
                        }}
                        className="rounded-lg border border-border px-3 py-2 text-xs hover:bg-accent"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        aria-label={`Move ${category.name} up`}
                        disabled={index === 0}
                        onClick={() => reorder(category.id, -1)}
                        className="rounded-lg p-2 hover:bg-accent disabled:opacity-30"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Move ${category.name} down`}
                        disabled={index === snapshot.categories.length - 1}
                        onClick={() => reorder(category.id, 1)}
                        className="rounded-lg p-2 hover:bg-accent disabled:opacity-30"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Remove ${category.name}`}
                        onClick={() => removeCategory(category.id)}
                        className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    {editingId === category.id && (
                      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                        <input
                          aria-label={`Edit ${category.name}`}
                          maxLength={64}
                          value={editingName}
                          onChange={(event) => setEditingName(event.target.value)}
                          className={`${inputClass} flex-1`}
                        />
                        <button
                          type="button"
                          onClick={() => renameCategory(category.id)}
                          className="rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground"
                        >
                          Save category
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-accent"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                  {count > 0 && (
                    <label className="mt-4 block space-y-1.5">
                      <span className="text-xs text-muted-foreground">
                        Reassign these projects before removal
                      </span>
                      <select
                        aria-label={`Replacement for ${category.name}`}
                        value={replacementById[category.id] ?? ""}
                        onChange={(event) =>
                          setReplacementById((current) => ({
                            ...current,
                            [category.id]: event.target.value,
                          }))
                        }
                        className={`${inputClass} w-full`}
                      >
                        <option value="">Choose replacement</option>
                        {replacements.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </li>
              );
            })}
        </ol>
      )}
    </div>
  );
}

type MediaWorkspaceProps = {
  snapshot: ContentSnapshot;
  onChange: (snapshot: ContentSnapshot) => void;
  cmsEnabled?: boolean;
  pendingDeletionIds?: string[];
};

export function MediaWorkspace({
  snapshot,
  onChange,
  cmsEnabled = false,
  pendingDeletionIds = [],
}: MediaWorkspaceProps) {
  const [query, setQuery] = useState("");
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [selectedPageId, setSelectedPageId] = useState(snapshot.pages[0]?.id ?? "");
  const [usageFilter, setUsageFilter] = useState<"all" | "referenced" | "unused">("all");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadAlt, setUploadAlt] = useState("");
  const [uploadCaption, setUploadCaption] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [mediaBusy, setMediaBusy] = useState(false);
  const previewUrlRef = useRef<string | null>(null);
  const mediaUrls = useCmsMediaUrls(snapshot.media);
  const [editingMedia, setEditingMedia] = useState<{
    id: string;
    alt: string;
    caption: string;
  } | null>(null);
  const inputClass = "w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm";

  useEffect(
    () => () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    },
    [],
  );

  function chooseUpload(file: File | undefined) {
    if (!file) return;
    const validationError = validateCmsImageFile(file);
    if (validationError) {
      setError(validationError);
      setSuccess("");
      setUploadFile(null);
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
      setPreviewUrl("");
      return;
    }
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = URL.createObjectURL(file);
    setPreviewUrl(previewUrlRef.current);
    setUploadFile(file);
    setError("");
    setSuccess("");
  }

  async function uploadSelectedMedia() {
    if (!uploadFile) return;
    setMediaBusy(true);
    setError("");
    try {
      const asset = await uploadCmsMediaFile(uploadFile, {
        alt: uploadAlt,
        caption: uploadCaption,
      });
      if (
        assign(
          (current) => ({ ...current, media: [asset, ...current.media] }),
          "Image uploaded and added to the media library. Save a draft to retain its content references.",
        )
      ) {
        setUploadFile(null);
        setUploadAlt("");
        setUploadCaption("");
        setPreviewUrl("");
        if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
    } catch (uploadError) {
      setError(
        uploadError instanceof Error ? uploadError.message : "The image could not be uploaded.",
      );
      setSuccess("");
    } finally {
      setMediaBusy(false);
    }
  }

  function assign(update: (current: ContentSnapshot) => ContentSnapshot, message: string) {
    const result = contentSnapshotSchema.safeParse(update(snapshot));
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "The media reference is invalid.");
      setSuccess("");
      return false;
    }
    onChange(result.data);
    setError("");
    setSuccess(message);
    return true;
  }

  function reference(mediaId: string, alt: string) {
    return mediaId ? { mediaId, alt } : undefined;
  }

  function usageCount(mediaId: string) {
    let count = 0;
    for (const project of snapshot.projects) {
      if (project.coverMedia?.mediaId === mediaId) count += 1;
      if (project.heroMedia?.mediaId === mediaId) count += 1;
      count += project.gallery.filter((item) => item.mediaId === mediaId).length;
      count += project.sections.reduce(
        (total, section) => total + section.media.filter((item) => item.mediaId === mediaId).length,
        0,
      );
    }
    if (snapshot.profile.portrait?.mediaId === mediaId) count += 1;
    count += snapshot.profile.toolkit.filter(
      ({ iconMedia }) => iconMedia?.mediaId === mediaId,
    ).length;
    if (snapshot.navigationLogo?.mediaId === mediaId) count += 1;
    count += snapshot.services.filter((service) => service.image?.mediaId === mediaId).length;
    if (snapshot.seo.social.openGraphImage?.mediaId === mediaId) count += 1;
    if (snapshot.seo.social.twitterImage?.mediaId === mediaId) count += 1;
    for (const page of snapshot.pages) {
      if (page.seo.social.openGraphImage?.mediaId === mediaId) count += 1;
      if (page.seo.social.twitterImage?.mediaId === mediaId) count += 1;
    }
    return count;
  }

  const assets = snapshot.media.filter((asset) => {
    const matchesQuery =
      `${asset.alt} ${asset.caption ?? ""} ${asset.source.kind === "url" ? asset.source.url : asset.source.key}`
        .toLowerCase()
        .includes(query.trim().toLowerCase());
    const references = usageCount(asset.id);
    return (
      matchesQuery &&
      (usageFilter === "all" ||
        (usageFilter === "referenced" && references > 0) ||
        (usageFilter === "unused" && references === 0))
    );
  });
  const referencedAssetCount = snapshot.media.filter((asset) => usageCount(asset.id) > 0).length;

  async function saveMedia() {
    if (!editingMedia) return;
    const original = snapshot.media.find(({ id }) => id === editingMedia.id);
    if (!original) {
      setError("This media record no longer exists.");
      return;
    }
    const updateReference = (
      media: { mediaId: string; alt: string } | undefined,
    ): { mediaId: string; alt: string } | undefined =>
      media?.mediaId === editingMedia.id ? { ...media, alt: editingMedia.alt } : media;
    const media = snapshot.media.map((asset) =>
      asset.id === editingMedia.id
        ? { ...asset, alt: editingMedia.alt, caption: editingMedia.caption }
        : asset,
    );
    const projects = snapshot.projects.map((project) => ({
      ...project,
      coverMedia: updateReference(project.coverMedia),
      heroMedia: updateReference(project.heroMedia),
      gallery: project.gallery.map((item) => updateReference(item)!),
      sections: project.sections.map((section) => ({
        ...section,
        media: section.media.map((item) => updateReference(item)!),
      })),
    }));
    const profile = {
      ...snapshot.profile,
      portrait: updateReference(snapshot.profile.portrait),
      toolkit: snapshot.profile.toolkit.map((tool) => ({
        ...tool,
        iconMedia: updateReference(tool.iconMedia),
      })),
    };
    const navigationLogo = updateReference(snapshot.navigationLogo);
    const services = snapshot.services.map((service) => ({
      ...service,
      image: updateReference(service.image),
    }));
    const updateSeo = (seo: ContentSnapshot["seo"]) => ({
      ...seo,
      social: {
        ...seo.social,
        openGraphImage: updateReference(seo.social.openGraphImage),
        twitterImage: updateReference(seo.social.twitterImage),
      },
    });
    const pages = snapshot.pages.map((page) => ({ ...page, seo: updateSeo(page.seo) }));
    const validation = contentSnapshotSchema.safeParse({
      ...snapshot,
      media,
      projects,
      services,
      profile,
      navigationLogo,
      pages,
      seo: updateSeo(snapshot.seo),
    });
    if (!validation.success) {
      setError(validation.error.issues[0]?.message ?? "The media details are invalid.");
      setSuccess("");
      return;
    }
    setMediaBusy(true);
    try {
      await updateCmsMediaMetadata(original, {
        alt: editingMedia.alt,
        caption: editingMedia.caption,
      });
      onChange(validation.data);
      setError("");
      setSuccess("Media details and matching alt references updated.");
      setEditingMedia(null);
    } catch (updateError) {
      setError(
        updateError instanceof Error ? updateError.message : "Unable to update media metadata.",
      );
      setSuccess("");
    } finally {
      setMediaBusy(false);
    }
  }

  async function removeUnusedMedia(mediaId: string) {
    const asset = snapshot.media.find(({ id }) => id === mediaId);
    if (!asset) return;
    if (usageCount(mediaId) > 0) {
      setError("This asset is referenced by content. Remove its references before deleting it.");
      setSuccess("");
      return;
    }
    if (
      !window.confirm(
        `Remove unused media "${asset.caption || asset.alt || asset.id}" from the library?`,
      )
    )
      return;
    setMediaBusy(true);
    setError("");
    try {
      if (asset.source.kind === "storage") await deleteCmsMedia(asset);
      const validation = contentSnapshotSchema.safeParse({
        ...snapshot,
        media: snapshot.media.filter(({ id }) => id !== mediaId),
      });
      if (!validation.success) {
        throw new Error(validation.error.issues[0]?.message ?? "The media reference is invalid.");
      }
      onChange(validation.data);
      setSuccess(
        asset.source.kind === "storage"
          ? "Unused media and its storage object were deleted."
          : "Unused external media reference removed.",
      );
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to remove media.");
      setSuccess("");
    } finally {
      setMediaBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-muted-foreground">CMS media library</p>
        <h1 className="mt-1 text-3xl font-semibold">Media library</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Upload and reuse JPEG, PNG, WebP, or AVIF images. Uploads are private to authorized admins
          for management and publicly delivered only through the published portfolio.
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
      {mediaUrls.error && (
        <p
          role="alert"
          className="rounded-lg border border-destructive/40 bg-card p-3 text-sm text-destructive"
        >
          {mediaUrls.error}
        </p>
      )}
      {cmsEnabled ? (
        <section aria-label="Upload image" className="rounded-2xl border border-border bg-card p-5">
          <h2 className="font-semibold">Upload image</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Maximum 10 MB. The uploaded file is not attached to public content until a draft is
            saved and published.
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(14rem,0.65fr)]">
            <div className="space-y-3">
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">Image file</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/avif,.jpg,.jpeg,.png,.webp,.avif"
                  onChange={(event) => chooseUpload(event.currentTarget.files?.[0])}
                  disabled={mediaBusy}
                  className={inputClass}
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">Alt text</span>
                <input
                  value={uploadAlt}
                  onChange={(event) => setUploadAlt(event.target.value)}
                  maxLength={500}
                  className={inputClass}
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">Caption</span>
                <input
                  value={uploadCaption}
                  onChange={(event) => setUploadCaption(event.target.value)}
                  maxLength={500}
                  className={inputClass}
                />
              </label>
              <button
                type="button"
                onClick={uploadSelectedMedia}
                disabled={!uploadFile || mediaBusy}
                className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
              >
                {mediaBusy ? "Working…" : "Upload to media library"}
              </button>
            </div>
            <div className="grid min-h-40 place-items-center overflow-hidden rounded-xl border border-dashed border-border bg-background">
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Selected image preview"
                  className="max-h-64 w-full object-contain"
                />
              ) : (
                <p className="px-4 text-center text-xs text-muted-foreground">
                  Select a supported image to preview it before upload.
                </p>
              )}
            </div>
          </div>
        </section>
      ) : (
        <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
          Uploads and persistent media management require an authorized, configured CMS session.
          Demo mode does not upload files.
        </p>
      )}
      {editingMedia && (
        <section
          aria-label="Edit media metadata"
          className="rounded-2xl border border-primary/30 bg-card p-5"
        >
          <h2 className="font-semibold">Edit media metadata</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <span className="text-xs text-muted-foreground">Alt text</span>
              <input
                aria-label="Media alt text"
                value={editingMedia.alt}
                onChange={(event) => setEditingMedia({ ...editingMedia, alt: event.target.value })}
                className={inputClass}
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs text-muted-foreground">Caption</span>
              <input
                aria-label="Media caption"
                value={editingMedia.caption}
                onChange={(event) =>
                  setEditingMedia({ ...editingMedia, caption: event.target.value })
                }
                className={inputClass}
              />
            </label>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditingMedia(null)}
              disabled={mediaBusy}
              className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-accent"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={saveMedia}
              disabled={mediaBusy}
              className="rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground"
            >
              Save metadata
            </button>
          </div>
        </section>
      )}
      <section className="grid gap-4 rounded-2xl border border-border bg-card p-4 sm:grid-cols-3">
        <label className="space-y-1.5">
          <span className="text-xs text-muted-foreground">Profile portrait</span>
          <select
            aria-label="Profile portrait media"
            value={snapshot.profile.portrait?.mediaId ?? ""}
            onChange={(event) => {
              const asset = snapshot.media.find(({ id }) => id === event.target.value);
              assign(
                (current) => ({
                  ...current,
                  profile: {
                    ...current.profile,
                    portrait: reference(asset?.id ?? "", asset?.alt ?? ""),
                  },
                }),
                "Profile media reference updated.",
              );
            }}
            className={inputClass}
          >
            <option value="">No portrait selected</option>
            {snapshot.media.map((asset) => (
              <option key={asset.id} value={asset.id}>
                {asset.caption || asset.alt || asset.id}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1.5">
          <span className="text-xs text-muted-foreground">Global social share image</span>
          <select
            aria-label="Global social image"
            value={snapshot.seo.social.openGraphImage?.mediaId ?? ""}
            onChange={(event) => {
              const asset = snapshot.media.find(({ id }) => id === event.target.value);
              assign(
                (current) => ({
                  ...current,
                  seo: {
                    ...current.seo,
                    social: {
                      ...current.seo.social,
                      openGraphImage: reference(asset?.id ?? "", asset?.alt ?? ""),
                    },
                  },
                }),
                "Global social image reference updated.",
              );
            }}
            className={inputClass}
          >
            <option value="">No image selected</option>
            {snapshot.media.map((asset) => (
              <option key={asset.id} value={asset.id}>
                {asset.caption || asset.alt || asset.id}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1.5">
          <span className="text-xs text-muted-foreground">Page to edit social image</span>
          <select
            aria-label="Media target page"
            value={selectedPageId}
            onChange={(event) => setSelectedPageId(event.target.value)}
            className={inputClass}
          >
            {snapshot.pages.map((page) => (
              <option key={page.id} value={page.id}>
                {page.title}
              </option>
            ))}
          </select>
          <select
            aria-label="Page social image"
            value={
              snapshot.pages.find(({ id }) => id === selectedPageId)?.seo.social.openGraphImage
                ?.mediaId ?? ""
            }
            onChange={(event) => {
              const asset = snapshot.media.find(({ id }) => id === event.target.value);
              assign(
                (current) => ({
                  ...current,
                  pages: current.pages.map((page) =>
                    page.id === selectedPageId
                      ? {
                          ...page,
                          seo: {
                            ...page.seo,
                            social: {
                              ...page.seo.social,
                              openGraphImage: reference(asset?.id ?? "", asset?.alt ?? ""),
                            },
                          },
                        }
                      : page,
                  ),
                }),
                "Page social image reference updated.",
              );
            }}
            className={inputClass}
          >
            <option value="">No image selected</option>
            {snapshot.media.map((asset) => (
              <option key={asset.id} value={asset.id}>
                {asset.caption || asset.alt || asset.id}
              </option>
            ))}
          </select>
        </label>
      </section>
      <label className="relative block max-w-xl">
        <span className="sr-only">Search media</span>
        <Search
          aria-hidden="true"
          className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search media metadata…"
          className={`${inputClass} pl-9`}
        />
      </label>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          {snapshot.media.length} assets · {referencedAssetCount} referenced ·{" "}
          {snapshot.media.length - referencedAssetCount} unused
        </p>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Usage</span>
          <select
            aria-label="Filter media by usage"
            value={usageFilter}
            onChange={(event) =>
              setUsageFilter(event.target.value as "all" | "referenced" | "unused")
            }
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
          >
            <option value="all">All media</option>
            <option value="referenced">Referenced</option>
            <option value="unused">Unused</option>
          </select>
        </label>
      </div>
      {assets.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/60 p-10 text-center">
          <Image aria-hidden="true" className="mx-auto h-8 w-8 text-muted-foreground" />
          <h2 className="mt-4 font-semibold">
            {snapshot.media.length === 0 ? "No media records are available" : "No matching media"}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {cmsEnabled
              ? "Upload a supported image above or check your search terms."
              : "This demo contains no media files. Uploading is unavailable in demo mode."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {assets.map((asset) => {
            const usage: string[] = [];
            for (const project of snapshot.projects) {
              if (project.coverMedia?.mediaId === asset.id) usage.push(`${project.title} cover`);
              if (project.heroMedia?.mediaId === asset.id) usage.push(`${project.title} hero`);
              if (project.gallery.some(({ mediaId }) => mediaId === asset.id))
                usage.push(`${project.title} gallery`);
              if (
                project.sections.some((section) =>
                  section.media.some(({ mediaId }) => mediaId === asset.id),
                )
              )
                usage.push(`${project.title} case study`);
            }
            if (snapshot.profile.portrait?.mediaId === asset.id) usage.push("Profile portrait");
            if (snapshot.navigationLogo?.mediaId === asset.id) usage.push("Navigation logo");
            for (const service of snapshot.services) {
              if (service.image?.mediaId === asset.id) usage.push(`${service.title} service image`);
            }
            snapshot.pages.forEach((page) => {
              if (page.seo.social.openGraphImage?.mediaId === asset.id)
                usage.push(`${page.title} social image`);
              if (page.seo.social.twitterImage?.mediaId === asset.id)
                usage.push(`${page.title} Twitter image`);
            });
            if (snapshot.seo.social.openGraphImage?.mediaId === asset.id)
              usage.push("Global social image");
            if (snapshot.seo.social.twitterImage?.mediaId === asset.id)
              usage.push("Global Twitter image");
            const src = mediaUrls.urls[asset.id];
            return (
              <article
                key={asset.id}
                className="overflow-hidden rounded-2xl border border-border bg-card"
              >
                {src ? (
                  <img src={src} alt={asset.alt} className="aspect-[16/10] w-full object-cover" />
                ) : (
                  <div className="grid aspect-[16/10] place-items-center bg-background text-xs text-muted-foreground">
                    Storage reference · preview unavailable
                  </div>
                )}
                <div className="p-4">
                  <h2 className="font-medium">{asset.caption || asset.alt || "Untitled media"}</h2>
                  <p className="mt-1 break-all text-xs text-muted-foreground">
                    {asset.source.kind === "url" ? asset.source.url : asset.source.key}
                  </p>
                  <p className="mt-3 text-xs text-muted-foreground">
                    Used by: {usage.length ? usage.join(", ") : "No current references"}
                  </p>
                  {pendingDeletionIds.includes(asset.id) && (
                    <p className="mt-2 text-xs text-destructive">
                      Deletion is pending; retry cleanup to remove the stored file.
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setEditingMedia({
                          id: asset.id,
                          alt: asset.alt,
                          caption: asset.caption ?? "",
                        })
                      }
                      className="rounded-lg border border-border px-3 py-2 text-xs hover:bg-accent"
                    >
                      Edit metadata
                    </button>
                    <button
                      type="button"
                      aria-label={`Remove ${asset.caption || asset.alt || asset.id}`}
                      disabled={usage.length > 0 || mediaBusy}
                      title={usage.length ? "Remove all references before deleting" : undefined}
                      onClick={() => removeUnusedMedia(asset.id)}
                      className="rounded-lg border border-border px-3 py-2 text-xs text-destructive hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {mediaBusy
                        ? "Working…"
                        : pendingDeletionIds.includes(asset.id)
                          ? "Retry deletion"
                          : "Remove unused"}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
