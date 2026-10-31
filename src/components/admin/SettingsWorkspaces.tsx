import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { contentSnapshotSchema, type ContentSnapshot } from "@/lib/cms/schema";

type WorkspaceProps = {
  snapshot: ContentSnapshot;
  onChange: (snapshot: ContentSnapshot) => void;
};

const inputClass =
  "w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";
const cardClass = "rounded-2xl border border-border bg-card p-5 sm:p-6";

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

export function SiteSettingsWorkspace({ snapshot, onChange }: WorkspaceProps) {
  const [draft, setDraft] = useState(() => structuredClone(snapshot));
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!dirty) setDraft(structuredClone(snapshot));
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
      setError(validation.error.issues[0]?.message ?? "Review the site settings and link values.");
      setSuccess("");
      return;
    }
    onChange(validation.data);
    setDraft(validation.data);
    setDirty(false);
    setError("");
    setSuccess("Site settings applied to the dashboard session. Save a draft to persist them.");
  }

  function cancel() {
    if (dirty && !window.confirm("Discard unsaved site settings?")) return;
    setDraft(structuredClone(snapshot));
    setDirty(false);
    setError("");
    setSuccess("Unsaved site settings were discarded.");
  }

  const sectionOptions = draft.pages.flatMap((page) =>
    page.sections.map((section) => ({
      id: section.id,
      label: `${page.title} · ${section.type}`,
    })),
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm text-muted-foreground">Identity and site chrome</p>
          <h1 className="mt-1 text-3xl font-semibold">Site settings</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Edit supported identity, contact, navigation, and footer fields.
          </p>
        </div>
        <span className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground">
          Unsaved editor changes
        </span>
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
      {dirty && <p className="text-xs text-primary">Unsaved site settings</p>}
      <section className={cardClass}>
        <h2 className="font-semibold">Site identity and profile</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {(
            [
              ["name", "Public name"],
              ["fullName", "Full name"],
              ["role", "Role"],
              ["location", "Location"],
              ["availability", "Availability"],
              ["email", "Public email"],
              ["whatsapp", "WhatsApp"],
              ["behance", "Behance URL"],
              ["linkedin", "LinkedIn URL"],
            ] as const
          ).map(([key, label]) => (
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
              type={
                key === "email" ? "email" : key === "behance" || key === "linkedin" ? "url" : "text"
              }
            />
          ))}
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
          <TextField
            label="Profile role"
            value={draft.profile.role}
            onChange={(role) =>
              update((current) => ({ ...current, profile: { ...current.profile, role } }))
            }
          />
          <TextField
            label="Profile location"
            value={draft.profile.location}
            onChange={(location) =>
              update((current) => ({ ...current, profile: { ...current.profile, location } }))
            }
          />
          <TextField
            label="Profile focus"
            value={draft.profile.focus}
            onChange={(focus) =>
              update((current) => ({ ...current, profile: { ...current.profile, focus } }))
            }
          />
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
        </div>
        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          <section className="rounded-xl border border-border p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold">Profile toolkit</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Manage tools and their use in your profile.
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
                No toolkit entries yet.
              </p>
            ) : (
              <ol className="mt-4 space-y-3">
                {[...draft.profile.toolkit]
                  .sort((a, b) => a.order - b.order)
                  .map((tool, index) => (
                    <li key={tool.id} className="rounded-lg border border-border p-3">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <TextField
                          label="Tool name"
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
                        <TextField
                          label="Tool use"
                          value={tool.use}
                          onChange={(use) =>
                            update((current) => ({
                              ...current,
                              profile: {
                                ...current.profile,
                                toolkit: current.profile.toolkit.map((item) =>
                                  item.id === tool.id ? { ...item, use } : item,
                                ),
                              },
                            }))
                          }
                        />
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
                            if (!window.confirm(`Remove "${tool.name}" from the profile draft?`))
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
                            if (!window.confirm(`Remove "${stat.label}" from the profile draft?`))
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
      </section>
      <section className={cardClass}>
        <h2 className="font-semibold">Contact form behavior</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
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
                    socialLinks: { ...current.contact.socialLinks, [key]: "https://example.com/" },
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
                update((current) => ({ ...current, footer: { ...current.footer, [key]: value } }))
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
    if (!dirty) setDraft(structuredClone(snapshot));
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
