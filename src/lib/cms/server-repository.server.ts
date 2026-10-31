import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  contentSnapshotSchema,
  mediaAssetSchema,
  type ContentSnapshot,
  type MediaAsset,
} from "@/lib/cms/schema";

type RevisionMetadata = ContentSnapshot["revisions"][number];

type CmsEnvironment = {
  SUPABASE_URL: string | undefined;
  SUPABASE_PUBLISHABLE_KEY: string | undefined;
};

type RevisionRow = {
  id: string;
  number: number;
  status: RevisionMetadata["status"];
  created_at: string | null;
  updated_at: string | null;
  published_at: string | null;
  based_on_revision_id: string | null;
  created_by: string | null;
};

type AdminStateRow = {
  snapshot: unknown | null;
  current_revision_id: string | null;
  draft_revision_id: string | null;
  published_revision_id: string | null;
  updated_at: string | null;
  revisions: RevisionRow[];
};

type PublicSnapshotRow = {
  snapshot: unknown;
  revision: RevisionRow;
};

function createCmsClient(environment: CmsEnvironment, accessToken?: string) {
  const { SUPABASE_URL: url, SUPABASE_PUBLISHABLE_KEY: publishableKey } = environment;
  if (!url || !publishableKey) {
    throw new Error(
      "CMS server configuration is incomplete. Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY in the server runtime.",
    );
  }

  return createClient(url, publishableKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
    ...(accessToken ? { global: { headers: { Authorization: `Bearer ${accessToken}` } } } : {}),
  });
}

async function createVerifiedAdminClient(
  environment: CmsEnvironment,
  accessToken: string,
): Promise<SupabaseClient> {
  if (!accessToken.trim())
    throw new Error("Your administrator session has expired. Sign in again.");
  const client = createCmsClient(environment, accessToken);
  const { data, error } = await client.auth.getUser(accessToken);
  if (error || !data.user) {
    throw new Error("Your administrator session is invalid or expired. Sign in again.");
  }
  return client;
}

function mapRevision(row: RevisionRow): RevisionMetadata {
  return {
    id: row.id,
    number: Number(row.number),
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    publishedAt: row.published_at,
    basedOnRevisionId: row.based_on_revision_id,
    createdBy: row.created_by,
  };
}

function buildSnapshot(
  value: unknown,
  revisions: RevisionRow[],
  draftRevisionId: string | null,
  publishedRevisionId: string | null,
  updatedAt: string | null,
): ContentSnapshot {
  const base = contentSnapshotSchema.parse(value);
  const metadata = revisions.map(mapRevision);
  const publication: ContentSnapshot["publication"] = {
    status: publishedRevisionId ? "published" : "unpublished",
    publishedRevisionId,
    draftRevisionId,
    updatedAt,
  };
  const snapshot = contentSnapshotSchema.parse({
    ...base,
    origin: "cms",
    revisions: metadata,
    publication,
  });
  return snapshot;
}

async function callAdminState(client: SupabaseClient): Promise<AdminStateRow> {
  const { data, error } = await client.rpc("portfolio_cms_admin_state", {
    p_site_id: "portfolio",
  });
  if (error) {
    if (error.code === "42501") {
      throw new Error("This authenticated account is not authorized as a CMS administrator.");
    }
    throw new Error("Unable to load CMS data. Check the CMS migration and server configuration.");
  }
  if (!data || typeof data !== "object") {
    throw new Error("The CMS returned an invalid administrator response.");
  }
  return data as AdminStateRow;
}

export async function loadAdminCmsSnapshot(
  environment: CmsEnvironment,
  accessToken: string,
): Promise<ContentSnapshot | null> {
  const client = await createVerifiedAdminClient(environment, accessToken);
  const state = await callAdminState(client);
  if (!state.snapshot) return null;
  return buildSnapshot(
    state.snapshot,
    state.revisions ?? [],
    state.draft_revision_id,
    state.published_revision_id,
    state.updated_at,
  );
}

export async function listAdminCmsMedia(
  environment: CmsEnvironment,
  accessToken: string,
): Promise<{ assets: MediaAsset[]; deletingIds: string[] }> {
  const client = await createVerifiedAdminClient(environment, accessToken);
  const { data, error } = await client.rpc("portfolio_cms_list_media");
  if (error) {
    if (error.code === "42501") {
      throw new Error("This authenticated account is not authorized as a CMS administrator.");
    }
    throw new Error("Unable to load the media library. Check the CMS media migration.");
  }
  const result = mediaAssetSchema.extend({ deleting: z.boolean() }).array().safeParse(data);
  if (!result.success) throw new Error("The CMS returned invalid media library data.");
  return {
    assets: result.data.map(({ deleting: _deleting, ...asset }) => asset),
    deletingIds: result.data.filter(({ deleting }) => deleting).map(({ id }) => id),
  };
}

export async function saveAdminCmsDraft(
  environment: CmsEnvironment,
  accessToken: string,
  expectedRevisionId: string | null,
  candidate: unknown,
): Promise<ContentSnapshot> {
  const validated = contentSnapshotSchema.safeParse(candidate);
  if (!validated.success) {
    throw new Error(
      `Invalid CMS content: ${validated.error.issues[0]?.message ?? "check the fields"}`,
    );
  }
  const referencedMediaIds = new Set<string>();
  const addReference = (reference: { mediaId: string } | undefined) => {
    if (reference) referencedMediaIds.add(reference.mediaId);
  };
  validated.data.projects.forEach((project) => {
    addReference(project.coverMedia);
    project.gallery.forEach(addReference);
    project.sections.forEach((section) => section.media.forEach(addReference));
  });
  addReference(validated.data.profile.portrait);
  addReference(validated.data.seo.social.openGraphImage);
  addReference(validated.data.seo.social.twitterImage);
  validated.data.pages.forEach((page) => {
    addReference(page.seo.social.openGraphImage);
    addReference(page.seo.social.twitterImage);
  });
  const snapshotToPersist = {
    ...validated.data,
    media: validated.data.media.filter(
      (asset) => asset.source.kind === "url" || referencedMediaIds.has(asset.id),
    ),
  };
  const persistValidation = contentSnapshotSchema.safeParse(snapshotToPersist);
  if (!persistValidation.success) {
    throw new Error(
      `Invalid CMS media references: ${persistValidation.error.issues[0]?.message ?? "check media fields"}`,
    );
  }
  const client = await createVerifiedAdminClient(environment, accessToken);
  const { error } = await client.rpc("portfolio_cms_save_draft", {
    p_site_id: "portfolio",
    p_expected_revision_id: expectedRevisionId,
    p_snapshot: persistValidation.data,
  });
  if (error?.code === "40001") {
    throw new Error(
      "This draft changed in another session. Reload the latest revision before saving.",
    );
  }
  if (error) {
    if (error.code === "42501") {
      throw new Error("This authenticated account is not authorized as a CMS administrator.");
    }
    throw new Error("Unable to save the CMS draft. Check the migration and content validation.");
  }
  const state = await callAdminState(client);
  if (!state.snapshot) throw new Error("The CMS saved the draft but did not return it.");
  return buildSnapshot(
    state.snapshot,
    state.revisions ?? [],
    state.draft_revision_id,
    state.published_revision_id,
    state.updated_at,
  );
}

export async function restoreAdminCmsRevision(
  environment: CmsEnvironment,
  accessToken: string,
  revisionId: string,
  expectedRevisionId: string | null,
): Promise<ContentSnapshot> {
  const client = await createVerifiedAdminClient(environment, accessToken);
  const { error } = await client.rpc("portfolio_cms_restore_revision", {
    p_site_id: "portfolio",
    p_revision_id: revisionId,
    p_expected_revision_id: expectedRevisionId,
  });
  if (error?.code === "40001") {
    throw new Error("This draft changed in another session. Reload before restoring a revision.");
  }
  if (error) {
    if (error.code === "42501") {
      throw new Error("This authenticated account is not authorized as a CMS administrator.");
    }
    throw new Error("Unable to restore that revision. Refresh the history and try again.");
  }
  const state = await callAdminState(client);
  if (!state.snapshot) throw new Error("The CMS did not return the restored draft.");
  return buildSnapshot(
    state.snapshot,
    state.revisions ?? [],
    state.draft_revision_id,
    state.published_revision_id,
    state.updated_at,
  );
}

export async function publishAdminCmsDraft(
  environment: CmsEnvironment,
  accessToken: string,
  revisionId: string,
): Promise<ContentSnapshot> {
  const client = await createVerifiedAdminClient(environment, accessToken);
  const { error } = await client.rpc("portfolio_cms_publish", {
    p_site_id: "portfolio",
    p_revision_id: revisionId,
  });
  if (error?.code === "40001") {
    throw new Error("Only the current draft can be published. Reload the latest revision.");
  }
  if (error) {
    if (error.code === "42501") {
      throw new Error("This authenticated account is not authorized as a CMS administrator.");
    }
    throw new Error("Unable to publish the draft. Check the CMS migration and try again.");
  }
  const state = await callAdminState(client);
  if (!state.snapshot) throw new Error("The CMS published the draft but did not return content.");
  return buildSnapshot(
    state.snapshot,
    state.revisions ?? [],
    state.draft_revision_id,
    state.published_revision_id,
    state.updated_at,
  );
}

export async function unpublishAdminCmsSnapshot(
  environment: CmsEnvironment,
  accessToken: string,
): Promise<ContentSnapshot | null> {
  const client = await createVerifiedAdminClient(environment, accessToken);
  const { error } = await client.rpc("portfolio_cms_unpublish", {
    p_site_id: "portfolio",
  });
  if (error) {
    if (error.code === "42501") {
      throw new Error("This authenticated account is not authorized as a CMS administrator.");
    }
    throw new Error("Unable to unpublish the portfolio. Check the CMS migration and try again.");
  }
  const state = await callAdminState(client);
  if (!state.snapshot) return null;
  return buildSnapshot(
    state.snapshot,
    state.revisions ?? [],
    state.draft_revision_id,
    state.published_revision_id,
    state.updated_at,
  );
}

export async function loadPublishedCmsSnapshot(
  environment: CmsEnvironment,
): Promise<ContentSnapshot | null> {
  const client = createCmsClient(environment);
  const { data, error } = await client.rpc("portfolio_cms_get_published_snapshot", {
    p_site_id: "portfolio",
  });
  if (error) {
    throw new Error("Unable to read the published CMS snapshot.");
  }
  if (!data) return null;
  const result = data as PublicSnapshotRow;
  return buildSnapshot(
    result.snapshot,
    [result.revision],
    null,
    result.revision.id,
    result.revision.published_at,
  );
}

export async function loadPublishedCmsContent(
  environment: CmsEnvironment,
): Promise<{ snapshot: ContentSnapshot; mediaUrls: Record<string, string> } | null> {
  const snapshot = await loadPublishedCmsSnapshot(environment);
  if (!snapshot) return null;

  const storageAssets = snapshot.media.filter(
    (asset): asset is MediaAsset & { source: { kind: "storage"; key: string } } =>
      asset.source.kind === "storage",
  );
  if (storageAssets.length === 0) return { snapshot, mediaUrls: {} };

  const client = createCmsClient(environment);
  const { data, error } = await client.storage.from("portfolio-cms-media").createSignedUrls(
    storageAssets.map(({ source }) => source.key),
    60 * 60 * 24 * 7,
  );
  if (error || !data) {
    throw new Error("Unable to create public URLs for published CMS media.");
  }

  const urls = new Map(
    data.flatMap((entry) =>
      entry.signedUrl && entry.path ? [[entry.path, entry.signedUrl] as const] : [],
    ),
  );
  const mediaUrls: Record<string, string> = {};
  for (const asset of storageAssets) {
    const url = urls.get(asset.source.key);
    if (!url) throw new Error("A published CMS media reference could not be delivered.");
    mediaUrls[asset.id] = url;
  }

  return { snapshot, mediaUrls };
}
