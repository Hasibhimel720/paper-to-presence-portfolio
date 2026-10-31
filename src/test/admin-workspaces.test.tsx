import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminShell } from "@/components/admin/AdminShell";
import { createDemoContent } from "@/lib/cms/demo-content";
import { contentSnapshotSchema } from "@/lib/cms/schema";

afterEach(() => {
  vi.restoreAllMocks();
});

async function openDashboardWorkspace(name: string) {
  render(<AdminShell onSignOut={vi.fn()} signingOut={false} />);
  await screen.findByRole("heading", { name: "Good to see you" });
  fireEvent.click(screen.getAllByRole("button", { name })[0]!);
}

function contentEntry(title: string) {
  const entry = screen.getAllByRole("listitem").find((item) => item.textContent?.includes(title));
  if (!entry) throw new Error(`Expected content entry "${title}".`);
  return entry;
}

describe("admin content workspaces", () => {
  it("creates, edits, orders, hides, validates, and removes service entries", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    await openDashboardWorkspace("Services");
    expect(await screen.findByRole("heading", { name: "Services" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Add service" }));
    fireEvent.change(screen.getByLabelText("Number or label"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Service title"), { target: { value: "Demo service" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply changes" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/n/i);
    fireEvent.change(screen.getByLabelText("Number or label"), { target: { value: "99" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply changes" }));
    expect(await screen.findByRole("heading", { name: "Demo service" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/applied to the dashboard session/i);

    fireEvent.click(screen.getByRole("button", { name: "Hide Demo service" }));
    expect(screen.getByText("Hidden")).toBeInTheDocument();
    fireEvent.click(within(contentEntry("Demo service")).getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "Updated details" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply changes" }));
    expect(await screen.findByText("Updated details")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Remove Demo service" }));
    expect(window.confirm).toHaveBeenCalled();
    expect(screen.queryByRole("heading", { name: "Demo service" })).not.toBeInTheDocument();
  });

  it("supports experience, process outcomes, and FAQ create/edit/order/visibility controls", async () => {
    await openDashboardWorkspace("Experience");
    fireEvent.click(screen.getByRole("button", { name: "Add experience" }));
    fireEvent.change(screen.getByLabelText("Company"), { target: { value: "Demo Studio" } });
    fireEvent.change(screen.getByLabelText("Dates"), { target: { value: "2025–2026" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply changes" }));
    expect(await screen.findByRole("heading", { name: "Demo Studio" })).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "Process" })[0]!);
    expect(await screen.findByRole("heading", { name: "Process" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add step" }));
    fireEvent.change(screen.getByLabelText("Step title"), { target: { value: "Demo step" } });
    fireEvent.change(screen.getByLabelText("Outcomes"), {
      target: { value: "Clear outcome\nFinal handoff" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply changes" }));
    expect(await screen.findByRole("heading", { name: "Demo step" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Move Demo step up" }));
    expect(screen.getByRole("status")).toHaveTextContent(/order updated/i);
    fireEvent.click(screen.getByRole("button", { name: "Hide Demo step" }));
    expect(screen.getByText("Hidden")).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "FAQs" })[0]!);
    fireEvent.click(screen.getByRole("button", { name: "Add FAQ" }));
    fireEvent.change(screen.getByLabelText("Question"), { target: { value: "Demo question?" } });
    fireEvent.change(screen.getByLabelText("Answer"), { target: { value: "Demo answer." } });
    fireEvent.click(screen.getByRole("button", { name: "Apply changes" }));
    expect(await screen.findByRole("heading", { name: "Demo question?" })).toBeInTheDocument();
    fireEvent.click(within(contentEntry("Demo question?")).getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Answer"), { target: { value: "Edited answer." } });
    fireEvent.click(screen.getByRole("button", { name: "Apply changes" }));
    expect(await screen.findByText("Edited answer.")).toBeInTheDocument();
  });

  it("reassigns projects safely when removing a category", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    await openDashboardWorkspace("Categories");
    const snapshot = await createDemoContent();
    const categoryInUse = snapshot.categories.find((category) =>
      snapshot.projects.some((project) => project.categoryId === category.id),
    );
    if (!categoryInUse) throw new Error("Expected a category assigned to a project.");
    const categoryCard = screen
      .getAllByText(categoryInUse.name)
      .map((element) => element.closest("li"))
      .find((element): element is HTMLLIElement => element instanceof HTMLLIElement);
    if (!categoryCard) throw new Error("Expected category card.");
    fireEvent.click(
      within(categoryCard).getByRole("button", { name: `Remove ${categoryInUse.name}` }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(/replacement category/i);
    fireEvent.change(within(categoryCard).getByLabelText(`Replacement for ${categoryInUse.name}`), {
      target: { value: snapshot.categories.find(({ id }) => id !== categoryInUse.id)?.id },
    });
    fireEvent.click(
      within(categoryCard).getByRole("button", { name: `Remove ${categoryInUse.name}` }),
    );
    expect(window.confirm).toHaveBeenCalled();
    expect(
      screen
        .getAllByRole("listitem")
        .some((item) => item.textContent?.includes(categoryInUse.name)),
    ).toBe(false);
    expect(screen.getByRole("status")).toHaveTextContent(/relationships updated/i);
  });

  it("assigns existing media references and reports an intentional empty library", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    await openDashboardWorkspace("Media library");
    expect(await screen.findByRole("heading", { name: "Media library" })).toBeInTheDocument();
    const snapshot = await createDemoContent();
    if (snapshot.media.length === 0) {
      expect(screen.getByText(/No media records are available/)).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /upload/i })).not.toBeInTheDocument();
      return;
    }

    const asset = snapshot.media[0]!;
    fireEvent.change(screen.getByLabelText("Profile portrait media"), {
      target: { value: asset.id },
    });
    expect(await screen.findByRole("status")).toHaveTextContent(/Profile media reference updated/);
    expect(screen.getByLabelText("Profile portrait media")).toHaveValue(asset.id);
    expect(screen.getByText(new RegExp(asset.caption ?? asset.alt))).toBeInTheDocument();

    const firstEditButton = screen.getAllByRole("button", { name: "Edit metadata" })[0]!;
    const mediaCard = firstEditButton.closest("article");
    if (!mediaCard) throw new Error("Expected a media card.");
    fireEvent.click(firstEditButton);
    fireEvent.change(screen.getByLabelText("Media alt text"), {
      target: { value: "Updated demo alt text" },
    });
    fireEvent.change(screen.getByLabelText("Media caption"), {
      target: { value: "Updated demo caption" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save metadata" }));
    expect(await screen.findByRole("status")).toHaveTextContent(/Media metadata updated/);
    expect(
      within(mediaCard).getByRole("heading", { name: "Updated demo caption" }),
    ).toBeInTheDocument();

    const removeButton = within(mediaCard).getByRole("button", { name: /Remove/ });
    if (removeButton.hasAttribute("disabled")) {
      expect(removeButton).toHaveAttribute("title", "Remove all references before deleting");
    } else {
      fireEvent.click(removeButton);
      expect(window.confirm).toHaveBeenCalled();
      expect(mediaCard).not.toBeInTheDocument();
    }
  });

  it("edits and validates theme, global SEO, and page-specific SEO", async () => {
    await openDashboardWorkspace("Design & SEO");
    expect(await screen.findByRole("heading", { name: "Design & SEO" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Website title"), {
      target: { value: "Local preview SEO title" },
    });
    fireEvent.change(screen.getByLabelText("Color: primary"), { target: { value: "not-a-color" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply changes" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Color: primary"), { target: { value: "#4b6fff" } });
    fireEvent.click(screen.getAllByLabelText("Allow indexing")[0]!);
    fireEvent.change(screen.getByLabelText("Page title"), {
      target: { value: "Page-specific preview title" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply changes" }));
    expect(await screen.findByRole("status")).toHaveTextContent(/Design and SEO changes applied/);
    expect(screen.getByLabelText("Website title")).toHaveValue("Local preview SEO title");
    expect(screen.getByLabelText("Color: primary")).toHaveValue("#4b6fff");
  });

  it("saves site settings and navigation changes, and retains them across navigation", async () => {
    await openDashboardWorkspace("Site settings");
    expect(await screen.findByRole("heading", { name: "Site settings" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Public name"), {
      target: { value: "Demo identity" },
    });
    fireEvent.change(screen.getByLabelText("Additional details label"), {
      target: { value: "Project context" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add tool" }));
    fireEvent.change(screen.getAllByLabelText("Tool name").at(-1)!, {
      target: { value: "Demo tool" },
    });
    fireEvent.change(screen.getAllByLabelText("Tool use").at(-1)!, {
      target: { value: "Prototype workflows" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add statistic" }));
    fireEvent.change(screen.getAllByLabelText("Statistic value").at(-1)!, {
      target: { value: "12+" },
    });
    fireEvent.change(screen.getAllByLabelText("Statistic label").at(-1)!, {
      target: { value: "Years of practice" },
    });
    fireEvent.click(screen.getAllByRole("button", { name: "Add link" })[0]!);
    fireEvent.click(screen.getByRole("button", { name: "Apply changes" }));
    expect(await screen.findByRole("status")).toHaveTextContent(/Site settings applied/);

    fireEvent.click(screen.getAllByRole("button", { name: "Projects" })[0]!);
    fireEvent.click(screen.getAllByRole("button", { name: "Site settings" })[0]!);
    expect(screen.getByLabelText("Public name")).toHaveValue("Demo identity");
    expect(screen.getByLabelText("Additional details label")).toHaveValue("Project context");
    expect(screen.getAllByLabelText("Tool name").at(-1)).toHaveValue("Demo tool");
    expect(screen.getAllByLabelText("Statistic label").at(-1)).toHaveValue("Years of practice");
    expect(
      screen
        .getAllByLabelText("Label")
        .some((input) => (input as HTMLInputElement).value === "New link"),
    ).toBe(true);
  });

  it("discards unsaved site-setting edits and validates social-link controls", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const baseline = await createDemoContent();
    await openDashboardWorkspace("Site settings");
    expect(await screen.findByRole("heading", { name: "Site settings" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Public name"), {
      target: { value: "Discard this identity" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByLabelText("Public name")).toHaveValue(baseline.identity.name);

    fireEvent.click(screen.getByRole("button", { name: "Add social link" }));
    const newLink = screen.getAllByLabelText(/social-.*URL/).at(-1)!;
    fireEvent.change(newLink, { target: { value: "invalid-url" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply changes" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    fireEvent.change(newLink, { target: { value: "https://example.com/demo" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply changes" }));
    expect(await screen.findByRole("status")).toHaveTextContent(/Site settings applied/);
    fireEvent.click(screen.getByRole("button", { name: /Remove social-.* social link/ }));
    expect(window.confirm).toHaveBeenCalled();
    expect(screen.queryByLabelText(/social-.*URL/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Apply changes" }));
    expect(await screen.findByRole("status")).toHaveTextContent(/Site settings applied/);
  });

  it("edits and saves ordered project case-study details", async () => {
    const baseline = await createDemoContent();
    const firstProject = baseline.projects[0];
    if (!firstProject) throw new Error("Expected a demo project.");
    await openDashboardWorkspace("Projects");
    expect(await screen.findByRole("heading", { name: "Projects" })).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("heading", { name: firstProject.title })[0]!);
    fireEvent.click(await screen.findByRole("button", { name: "Add detail" }));
    fireEvent.change(screen.getByLabelText("Case-study detail 1 title"), {
      target: { value: "Context and challenge" },
    });
    fireEvent.change(screen.getByLabelText("Case-study detail 1 narrative"), {
      target: { value: "A saved local case-study narrative." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply changes" }));
    expect(await screen.findByRole("status")).toHaveTextContent(/Project changes applied/);

    fireEvent.click(screen.getAllByRole("heading", { name: firstProject.title })[0]!);
    expect(await screen.findByLabelText("Case-study detail 1 title")).toHaveValue(
      "Context and challenge",
    );
    expect(screen.getByLabelText("Case-study detail 1 narrative")).toHaveValue(
      "A saved local case-study narrative.",
    );
  });

  it("does not claim testimonials or project SEO are supported by this schema", async () => {
    const snapshot = await createDemoContent();
    expect(contentSnapshotSchema.safeParse(snapshot).success).toBe(true);
    expect(snapshot).not.toHaveProperty("testimonials");
    expect(snapshot.projects[0]).not.toHaveProperty("seo");
  });
});
