import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDemoContent } from "@/lib/cms/demo-content";
import {
  loadAdminCmsSnapshot,
  loadPublishedCmsContent,
  loadPublishedCmsSnapshot,
  listAdminCmsMedia,
  publishAdminCmsDraft,
  restoreAdminCmsRevision,
  saveAdminCmsDraft,
  unpublishAdminCmsSnapshot,
} from "@/lib/cms/server-repository.server";
import type { ContentSnapshot } from "@/lib/cms/schema";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getUser: vi.fn(),
  rpc: vi.fn(),
  createSignedUrls: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: mocks.createClient,
}));

const environment = {
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "test-publishable-key",
};

function installClient() {
  mocks.createClient.mockReturnValue({
    auth: { getUser: mocks.getUser },
    rpc: mocks.rpc,
    storage: {
      from: vi.fn(() => ({ createSignedUrls: mocks.createSignedUrls })),
    },
  });
  mocks.getUser.mockResolvedValue({
    data: { user: { id: "authenticated-user" } },
    error: null,
  });
}

function cmsStoredSnapshot(snapshot: ContentSnapshot) {
  return {
    ...snapshot,
    origin: "cms" as const,
    revisions: [],
    publication: {
      status: "unpublished" as const,
      publishedRevisionId: null,
      draftRevisionId: null,
      updatedAt: null,
    },
  };
}

function adminState(
  snapshot: ContentSnapshot,
  revisionId: string,
  status: "draft" | "published" | "unpublished",
) {
  const timestamp = "2026-06-10T12:00:00.000Z";
  return {
    snapshot: cmsStoredSnapshot(snapshot),
    draft_revision_id: status === "draft" ? revisionId : null,
    published_revision_id: status === "published" ? revisionId : null,
    updated_at: timestamp,
    revisions: [
      {
        id: revisionId,
        number: 2,
        status,
        created_at: timestamp,
        updated_at: timestamp,
        published_at: status === "published" ? timestamp : null,
        based_on_revision_id: null,
        created_by: "3c04b322-8f5a-479a-bf03-dc24825162bd",
      },
    ],
  };
}

describe("server CMS repository authorization and draft saves", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    installClient();
  });

  it("rejects an invalid or expired Supabase session before requesting CMS data", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: "Invalid JWT" },
    });

    await expect(loadAdminCmsSnapshot(environment, "expired-token")).rejects.toThrow(
      "invalid or expired",
    );
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("does not accept an invalid snapshot or contact the database", async () => {
    const snapshot = await createDemoContent();
    const invalidSnapshot = { ...snapshot, categories: [] };

    await expect(
      saveAdminCmsDraft(environment, "valid-token", null, invalidSnapshot),
    ).rejects.toThrow("Invalid CMS content");
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("surfaces database authorization denial instead of returning demo success", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { code: "42501", message: "Administrator authorization required" },
    });

    await expect(loadAdminCmsSnapshot(environment, "valid-token")).rejects.toThrow(
      "not authorized as a CMS administrator",
    );
  });

  it("stores a validated draft with its expected revision and returns persisted metadata", async () => {
    const snapshot = await createDemoContent();
    const revisionId = "9c12d6f1-126e-4e31-bd8f-166c2a15cc41";
    const createdAt = "2026-06-10T12:00:00.000Z";
    mocks.rpc
      .mockResolvedValueOnce({ data: { revision_id: revisionId }, error: null })
      .mockResolvedValueOnce({
        data: {
          snapshot: cmsStoredSnapshot(snapshot),
          draft_revision_id: revisionId,
          published_revision_id: null,
          updated_at: createdAt,
          revisions: [
            {
              id: revisionId,
              number: 1,
              status: "draft",
              created_at: createdAt,
              updated_at: createdAt,
              published_at: null,
              based_on_revision_id: null,
              created_by: "3c04b322-8f5a-479a-bf03-dc24825162bd",
            },
          ],
        },
        error: null,
      });

    const saved = await saveAdminCmsDraft(environment, "valid-token", null, snapshot);

    expect(mocks.rpc).toHaveBeenNthCalledWith(
      1,
      "portfolio_cms_save_draft",
      expect.objectContaining({
        p_site_id: "portfolio",
        p_expected_revision_id: null,
      }),
    );
    expect(saved.origin).toBe("cms");
    expect(saved.publication.draftRevisionId).toBe(revisionId);
    expect(saved.revisions[0]?.number).toBe(1);
  });

  it("does not publish unreferenced private media in a saved snapshot", async () => {
    const snapshot = await createDemoContent();
    const unusedMediaId = "9c12d6f1-126e-4e31-bd8f-166c2a15cc41";
    const candidate = {
      ...snapshot,
      media: [
        ...snapshot.media,
        {
          id: unusedMediaId,
          source: {
            kind: "storage" as const,
            key: `portfolio/${unusedMediaId}/${unusedMediaId}.webp`,
          },
          mimeType: "image/webp",
          sizeBytes: 1200,
          alt: "Unattached media",
          caption: "Not referenced",
        },
      ],
    };
    const revisionId = "cc117db4-21b9-4c7e-970a-0cc8cf40f241";
    mocks.rpc
      .mockResolvedValueOnce({ data: { revision_id: revisionId }, error: null })
      .mockResolvedValueOnce({ data: adminState(snapshot, revisionId, "draft"), error: null });

    await saveAdminCmsDraft(environment, "valid-token", null, candidate);

    const [, saveArguments] = mocks.rpc.mock.calls[0]!;
    expect(
      (saveArguments as { p_snapshot: ContentSnapshot }).p_snapshot.media.some(
        ({ id }) => id === unusedMediaId,
      ),
    ).toBe(false);
  });

  it("lists stored media only after verifying the administrator session", async () => {
    const media = {
      id: "9c12d6f1-126e-4e31-bd8f-166c2a15cc41",
      source: {
        kind: "storage",
        key: "portfolio/9c12d6f1-126e-4e31-bd8f-166c2a15cc41/9c12d6f1-126e-4e31-bd8f-166c2a15cc41.webp",
      },
      mimeType: "image/webp",
      width: 1280,
      height: 720,
      sizeBytes: 1200,
      alt: "Image",
      caption: "Media",
    };
    mocks.rpc.mockResolvedValue({ data: [{ ...media, deleting: false }], error: null });

    await expect(listAdminCmsMedia(environment, "valid-token")).resolves.toEqual({
      assets: [media],
      deletingIds: [],
    });
    expect(mocks.getUser).toHaveBeenCalledOnce();
    expect(mocks.rpc).toHaveBeenCalledWith("portfolio_cms_list_media");
  });

  it("reports an optimistic revision conflict without retrying or overwriting", async () => {
    const snapshot = await createDemoContent();
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { code: "40001", message: "Draft revision conflict" },
    });

    await expect(
      saveAdminCmsDraft(
        environment,
        "valid-token",
        "9c12d6f1-126e-4e31-bd8f-166c2a15cc41",
        snapshot,
      ),
    ).rejects.toThrow("changed in another session");
    expect(mocks.rpc).toHaveBeenCalledOnce();
  });

  it("restores a selected revision as a new, conflict-checked draft", async () => {
    const snapshot = await createDemoContent();
    const revisionId = "9c12d6f1-126e-4e31-bd8f-166c2a15cc41";
    const restoredId = "cc117db4-21b9-4c7e-970a-0cc8cf40f241";
    mocks.rpc
      .mockResolvedValueOnce({ data: { revision_id: restoredId }, error: null })
      .mockResolvedValueOnce({ data: adminState(snapshot, restoredId, "draft"), error: null });

    const restored = await restoreAdminCmsRevision(environment, "valid-token", revisionId, null);

    expect(mocks.rpc).toHaveBeenNthCalledWith(
      1,
      "portfolio_cms_restore_revision",
      expect.objectContaining({
        p_revision_id: revisionId,
        p_expected_revision_id: null,
      }),
    );
    expect(restored.publication.draftRevisionId).toBe(restoredId);
  });

  it("publishes only the current saved draft and returns published metadata", async () => {
    const snapshot = await createDemoContent();
    const revisionId = "9c12d6f1-126e-4e31-bd8f-166c2a15cc41";
    mocks.rpc
      .mockResolvedValueOnce({ data: { published_revision_id: revisionId }, error: null })
      .mockResolvedValueOnce({ data: adminState(snapshot, revisionId, "published"), error: null });

    const published = await publishAdminCmsDraft(environment, "valid-token", revisionId);

    expect(mocks.rpc).toHaveBeenNthCalledWith(
      1,
      "portfolio_cms_publish",
      expect.objectContaining({ p_revision_id: revisionId }),
    );
    expect(published.publication.status).toBe("published");
    expect(published.publication.publishedRevisionId).toBe(revisionId);
  });

  it("unpublishes without exposing a published pointer", async () => {
    const snapshot = await createDemoContent();
    const revisionId = "9c12d6f1-126e-4e31-bd8f-166c2a15cc41";
    mocks.rpc
      .mockResolvedValueOnce({ data: { published_revision_id: null }, error: null })
      .mockResolvedValueOnce({
        data: adminState(snapshot, revisionId, "unpublished"),
        error: null,
      });

    const unpublished = await unpublishAdminCmsSnapshot(environment, "valid-token");

    expect(mocks.rpc).toHaveBeenNthCalledWith(
      1,
      "portfolio_cms_unpublish",
      expect.objectContaining({ p_site_id: "portfolio" }),
    );
    expect(unpublished?.publication.status).toBe("unpublished");
    expect(unpublished?.publication.publishedRevisionId).toBeNull();
  });

  it("loads public content only through the published-snapshot RPC", async () => {
    const snapshot = await createDemoContent();
    const revisionId = "9c12d6f1-126e-4e31-bd8f-166c2a15cc41";
    const state = adminState(snapshot, revisionId, "published");
    mocks.rpc.mockResolvedValue({
      data: {
        snapshot: state.snapshot,
        revision: state.revisions[0],
      },
      error: null,
    });

    const published = await loadPublishedCmsSnapshot(environment);

    expect(mocks.getUser).not.toHaveBeenCalled();
    expect(mocks.rpc).toHaveBeenCalledWith(
      "portfolio_cms_get_published_snapshot",
      expect.objectContaining({ p_site_id: "portfolio" }),
    );
    expect(published?.publication.status).toBe("published");
  });

  it("creates delivery URLs only for the published snapshot's stored media", async () => {
    const snapshot = await createDemoContent();
    const project = snapshot.projects[0]!;
    const mediaId = "f9c12d6f-126e-4e31-bd8f-166c2a15cc41";
    project.coverMedia = { mediaId, alt: project.title };
    const storageKey = `portfolio/${mediaId}/${mediaId}.webp`;
    snapshot.media.push({
      id: mediaId,
      source: { kind: "storage", key: storageKey },
      mimeType: "image/webp",
      sizeBytes: 1200,
      alt: project.title,
    });
    const revisionId = "9c12d6f1-126e-4e31-bd8f-166c2a15cc41";
    const state = adminState(snapshot, revisionId, "published");
    mocks.rpc.mockResolvedValue({
      data: { snapshot: state.snapshot, revision: state.revisions[0] },
      error: null,
    });
    mocks.createSignedUrls.mockResolvedValue({
      data: [{ path: storageKey, signedUrl: "https://images.example.test/signed.webp" }],
      error: null,
    });

    const published = await loadPublishedCmsContent(environment);

    expect(published?.mediaUrls[mediaId]).toBe("https://images.example.test/signed.webp");
    expect(mocks.createSignedUrls).toHaveBeenCalledWith([storageKey], 604800);
  });
});
