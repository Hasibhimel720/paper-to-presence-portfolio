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
import { contentSnapshotSchema, type ContentSnapshot } from "@/lib/cms/schema";

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

  it("rejects service references when their CMS media asset is not registered in the snapshot", async () => {
    const snapshot = await createDemoContent();
    snapshot.services[0]!.image = {
      mediaId: "8c752cdb-eaa5-4cda-9850-cddc7a547403",
      alt: "Unregistered service image",
    };

    expect(contentSnapshotSchema.safeParse(snapshot).success).toBe(false);
    await expect(saveAdminCmsDraft(environment, "valid-token", null, snapshot)).rejects.toThrow(
      "Invalid CMS content: Service references unknown media",
    );
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

  it("persists a referenced Hero background asset when saving a draft", async () => {
    const snapshot = await createDemoContent();
    const heroBackground = {
      id: "71bf1b24-7954-475c-abb2-4bc2ce502ec7",
      source: {
        kind: "storage" as const,
        key: "portfolio/71bf1b24-7954-475c-abb2-4bc2ce502ec7/hero.webp",
      },
      mimeType: "image/webp",
      sizeBytes: 1200,
      alt: "Hero background",
    };
    const homePage = snapshot.pages.find(({ slug }) => slug === "/");
    const hero = homePage?.sections.find((section) => section.type === "hero");
    if (!hero || hero.type !== "hero") throw new Error("Expected the homepage Hero section.");
    snapshot.media.push(heroBackground);
    hero.data.backgroundImage = { mediaId: heroBackground.id, alt: heroBackground.alt };

    const candidate = contentSnapshotSchema.parse(snapshot);
    const revisionId = "cc117db4-21b9-4c7e-970a-0cc8cf40f241";
    mocks.rpc
      .mockResolvedValueOnce({ data: { revision_id: revisionId }, error: null })
      .mockResolvedValueOnce({ data: adminState(candidate, revisionId, "draft"), error: null });

    await expect(
      saveAdminCmsDraft(environment, "valid-token", null, candidate),
    ).resolves.toMatchObject({
      publication: { draftRevisionId: revisionId },
    });

    expect(mocks.rpc).toHaveBeenNthCalledWith(
      1,
      "portfolio_cms_save_draft",
      expect.objectContaining({
        p_snapshot: expect.objectContaining({
          media: expect.arrayContaining([heroBackground]),
          pages: expect.arrayContaining([
            expect.objectContaining({
              sections: expect.arrayContaining([
                expect.objectContaining({
                  type: "hero",
                  data: expect.objectContaining({
                    backgroundImage: {
                      mediaId: heroBackground.id,
                      alt: heroBackground.alt,
                    },
                  }),
                }),
              ]),
            }),
          ]),
        }),
      }),
    );
  });

  it("retains the navigation logo media asset in the saved draft", async () => {
    const snapshot = await createDemoContent();
    const logo = {
      id: "a1b2c3d4-e5f6-4789-a123-123456789abc",
      source: {
        kind: "storage" as const,
        key: "portfolio/a1b2c3d4-e5f6-4789-a123-123456789abc/logo.png",
      },
      mimeType: "image/png",
      sizeBytes: 1200,
      alt: "Portfolio logo",
    };
    snapshot.media.push(logo);
    snapshot.navigationLogo = { mediaId: logo.id, alt: logo.alt };
    const candidate = contentSnapshotSchema.parse(snapshot);
    const revisionId = "9c12d6f1-126e-4e31-bd8f-166c2a15cc41";
    mocks.rpc
      .mockResolvedValueOnce({ data: { revision_id: revisionId }, error: null })
      .mockResolvedValueOnce({ data: adminState(candidate, revisionId, "draft"), error: null });

    await saveAdminCmsDraft(environment, "valid-token", null, candidate);

    const [, saveArguments] = mocks.rpc.mock.calls[0]!;
    const persisted = (saveArguments as { p_snapshot: ContentSnapshot }).p_snapshot;
    expect(persisted.navigationLogo).toEqual({ mediaId: logo.id, alt: logo.alt });
    expect(persisted.media).toContainEqual(logo);
  });

  it("retains multiple independently referenced service images in the saved draft", async () => {
    const snapshot = await createDemoContent();
    const firstAsset = {
      id: "8c752cdb-eaa5-4cda-9850-cddc7a547403",
      source: {
        kind: "storage" as const,
        key: "portfolio/8c752cdb-eaa5-4cda-9850-cddc7a547403/service-one.webp",
      },
      mimeType: "image/webp",
      sizeBytes: 1200,
      alt: "First service image",
    };
    const secondAsset = {
      id: "c2be045e-136b-47de-bd59-4850a3feeb09",
      source: {
        kind: "storage" as const,
        key: "portfolio/c2be045e-136b-47de-bd59-4850a3feeb09/service-two.webp",
      },
      mimeType: "image/webp",
      sizeBytes: 1400,
      alt: "Second service image",
    };
    snapshot.media.push(firstAsset, secondAsset);
    snapshot.services[0]!.image = { mediaId: firstAsset.id, alt: firstAsset.alt };
    snapshot.services[1]!.image = { mediaId: secondAsset.id, alt: secondAsset.alt };

    const candidate = contentSnapshotSchema.parse(snapshot);
    const revisionId = "9c12d6f1-126e-4e31-bd8f-166c2a15cc41";
    mocks.rpc
      .mockResolvedValueOnce({ data: { revision_id: revisionId }, error: null })
      .mockResolvedValueOnce({
        data: adminState(candidate, revisionId, "draft"),
        error: null,
      })
      .mockResolvedValueOnce({
        data: adminState(candidate, revisionId, "draft"),
        error: null,
      });

    await expect(
      saveAdminCmsDraft(environment, "valid-token", null, candidate),
    ).resolves.toMatchObject({
      publication: { draftRevisionId: revisionId },
    });
    const refreshed = await loadAdminCmsSnapshot(environment, "valid-token");
    expect(refreshed?.services.slice(0, 2).map(({ image }) => image?.mediaId)).toEqual([
      firstAsset.id,
      secondAsset.id,
    ]);
    expect(refreshed?.media).toEqual(expect.arrayContaining([firstAsset, secondAsset]));

    const [, saveArguments] = mocks.rpc.mock.calls[0]!;
    const persisted = (saveArguments as { p_snapshot: ContentSnapshot }).p_snapshot;
    expect(persisted.services.slice(0, 2).map(({ image }) => image?.mediaId)).toEqual([
      firstAsset.id,
      secondAsset.id,
    ]);
    expect(persisted.media).toEqual(expect.arrayContaining([firstAsset, secondAsset]));
    expect(contentSnapshotSchema.safeParse(persisted).success).toBe(true);
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
    const serviceImageId = "8c752cdb-eaa5-4cda-9850-cddc7a547403";
    const serviceStorageKey = `portfolio/${serviceImageId}/${serviceImageId}.webp`;
    snapshot.services[0]!.image = { mediaId: serviceImageId, alt: "Published service art" };
    snapshot.media.push(
      {
        id: mediaId,
        source: { kind: "storage", key: storageKey },
        mimeType: "image/webp",
        sizeBytes: 1200,
        alt: project.title,
      },
      {
        id: serviceImageId,
        source: { kind: "storage", key: serviceStorageKey },
        mimeType: "image/webp",
        sizeBytes: 1400,
        alt: "Published service art",
      },
    );
    const revisionId = "9c12d6f1-126e-4e31-bd8f-166c2a15cc41";
    const state = adminState(snapshot, revisionId, "published");
    mocks.rpc.mockResolvedValue({
      data: { snapshot: state.snapshot, revision: state.revisions[0] },
      error: null,
    });
    mocks.createSignedUrls.mockResolvedValue({
      data: [
        { path: storageKey, signedUrl: "https://images.example.test/signed.webp" },
        {
          path: serviceStorageKey,
          signedUrl: "https://images.example.test/service-signed.webp",
        },
      ],
      error: null,
    });

    const published = await loadPublishedCmsContent(environment);

    expect(published?.mediaUrls[mediaId]).toBe("https://images.example.test/signed.webp");
    expect(published?.snapshot.services[0]?.image?.mediaId).toBe(serviceImageId);
    expect(published?.mediaUrls[serviceImageId]).toBe(
      "https://images.example.test/service-signed.webp",
    );
    expect(mocks.createSignedUrls).toHaveBeenCalledWith([storageKey, serviceStorageKey], 604800);
  });

  it("returns a published navigation logo with its signed delivery URL", async () => {
    const snapshot = await createDemoContent();
    const mediaId = "a1b2c3d4-e5f6-4789-a123-123456789abc";
    const storageKey = `portfolio/${mediaId}/logo.png`;
    snapshot.navigationLogo = { mediaId, alt: "Portfolio logo" };
    snapshot.media.push({
      id: mediaId,
      source: { kind: "storage", key: storageKey },
      mimeType: "image/png",
      sizeBytes: 1200,
      alt: "Portfolio logo",
    });
    const revisionId = "9c12d6f1-126e-4e31-bd8f-166c2a15cc41";
    const state = adminState(snapshot, revisionId, "published");
    mocks.rpc.mockResolvedValue({
      data: { snapshot: state.snapshot, revision: state.revisions[0] },
      error: null,
    });
    mocks.createSignedUrls.mockResolvedValue({
      data: [{ path: storageKey, signedUrl: "https://images.example.test/logo-signed.png" }],
      error: null,
    });

    const published = await loadPublishedCmsContent(environment);

    expect(published?.snapshot.navigationLogo).toEqual({ mediaId, alt: "Portfolio logo" });
    expect(published?.snapshot.media.some((asset) => asset.id === mediaId)).toBe(true);
    expect(published?.mediaUrls[mediaId]).toBe("https://images.example.test/logo-signed.png");
    expect(mocks.createSignedUrls).toHaveBeenCalledWith([storageKey], 604800);
  });
});
