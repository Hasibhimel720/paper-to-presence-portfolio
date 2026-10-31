import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  BriefcaseBusiness,
  ChevronRight,
  CircleHelp,
  Clock3,
  Eye,
  FileText,
  Images,
  LayoutDashboard,
  LogOut,
  Menu,
  Palette,
  Search,
  Settings2,
  Sparkles,
  Tags,
  WandSparkles,
} from "lucide-react";
import { createDemoContent } from "@/lib/cms/demo-content";
import { contentSnapshotSchema, type ContentSnapshot } from "@/lib/cms/schema";
import { PortfolioPage } from "@/routes/index";
import { toLegacyPortfolioContent } from "@/lib/cms/public-content";
import { useCmsMediaUrls } from "@/lib/cms/media-storage";
import {
  listAdminCmsMediaServerFn,
  loadAdminCmsServerFn,
  publishAdminCmsDraftServerFn,
  restoreAdminCmsRevisionServerFn,
  saveAdminCmsDraftServerFn,
  unpublishAdminCmsServerFn,
} from "@/lib/cms/server-functions";
import { OverviewPage } from "@/components/admin/OverviewPage";
import { PagesWorkspace } from "@/components/admin/PagesWorkspace";
import { ProjectsWorkspace } from "@/components/admin/ProjectsWorkspace";
import {
  CategoriesWorkspace,
  CollectionWorkspace,
  MediaWorkspace,
} from "@/components/admin/ContentWorkspaces";
import { DesignSeoWorkspace, SiteSettingsWorkspace } from "@/components/admin/SettingsWorkspaces";

type AdminShellProps = {
  onSignOut: () => void | Promise<void>;
  signingOut: boolean;
  getAccessToken?: () => Promise<string>;
};

const emptyMedia: ContentSnapshot["media"] = [];

function currentRevisionId(snapshot: ContentSnapshot) {
  return (
    snapshot.publication.draftRevisionId ??
    snapshot.publication.publishedRevisionId ??
    snapshot.revisions[0]?.id ??
    null
  );
}

function mergeMediaLibrary(
  snapshot: ContentSnapshot,
  existingMedia: ContentSnapshot["media"],
): ContentSnapshot {
  const mediaById = new Map(existingMedia.map((asset) => [asset.id, asset]));
  snapshot.media.forEach((asset) => mediaById.set(asset.id, asset));
  return contentSnapshotSchema.parse({ ...snapshot, media: Array.from(mediaById.values()) });
}

const sections = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "pages", label: "Pages", icon: FileText },
  { id: "projects", label: "Projects", icon: BriefcaseBusiness },
  { id: "categories", label: "Categories", icon: Tags },
  { id: "services", label: "Services", icon: Sparkles },
  { id: "experience", label: "Experience", icon: Clock3 },
  { id: "process", label: "Process", icon: WandSparkles },
  { id: "faqs", label: "FAQs", icon: CircleHelp },
  { id: "media", label: "Media library", icon: Images },
  { id: "design", label: "Design & SEO", icon: Palette },
  { id: "settings", label: "Site settings", icon: Settings2 },
];

export function AdminShell({ onSignOut, signingOut, getAccessToken }: AdminShellProps) {
  const [snapshot, setSnapshot] = useState<ContentSnapshot | null>(null);
  const [activeSection, setActiveSection] = useState("overview");
  const [loadError, setLoadError] = useState("");
  const [snapshotError, setSnapshotError] = useState("");
  const [cmsMessage, setCmsMessage] = useState("");
  const [cmsBusy, setCmsBusy] = useState(false);
  const [demoMode, setDemoMode] = useState(!getAccessToken);
  const [expectedRevisionId, setExpectedRevisionId] = useState<string | null>(null);
  const [selectedRevisionId, setSelectedRevisionId] = useState("");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [pendingMediaDeletionIds, setPendingMediaDeletionIds] = useState<string[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewMessage, setPreviewMessage] = useState("");
  const previewDialogRef = useRef<HTMLDivElement>(null);
  const previewCloseButtonRef = useRef<HTMLButtonElement>(null);
  const { urls: previewMediaUrls, error: previewMediaError } = useCmsMediaUrls(
    previewOpen ? (snapshot?.media ?? emptyMedia) : emptyMedia,
  );

  useEffect(() => {
    if (!previewOpen) return;
    const previousOverflow = document.body.style.overflow;
    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.style.overflow = "hidden";
    previewCloseButtonRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [previewOpen]);

  useEffect(() => {
    let active = true;
    async function loadContent() {
      try {
        if (getAccessToken) {
          const accessToken = await getAccessToken();
          const savedSnapshot = await loadAdminCmsServerFn({ data: { accessToken } });
          const library = await listAdminCmsMediaServerFn({ data: { accessToken } });
          if (!active) return;
          const baseline = savedSnapshot ?? (await createDemoContent());
          const mediaById = new Map(baseline.media.map((asset) => [asset.id, asset]));
          library.assets.forEach((asset) => mediaById.set(asset.id, asset));
          setPendingMediaDeletionIds(library.deletingIds);
          const content = contentSnapshotSchema.parse({
            ...baseline,
            media: Array.from(mediaById.values()),
          });
          if (savedSnapshot) {
            setSnapshot(content);
            setExpectedRevisionId(currentRevisionId(content));
            setDemoMode(false);
            setCmsMessage("CMS content loaded. Save draft persists edits; publishing is separate.");
            return;
          }
          setDemoMode(false);
          setCmsMessage(
            "No saved CMS content yet. The static baseline is ready for its first draft.",
          );
          setSnapshot(content);
          return;
        }

        const content = await createDemoContent();
        if (active) setSnapshot(content);
      } catch (error) {
        if (!active) return;
        const content = await createDemoContent();
        if (!active) return;
        setSnapshot(content);
        setLoadError(
          error instanceof Error
            ? error.message
            : "The CMS could not be reached. Changes cannot be saved until the CMS is available.",
        );
      }
    }

    void loadContent().catch(() => {
      if (active) setLoadError("Content could not be loaded. Please refresh to try again.");
    });
    return () => {
      active = false;
    };
  }, [getAccessToken]);

  const activeLabel = sections.find(({ id }) => id === activeSection)?.label ?? "Overview";

  function commitSnapshot(candidate: ContentSnapshot) {
    const validation = contentSnapshotSchema.safeParse(candidate);
    if (!validation.success) {
      setSnapshotError(validation.error.issues[0]?.message ?? "The content change is invalid.");
      return;
    }
    setSnapshot(validation.data);
    setSnapshotError("");
    setHasUnsavedChanges(true);
  }

  async function saveDraft() {
    if (!snapshot || !getAccessToken) {
      setCmsMessage("Persistent CMS saving is unavailable in this demo session.");
      return;
    }
    setCmsBusy(true);
    setSnapshotError("");
    try {
      const accessToken = await getAccessToken();
      const saved = await saveAdminCmsDraftServerFn({
        data: { accessToken, expectedRevisionId, snapshot },
      });
      setSnapshot(mergeMediaLibrary(saved, snapshot.media));
      setExpectedRevisionId(saved.publication.draftRevisionId);
      setHasUnsavedChanges(false);
      setDemoMode(false);
      setLoadError("");
      setCmsMessage(`Draft revision ${saved.revisions[0]?.number ?? ""} saved.`);
    } catch (error) {
      setSnapshotError(error instanceof Error ? error.message : "Unable to save the draft.");
    } finally {
      setCmsBusy(false);
    }
  }

  async function reloadDraft() {
    if (!getAccessToken) return;
    if (
      hasUnsavedChanges &&
      !window.confirm("Discard unsaved edits and reload the latest revision?")
    ) {
      return;
    }
    setCmsBusy(true);
    setSnapshotError("");
    try {
      const accessToken = await getAccessToken();
      const loaded = await loadAdminCmsServerFn({ data: { accessToken } });
      const library = await listAdminCmsMediaServerFn({ data: { accessToken } });
      const content = mergeMediaLibrary(loaded ?? (await createDemoContent()), library.assets);
      setPendingMediaDeletionIds(library.deletingIds);
      setSnapshot(content);
      setExpectedRevisionId(currentRevisionId(content));
      setHasUnsavedChanges(false);
      setDemoMode(false);
      setLoadError("");
      setCmsMessage(
        loaded
          ? "Latest saved CMS snapshot loaded."
          : "No saved CMS content exists yet. The static baseline is ready for its first draft.",
      );
    } catch (error) {
      setSnapshotError(error instanceof Error ? error.message : "Unable to reload CMS content.");
    } finally {
      setCmsBusy(false);
    }
  }

  async function restoreRevision() {
    if (!getAccessToken || !selectedRevisionId) return;
    if (
      !window.confirm(
        "Restore this revision as a new draft? Your current draft will remain in history.",
      )
    ) {
      return;
    }
    setCmsBusy(true);
    setSnapshotError("");
    try {
      const accessToken = await getAccessToken();
      const restored = await restoreAdminCmsRevisionServerFn({
        data: {
          accessToken,
          revisionId: selectedRevisionId,
          expectedRevisionId,
        },
      });
      setSnapshot(mergeMediaLibrary(restored, snapshot?.media ?? []));
      setExpectedRevisionId(currentRevisionId(restored));
      setHasUnsavedChanges(false);
      setCmsMessage(`Revision ${restored.revisions[0]?.number ?? ""} restored as a new draft.`);
    } catch (error) {
      setSnapshotError(error instanceof Error ? error.message : "Unable to restore this revision.");
    } finally {
      setCmsBusy(false);
    }
  }

  async function publishDraft() {
    if (!getAccessToken || !snapshot?.publication.draftRevisionId || hasUnsavedChanges) return;
    if (!window.confirm("Publish the saved draft to the public portfolio?")) return;
    setCmsBusy(true);
    setSnapshotError("");
    try {
      const accessToken = await getAccessToken();
      const published = await publishAdminCmsDraftServerFn({
        data: { accessToken, revisionId: snapshot.publication.draftRevisionId },
      });
      setSnapshot(mergeMediaLibrary(published, snapshot.media));
      setExpectedRevisionId(currentRevisionId(published));
      setCmsMessage("The saved revision is now published.");
    } catch (error) {
      setSnapshotError(error instanceof Error ? error.message : "Unable to publish the draft.");
    } finally {
      setCmsBusy(false);
    }
  }

  async function unpublish() {
    if (!getAccessToken || snapshot?.publication.status !== "published") return;
    if (!window.confirm("Unpublish this revision from the public portfolio?")) return;
    setCmsBusy(true);
    setSnapshotError("");
    try {
      const accessToken = await getAccessToken();
      const unpublished = await unpublishAdminCmsServerFn({ data: { accessToken } });
      if (unpublished) {
        setSnapshot(mergeMediaLibrary(unpublished, snapshot.media));
        setExpectedRevisionId(currentRevisionId(unpublished));
      }
      setCmsMessage("The published revision is no longer available to public visitors.");
    } catch (error) {
      setSnapshotError(
        error instanceof Error ? error.message : "Unable to unpublish the portfolio.",
      );
    } finally {
      setCmsBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col border-r border-border bg-card lg:flex">
        <a href="/" className="flex h-16 items-center gap-3 border-b border-border px-5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground">
            H
          </span>
          <span>
            <span className="block text-sm font-semibold">Hasib.Design</span>
            <span className="block text-xs text-muted-foreground">Portfolio CMS</span>
          </span>
        </a>

        <div className="px-4 pt-5">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
            <Search aria-hidden="true" className="h-3.5 w-3.5" />
            <span>Workspace navigation</span>
          </div>
        </div>

        <nav aria-label="Dashboard" className="flex-1 space-y-1 overflow-y-auto px-3 py-5">
          <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Manage website
          </p>
          {sections.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              aria-current={activeSection === id ? "page" : undefined}
              onClick={() => setActiveSection(id)}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                activeSection === id
                  ? "bg-accent font-medium text-foreground"
                  : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
              }`}
            >
              <Icon aria-hidden="true" className="h-4 w-4" />
              {label}
              {activeSection === id && (
                <ChevronRight aria-hidden="true" className="ml-auto h-4 w-4" />
              )}
            </button>
          ))}
        </nav>

        <div className="border-t border-border p-3">
          <button
            type="button"
            onClick={onSignOut}
            disabled={signingOut}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
          >
            <LogOut aria-hidden="true" className="h-4 w-4" />
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
          <div className="flex min-h-16 items-center justify-between gap-4 px-4 sm:px-7">
            <div className="flex min-w-0 items-center gap-3">
              <Menu aria-hidden="true" className="h-5 w-5 text-muted-foreground lg:hidden" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{activeLabel}</p>
                <p className="hidden text-xs text-muted-foreground sm:block">Portfolio workspace</p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <span className="hidden rounded-full border border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground sm:inline-flex">
                {demoMode
                  ? "Demo mode · changes reset on refresh"
                  : loadError
                    ? "CMS unavailable · edits cannot be saved"
                    : "CMS · draft and publish"}
              </span>
              <a
                href="/"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-medium transition-colors hover:bg-accent sm:text-sm"
              >
                <Eye aria-hidden="true" className="h-4 w-4" />
                <span className="hidden sm:inline">View website</span>
                <ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" />
              </a>
              <button
                type="button"
                aria-label="Sign out"
                onClick={onSignOut}
                disabled={signingOut}
                className="rounded-lg border border-border p-2 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50 lg:hidden"
              >
                <LogOut aria-hidden="true" className="h-4 w-4" />
              </button>
            </div>
          </div>
          <nav
            aria-label="Mobile dashboard"
            className="flex gap-1 overflow-x-auto border-t border-border px-3 py-2 lg:hidden"
          >
            {sections.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                aria-current={activeSection === id ? "page" : undefined}
                onClick={() => setActiveSection(id)}
                className={`shrink-0 rounded-lg px-3 py-2 text-xs ${
                  activeSection === id ? "bg-accent font-medium" : "text-muted-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </nav>
        </header>

        <main className="mx-auto max-w-[1440px] px-4 py-7 sm:px-7 sm:py-9">
          {!snapshot ? (
            loadError ? (
              <div
                role="alert"
                className="rounded-xl border border-destructive/40 bg-card p-5 text-sm"
              >
                {loadError}
              </div>
            ) : (
              <div
                role="status"
                className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground"
              >
                Loading portfolio content…
              </div>
            )
          ) : (
            <>
              {loadError && (
                <div
                  role="alert"
                  className="mb-5 rounded-xl border border-destructive/40 bg-card p-4 text-sm text-destructive"
                >
                  {loadError} The static baseline is available for editing and preview, but changes
                  will not reach the live website until the CMS is connected.
                </div>
              )}
              {snapshotError && (
                <div
                  role="alert"
                  className="mb-5 rounded-xl border border-destructive/40 bg-card p-4 text-sm text-destructive"
                >
                  {snapshotError}
                </div>
              )}
              <section
                aria-label="CMS publishing controls"
                className="mb-6 rounded-xl border border-border bg-card p-4 sm:p-5"
              >
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">Content status</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {loadError
                        ? "CMS unavailable. The static baseline is for editing and preview only; save and publish require a working CMS connection."
                        : demoMode
                          ? "Demo-only edits are temporary and do not reach the public website."
                          : hasUnsavedChanges
                            ? "Unsaved edits · save a draft before publishing."
                            : snapshot.publication.status === "published"
                              ? "A CMS revision is published."
                              : snapshot.publication.draftRevisionId
                                ? "A saved draft is not yet published."
                                : "No draft has been saved yet."}
                    </p>
                    {cmsMessage && (
                      <p
                        role="status"
                        aria-live="polite"
                        className="mt-2 text-xs text-muted-foreground"
                      >
                        {cmsMessage}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setPreviewMessage("");
                        setPreviewOpen(true);
                      }}
                      disabled={!snapshot}
                      className="rounded-lg border border-border px-3 py-2 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Preview edits
                    </button>
                    <button
                      type="button"
                      onClick={saveDraft}
                      disabled={cmsBusy || demoMode}
                      className="rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {cmsBusy ? "Working…" : "Save draft"}
                    </button>
                    <button
                      type="button"
                      onClick={reloadDraft}
                      disabled={cmsBusy || demoMode}
                      className="rounded-lg border border-border px-3 py-2 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Reload saved
                    </button>
                    <button
                      type="button"
                      onClick={publishDraft}
                      disabled={
                        cmsBusy ||
                        demoMode ||
                        hasUnsavedChanges ||
                        !snapshot.publication.draftRevisionId
                      }
                      className="rounded-lg border border-border px-3 py-2 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Publish
                    </button>
                    <button
                      type="button"
                      onClick={unpublish}
                      disabled={cmsBusy || demoMode || snapshot.publication.status !== "published"}
                      className="rounded-lg border border-border px-3 py-2 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Unpublish
                    </button>
                    <label className="sr-only" htmlFor="cms-revision">
                      Revision history
                    </label>
                    <select
                      id="cms-revision"
                      value={selectedRevisionId}
                      onChange={(event) => setSelectedRevisionId(event.target.value)}
                      disabled={cmsBusy || demoMode || snapshot.revisions.length === 0}
                      className="max-w-48 rounded-lg border border-border bg-background px-2 py-2 text-xs disabled:opacity-50"
                    >
                      <option value="">Revision history</option>
                      {snapshot.revisions.map((revision) => (
                        <option key={revision.id} value={revision.id}>
                          Revision {revision.number} · {revision.status}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={restoreRevision}
                      disabled={cmsBusy || demoMode || !selectedRevisionId}
                      className="rounded-lg border border-border px-3 py-2 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Restore
                    </button>
                  </div>
                </div>
              </section>
              <div hidden={activeSection !== "overview"}>
                <OverviewPage
                  snapshot={snapshot}
                  onOpenSection={setActiveSection}
                  demoMode={demoMode}
                />
              </div>
              <div hidden={activeSection !== "pages"}>
                <PagesWorkspace snapshot={snapshot} onChange={commitSnapshot} />
              </div>
              <div hidden={activeSection !== "projects"}>
                <ProjectsWorkspace
                  snapshot={snapshot}
                  onChange={commitSnapshot}
                  cmsEnabled={!demoMode}
                />
              </div>
              <div hidden={activeSection !== "categories"}>
                <CategoriesWorkspace snapshot={snapshot} onChange={commitSnapshot} />
              </div>
              <div hidden={activeSection !== "services"}>
                <CollectionWorkspace
                  kind="services"
                  snapshot={snapshot}
                  onChange={commitSnapshot}
                />
              </div>
              <div hidden={activeSection !== "experience"}>
                <CollectionWorkspace
                  kind="experience"
                  snapshot={snapshot}
                  onChange={commitSnapshot}
                />
              </div>
              <div hidden={activeSection !== "process"}>
                <CollectionWorkspace kind="process" snapshot={snapshot} onChange={commitSnapshot} />
              </div>
              <div hidden={activeSection !== "faqs"}>
                <CollectionWorkspace kind="faqs" snapshot={snapshot} onChange={commitSnapshot} />
              </div>
              <div hidden={activeSection !== "media"}>
                <MediaWorkspace
                  snapshot={snapshot}
                  onChange={commitSnapshot}
                  cmsEnabled={!demoMode}
                  pendingDeletionIds={pendingMediaDeletionIds}
                />
              </div>
              <div hidden={activeSection !== "design"}>
                <DesignSeoWorkspace snapshot={snapshot} onChange={commitSnapshot} />
              </div>
              <div hidden={activeSection !== "settings"}>
                <SiteSettingsWorkspace snapshot={snapshot} onChange={commitSnapshot} />
              </div>
            </>
          )}
          <p className="mt-8 text-center text-xs text-muted-foreground">
            {demoMode
              ? "Demo only · No database reads or writes · Changes are temporary"
              : "CMS changes save as drafts; publishing is a separate action."}
          </p>
        </main>
      </div>
      {previewOpen && snapshot && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Draft preview"
          ref={previewDialogRef}
          className="fixed inset-0 z-[100] overflow-y-auto bg-background text-foreground"
          onKeyDownCapture={(event) => {
            if (event.key === "Escape") {
              setPreviewOpen(false);
              return;
            }
            if (event.key !== "Tab" || !previewDialogRef.current) return;
            const focusable = Array.from(
              previewDialogRef.current.querySelectorAll<HTMLElement>(
                'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
              ),
            );
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (!first || !last) return;
            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault();
              last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault();
              first.focus();
            }
          }}
          onClickCapture={(event) => {
            if (!(event.target instanceof Element)) return;
            const anchor = event.target.closest("a");
            if (!anchor || anchor.getAttribute("href")?.startsWith("#")) return;
            event.preventDefault();
            setPreviewMessage(
              "Navigation is disabled in this inline preview. The homepage draft is shown here; other page and project routes are not previewed.",
            );
          }}
        >
          <div className="sticky top-0 z-[101] border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
            <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Draft preview</p>
                <p className="text-xs text-muted-foreground">
                  Current edits, including unsaved changes. Private to this signed-in session;
                  previewing does not save or publish.
                </p>
              </div>
              <button
                type="button"
                ref={previewCloseButtonRef}
                onClick={() => setPreviewOpen(false)}
                className="rounded-lg border border-border px-3 py-2 text-sm"
              >
                Close preview
              </button>
            </div>
            {(previewMediaError || previewMessage) && (
              <p
                role={previewMediaError ? "alert" : "status"}
                className="mx-auto mt-2 max-w-[1440px] text-xs text-muted-foreground"
              >
                {previewMediaError || previewMessage}
              </p>
            )}
          </div>
          <PortfolioPage
            content={toLegacyPortfolioContent(snapshot, previewMediaUrls)}
            snapshot={snapshot}
            mediaUrls={previewMediaUrls}
            previewMode
          />
        </div>
      )}
    </div>
  );
}
