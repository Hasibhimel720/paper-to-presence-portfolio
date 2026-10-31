import { useEffect, useState } from "react";
import type { MediaAsset } from "@/lib/cms/schema";

export const CMS_MEDIA_BUCKET = "portfolio-cms-media";
export const CMS_MEDIA_MAX_SIZE_BYTES = 10 * 1024 * 1024;

const allowedTypes = {
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/webp": ["webp"],
  "image/avif": ["avif"],
} as const;

export function validateCmsImageFile(file: File): string | null {
  const extensions = allowedTypes[file.type as keyof typeof allowedTypes];
  if (!extensions) return "Choose a JPEG, PNG, WebP, or AVIF image.";
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (!extension || !extensions.some((allowed) => allowed === extension)) {
    return "The file extension does not match its image format.";
  }
  if (file.size < 1 || file.size > CMS_MEDIA_MAX_SIZE_BYTES) {
    return "Images must be no larger than 10 MB.";
  }
  return null;
}

export function useCmsMediaUrls(assets: MediaAsset[]) {
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;

    async function refreshSignedUrls() {
      const { supabase } = await import("@/lib/supabase");
      const storageAssets = assets.filter(
        (asset): asset is MediaAsset & { source: { kind: "storage"; key: string } } =>
          asset.source.kind === "storage",
      );
      const results = await Promise.all(
        storageAssets.map(async (asset) => {
          const { data, error: signingError } = await supabase.storage
            .from(CMS_MEDIA_BUCKET)
            .createSignedUrl(asset.source.key, 3600);
          if (signingError || !data?.signedUrl) {
            return { id: asset.id, url: "", failed: true };
          }
          return { id: asset.id, url: data.signedUrl, failed: false };
        }),
      );
      if (!active) return;
      setSignedUrls((current) => {
        const next = { ...current };
        results.forEach(({ id, url }) => {
          if (url) next[id] = url;
        });
        return next;
      });
      setError(
        results.some(({ failed }) => failed)
          ? "Some stored images could not be previewed. Check Storage access and retry."
          : "",
      );
      refreshTimer = setTimeout(
        () => {
          void refreshSignedUrls();
        },
        50 * 60 * 1000,
      );
    }

    if (assets.some(({ source }) => source.kind === "storage")) {
      void refreshSignedUrls().catch(() => {
        if (active)
          setError("Stored images could not be previewed. Check Storage access and retry.");
      });
    }

    return () => {
      active = false;
      if (refreshTimer) clearTimeout(refreshTimer);
    };
  }, [assets]);

  const urls: Record<string, string> = {};
  assets.forEach((asset) => {
    if (asset.source.kind === "url") urls[asset.id] = asset.source.url;
    else {
      const signedUrl = signedUrls[asset.id];
      if (signedUrl) urls[asset.id] = signedUrl;
    }
  });
  return { urls, error };
}

export async function uploadCmsMediaFile(
  file: File,
  metadata: { alt: string; caption: string },
): Promise<MediaAsset> {
  const validationError = validateCmsImageFile(file);
  if (validationError) throw new Error(validationError);

  let image: ImageBitmap;
  try {
    image = await createImageBitmap(file);
  } catch {
    throw new Error("The selected file is not a readable image.");
  }

  const id = globalThis.crypto.randomUUID();
  const extension = file.name.split(".").pop()!.toLowerCase();
  const storageKey = `portfolio/${id}/${id}.${extension}`;
  const { supabase } = await import("@/lib/supabase");
  const { error: uploadError } = await supabase.storage
    .from(CMS_MEDIA_BUCKET)
    .upload(storageKey, file, {
      cacheControl: "31536000",
      contentType: file.type,
      upsert: false,
    });
  if (uploadError) {
    image.close();
    throw new Error("Image upload failed. The existing project media was not changed.");
  }

  const media: MediaAsset = {
    id,
    source: { kind: "storage", key: storageKey },
    mimeType: file.type,
    width: image.width,
    height: image.height,
    sizeBytes: file.size,
    alt: metadata.alt,
    caption: metadata.caption,
  };
  image.close();

  const { error: registerError } = await supabase.rpc("portfolio_cms_register_media", {
    p_id: media.id,
    p_storage_key: storageKey,
    p_mime_type: media.mimeType!,
    p_size_bytes: media.sizeBytes!,
    p_width: media.width!,
    p_height: media.height!,
    p_alt: media.alt,
    p_caption: media.caption ?? "",
  });
  if (registerError) {
    const { error: cleanupError } = await supabase.storage
      .from(CMS_MEDIA_BUCKET)
      .remove([storageKey]);
    if (cleanupError) {
      throw new Error(
        "The image uploaded, but media registration and automatic cleanup failed. The file remains unattached; retry cleanup or contact an administrator.",
      );
    }
    throw new Error("Media registration failed. The uploaded file was removed; try again.");
  }

  return media;
}

export async function updateCmsMediaMetadata(
  media: MediaAsset,
  metadata: { alt: string; caption: string },
) {
  if (media.source.kind !== "storage") return;
  const { supabase } = await import("@/lib/supabase");
  const { error } = await supabase.rpc("portfolio_cms_update_media", {
    p_id: media.id,
    p_alt: metadata.alt,
    p_caption: metadata.caption,
  });
  if (error) throw new Error("Unable to save media metadata. The previous details were retained.");
}

export async function deleteCmsMedia(media: MediaAsset) {
  if (media.source.kind !== "storage") {
    throw new Error("External URL media is a reference and cannot be deleted from Storage.");
  }
  const { supabase } = await import("@/lib/supabase");
  const { data: storageKey, error: requestError } = await supabase.rpc(
    "portfolio_cms_begin_media_delete",
    { p_id: media.id },
  );
  if (requestError || typeof storageKey !== "string") {
    throw new Error(
      requestError?.code === "55000"
        ? "This media is retained by a saved revision and cannot be deleted."
        : "Unable to request media deletion. The file remains available.",
    );
  }

  const { error: storageError } = await supabase.storage
    .from(CMS_MEDIA_BUCKET)
    .remove([storageKey]);
  if (storageError) {
    throw new Error(
      "The media is marked for deletion, but Storage cleanup failed. Retry deletion; the saved content is unchanged.",
    );
  }

  const { error: finalizeError } = await supabase.rpc("portfolio_cms_finish_media_delete", {
    p_id: media.id,
  });
  if (finalizeError) {
    throw new Error(
      "The Storage object was removed, but the media record needs cleanup. Retry deletion to finish.",
    );
  }
}
