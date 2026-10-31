import { createServerFn } from "@tanstack/react-start";
import { getRequest, setResponseHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { contentSnapshotSchema } from "@/lib/cms/schema";
import {
  loadAdminCmsSnapshot,
  listAdminCmsMedia,
  loadPublishedCmsContent,
  publishAdminCmsDraft,
  restoreAdminCmsRevision,
  saveAdminCmsDraft,
  unpublishAdminCmsSnapshot,
} from "@/lib/cms/server-repository.server";

type RuntimeRequest = Request & {
  runtime?: {
    cloudflare?: {
      env?: Record<string, string | undefined>;
    };
  };
};

function getCmsEnvironment() {
  const request = getRequest() as RuntimeRequest;
  const environment = request.runtime?.cloudflare?.env;
  if (!environment) {
    throw new Error("CMS server bindings are unavailable in this request runtime.");
  }
  setResponseHeader("Cache-Control", "no-store, private");
  setResponseHeader("Pragma", "no-cache");
  return {
    SUPABASE_URL: environment["SUPABASE_URL"],
    SUPABASE_PUBLISHABLE_KEY: environment["SUPABASE_PUBLISHABLE_KEY"],
  };
}

const accessTokenSchema = z.string().min(1, "An authenticated session is required.");
const adminTokenInput = z.object({ accessToken: accessTokenSchema });
const saveDraftInput = z.object({
  accessToken: accessTokenSchema,
  expectedRevisionId: z.string().uuid().nullable(),
  snapshot: contentSnapshotSchema,
});
const restoreRevisionInput = z.object({
  accessToken: accessTokenSchema,
  revisionId: z.string().uuid(),
  expectedRevisionId: z.string().uuid().nullable(),
});
const publishInput = z.object({
  accessToken: accessTokenSchema,
  revisionId: z.string().uuid(),
});

export const loadAdminCmsServerFn = createServerFn({ method: "POST" })
  .validator(adminTokenInput)
  .handler(({ data }) => loadAdminCmsSnapshot(getCmsEnvironment(), data.accessToken));

export const listAdminCmsMediaServerFn = createServerFn({ method: "POST" })
  .validator(adminTokenInput)
  .handler(({ data }) => listAdminCmsMedia(getCmsEnvironment(), data.accessToken));

export const saveAdminCmsDraftServerFn = createServerFn({ method: "POST" })
  .validator(saveDraftInput)
  .handler(({ data }) =>
    saveAdminCmsDraft(
      getCmsEnvironment(),
      data.accessToken,
      data.expectedRevisionId,
      data.snapshot,
    ),
  );

export const restoreAdminCmsRevisionServerFn = createServerFn({ method: "POST" })
  .validator(restoreRevisionInput)
  .handler(({ data }) =>
    restoreAdminCmsRevision(
      getCmsEnvironment(),
      data.accessToken,
      data.revisionId,
      data.expectedRevisionId,
    ),
  );

export const publishAdminCmsDraftServerFn = createServerFn({ method: "POST" })
  .validator(publishInput)
  .handler(({ data }) =>
    publishAdminCmsDraft(getCmsEnvironment(), data.accessToken, data.revisionId),
  );

export const unpublishAdminCmsServerFn = createServerFn({ method: "POST" })
  .validator(adminTokenInput)
  .handler(({ data }) => unpublishAdminCmsSnapshot(getCmsEnvironment(), data.accessToken));

export const getPublishedCmsServerFn = createServerFn({ method: "GET" }).handler(() =>
  loadPublishedCmsContent(getCmsEnvironment()),
);
