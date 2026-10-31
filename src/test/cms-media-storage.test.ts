import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CMS_MEDIA_MAX_SIZE_BYTES,
  uploadCmsMediaFile,
  validateCmsImageFile,
} from "@/lib/cms/media-storage";

const mocks = vi.hoisted(() => ({
  upload: vi.fn(),
  remove: vi.fn(),
  storageFrom: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    storage: { from: mocks.storageFrom },
    rpc: mocks.rpc,
  },
}));

function imageFile(name = "cover.webp", type = "image/webp", size = 10) {
  return new File([new Uint8Array(size)], name, { type });
}

describe("CMS image storage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.storageFrom.mockReturnValue({
      upload: mocks.upload,
      remove: mocks.remove,
    });
    mocks.upload.mockResolvedValue({ data: { path: "unused" }, error: null });
    mocks.remove.mockResolvedValue({ data: [], error: null });
    mocks.rpc.mockResolvedValue({ data: {}, error: null });
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn().mockResolvedValue({ width: 1280, height: 720, close: vi.fn() }),
    );
    vi.stubGlobal("crypto", { randomUUID: () => "9c12d6f1-126e-4e31-bd8f-166c2a15cc41" });
  });

  it("accepts only matching image types/extensions and enforces the size limit", () => {
    expect(validateCmsImageFile(imageFile())).toBeNull();
    expect(validateCmsImageFile(imageFile("photo.jpg", "image/jpeg"))).toBeNull();
    expect(validateCmsImageFile(imageFile("image.svg", "image/svg+xml"))).toContain(
      "JPEG, PNG, WebP, or AVIF",
    );
    expect(validateCmsImageFile(imageFile("wrong.png", "image/jpeg"))).toContain(
      "extension does not match",
    );
    expect(
      validateCmsImageFile(imageFile("large.png", "image/png", CMS_MEDIA_MAX_SIZE_BYTES + 1)),
    ).toContain("10 MB");
  });

  it("does not register or replace content when the storage upload fails", async () => {
    mocks.upload.mockResolvedValue({ data: null, error: { message: "Storage denied" } });

    await expect(
      uploadCmsMediaFile(imageFile("cover.webp"), { alt: "Cover", caption: "Cover image" }),
    ).rejects.toThrow("existing project media was not changed");

    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.remove).not.toHaveBeenCalled();
  });

  it("removes an uploaded object if media registration fails", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "42501" } });

    await expect(
      uploadCmsMediaFile(imageFile("cover.webp"), { alt: "Cover", caption: "Cover image" }),
    ).rejects.toThrow("uploaded file was removed");

    expect(mocks.upload).toHaveBeenCalledOnce();
    expect(mocks.remove).toHaveBeenCalledOnce();
  });

  it("registers successful uploads under immutable generated storage keys", async () => {
    const media = await uploadCmsMediaFile(imageFile("original file.webp"), {
      alt: "Project cover",
      caption: "Project image",
    });

    expect(mocks.upload).toHaveBeenCalledWith(
      "portfolio/9c12d6f1-126e-4e31-bd8f-166c2a15cc41/9c12d6f1-126e-4e31-bd8f-166c2a15cc41.webp",
      expect.any(File),
      expect.objectContaining({ upsert: false, contentType: "image/webp" }),
    );
    expect(mocks.rpc).toHaveBeenCalledWith(
      "portfolio_cms_register_media",
      expect.objectContaining({
        p_mime_type: "image/webp",
        p_width: 1280,
        p_height: 720,
      }),
    );
    expect(media.source.kind).toBe("storage");
    if (media.source.kind !== "storage") throw new Error("Expected storage-backed media.");
    expect(media.source.key).toContain("/9c12d6f1-126e-4e31-bd8f-166c2a15cc41.webp");
  });
});
