import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MediaWorkspace } from "@/components/admin/ContentWorkspaces";
import { ProjectsWorkspace } from "@/components/admin/ProjectsWorkspace";
import { createDemoContent } from "@/lib/cms/demo-content";
import type { ContentSnapshot } from "@/lib/cms/schema";

const mocks = vi.hoisted(() => ({
  upload: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  validate: vi.fn(() => null),
}));

vi.mock("@/lib/cms/media-storage", () => ({
  deleteCmsMedia: mocks.remove,
  updateCmsMediaMetadata: mocks.update,
  uploadCmsMediaFile: mocks.upload,
  useCmsMediaUrls: () => ({ urls: {}, error: "" }),
  validateCmsImageFile: mocks.validate,
}));

const uploadedMedia = {
  id: "9c12d6f1-126e-4e31-bd8f-166c2a15cc41",
  source: {
    kind: "storage" as const,
    key: "portfolio/9c12d6f1-126e-4e31-bd8f-166c2a15cc41/9c12d6f1-126e-4e31-bd8f-166c2a15cc41.webp",
  },
  mimeType: "image/webp",
  width: 1280,
  height: 720,
  sizeBytes: 1200,
  alt: "Uploaded cover",
  caption: "New cover",
};

const createObjectUrlDescriptor = Object.getOwnPropertyDescriptor(URL, "createObjectURL");
const revokeObjectUrlDescriptor = Object.getOwnPropertyDescriptor(URL, "revokeObjectURL");

function ProjectsHarness({ initial }: { initial: ContentSnapshot }) {
  const [snapshot, setSnapshot] = useState(initial);
  return <ProjectsWorkspace snapshot={snapshot} onChange={setSnapshot} cmsEnabled />;
}

describe("CMS media library interactions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.validate.mockReturnValue(null);
    mocks.upload.mockResolvedValue(uploadedMedia);
    mocks.update.mockResolvedValue(undefined);
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:media-preview"),
    });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
  });

  afterEach(() => {
    if (createObjectUrlDescriptor) {
      Object.defineProperty(URL, "createObjectURL", createObjectUrlDescriptor);
    } else {
      Reflect.deleteProperty(URL, "createObjectURL");
    }
    if (revokeObjectUrlDescriptor) {
      Object.defineProperty(URL, "revokeObjectURL", revokeObjectUrlDescriptor);
    } else {
      Reflect.deleteProperty(URL, "revokeObjectURL");
    }
    vi.unstubAllGlobals();
  });

  it("previews and uploads a selected file before adding its media reference", async () => {
    const snapshot = await createDemoContent();
    const onChange = vi.fn();
    render(<MediaWorkspace snapshot={snapshot} onChange={onChange} cmsEnabled />);

    fireEvent.change(screen.getByLabelText("Image file"), {
      target: { files: [new File(["image"], "cover.webp", { type: "image/webp" })] },
    });
    expect(await screen.findByRole("img", { name: "Selected image preview" })).toHaveAttribute(
      "src",
      "blob:media-preview",
    );

    fireEvent.change(screen.getByLabelText("Alt text"), {
      target: { value: "Uploaded cover" },
    });
    fireEvent.change(screen.getByLabelText("Caption"), {
      target: { value: "New cover" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Upload to media library" }));

    await waitFor(() => expect(onChange).toHaveBeenCalledOnce());
    const updatedSnapshot = onChange.mock.calls[0]?.[0] as ContentSnapshot;
    expect(updatedSnapshot.media[0]).toEqual(uploadedMedia);
    expect(mocks.upload).toHaveBeenCalledWith(expect.any(File), {
      alt: "Uploaded cover",
      caption: "New cover",
    });
    expect(screen.getByRole("status")).toHaveTextContent(/Save a draft/);
  });

  it("keeps uploads unavailable in demo mode and explains the limitation", async () => {
    const snapshot = await createDemoContent();
    render(<MediaWorkspace snapshot={snapshot} onChange={vi.fn()} />);

    expect(
      screen.queryByRole("button", { name: /upload to media library/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/Demo mode does not upload files/)).toBeInTheDocument();
  });

  it("uploads a project cover image and adds the reference to the shared snapshot", async () => {
    const snapshot = await createDemoContent();
    render(<ProjectsHarness initial={snapshot} />);

    fireEvent.click(screen.getAllByRole("article")[0]!.querySelector("button")!);
    fireEvent.change(screen.getByLabelText("Upload project image"), {
      target: { files: [new File(["image"], "project-cover.webp", { type: "image/webp" })] },
    });

    expect(
      await screen.findByRole("img", { name: "Selected project image preview" }),
    ).toHaveAttribute("src", "blob:media-preview");
    fireEvent.change(screen.getByLabelText("Project image alt text"), {
      target: { value: "Product launch cover" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Upload and use as cover" }));

    await waitFor(() =>
      expect(
        screen.getByText(
          /Image uploaded to the media library and selected as this project's cover/,
        ),
      ).toBeInTheDocument(),
    );
    expect(mocks.upload).toHaveBeenCalledWith(expect.any(File), {
      alt: "Product launch cover",
      caption: snapshot.projects[0]?.title,
    });
    expect(screen.getByLabelText("Cover image from existing media")).toHaveValue(uploadedMedia.id);

    fireEvent.click(screen.getByRole("button", { name: "Apply changes" }));
    expect(screen.queryByRole("region", { name: "Edit project" })).not.toBeInTheDocument();
    expect(
      screen.getByText("Project changes applied to the dashboard session."),
    ).toBeInTheDocument();
  });

  it("explains when project image uploads are unavailable in demo mode", async () => {
    const snapshot = await createDemoContent();
    render(<ProjectsWorkspace snapshot={snapshot} onChange={vi.fn()} />);

    fireEvent.click(screen.getAllByRole("article")[0]!.querySelector("button")!);

    expect(screen.getByLabelText("Upload project image")).toBeDisabled();
    expect(screen.getByText(/Project image uploads require the connected CMS/)).toBeInTheDocument();
  });
});
