import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { AppearanceWorkspace } from "@/components/admin/AppearanceWorkspace";
import { createDemoContent } from "@/lib/cms/demo-content";
import type { ContentSnapshot } from "@/lib/cms/schema";

function AppearanceHarness({
  initial,
  onApply,
  onPreview,
}: {
  initial: ContentSnapshot;
  onApply: (candidate: ContentSnapshot) => void;
  onPreview: (candidate: ContentSnapshot) => void;
}) {
  const [snapshot, setSnapshot] = useState(initial);
  return (
    <AppearanceWorkspace
      snapshot={snapshot}
      onApply={(candidate) => {
        onApply(candidate);
        setSnapshot(candidate);
      }}
      onPreview={onPreview}
    />
  );
}

describe("appearance workspace", () => {
  it("keeps Light and Dark settings independent and applies only to the dashboard draft", async () => {
    const snapshot = await createDemoContent();
    const onApply = vi.fn<(candidate: ContentSnapshot) => void>();
    const onPreview = vi.fn<(candidate: ContentSnapshot) => void>();

    render(<AppearanceHarness initial={snapshot} onApply={onApply} onPreview={onPreview} />);

    fireEvent.change(screen.getByLabelText("Page background HEX value"), {
      target: { value: "#f5f2ee" },
    });
    fireEvent.click(screen.getByRole("tab", { name: "dark Mode" }));
    fireEvent.change(screen.getByLabelText("Page background HEX value"), {
      target: { value: "#111318" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply to dashboard draft" }));

    const appliedSnapshot = onApply.mock.lastCall?.[0];
    expect(appliedSnapshot?.theme.appearance?.modes.light.colors.background).toBe("#f5f2ee");
    expect(appliedSnapshot?.theme.appearance?.modes.dark.colors.background).toBe("#111318");
    expect(screen.getByText(/Save Draft to persist them/)).toBeInTheDocument();
    expect(onPreview).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Preview actual website" }));
    expect(onPreview).toHaveBeenCalledOnce();
    expect(onPreview.mock.lastCall?.[0].theme.appearance?.modes.light.colors.background).toBe(
      "#f5f2ee",
    );
    expect(onPreview.mock.lastCall?.[0].theme.appearance?.modes.dark.colors.background).toBe(
      "#111318",
    );
  });
});
