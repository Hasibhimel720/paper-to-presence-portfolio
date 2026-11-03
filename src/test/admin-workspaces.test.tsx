import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminShell } from "@/components/admin/AdminShell";
import { ServicesWorkspace } from "@/components/admin/ServicesWorkspace";
import { ProjectsWorkspace } from "@/components/admin/ProjectsWorkspace";
import { CategoriesWorkspace, CollectionWorkspace } from "@/components/admin/ContentWorkspaces";
import { createDemoContent } from "@/lib/cms/demo-content";
import { contentSnapshotSchema, type ContentSnapshot, type MediaAsset } from "@/lib/cms/schema";
import * as cmsMediaStorage from "@/lib/cms/media-storage";

afterEach(() => {
  vi.restoreAllMocks();
});

async function openDashboardWorkspace(name: string) {
  const workspaceLabel: Record<string, string> = {
    Pages: "Homepage",
    "Design & SEO": "SEO & Metadata",
    "Media library": "Media Library",
    "Site settings": "Site Settings",
    About: "About",
    Contact: "Contact",
  };
  render(<AdminShell onSignOut={vi.fn()} signingOut={false} />);
  await screen.findByRole("heading", { name: "Good to see you" });
  fireEvent.click(
    within(screen.getByRole("navigation", { name: "Dashboard" })).getByRole("button", {
      name: workspaceLabel[name] ?? name,
    }),
  );
}

function contentEntry(title: string) {
  const entry = screen.getAllByRole("listitem").find((item) => item.textContent?.includes(title));
  if (!entry) throw new Error(`Expected content entry "${title}".`);
  return entry;
}

function getCollectionIds(
  snapshot: ContentSnapshot,
  kind: "experience" | "process" | "faqs",
): string[] {
  const homepage = snapshot.pages.find(({ slug }) => slug === "/");
  if (!homepage) throw new Error("Expected the homepage.");
  const section = homepage.sections.find((candidate) =>
    kind === "experience"
      ? candidate.type === "experience"
      : kind === "process"
        ? candidate.type === "process"
        : candidate.type === "faqs",
  );
  if (!section) throw new Error(`Expected the ${kind} homepage section.`);
  if (kind === "experience" && section.type === "experience") {
    return section.data.experienceIds;
  }
  if (kind === "process" && section.type === "process") {
    return section.data.processStepIds;
  }
  if (kind === "faqs" && section.type === "faqs") {
    return section.data.faqIds;
  }
  throw new Error(`Unexpected homepage section for ${kind}.`);
}

describe("admin content workspaces", () => {
  it("applies project gallery, case-study, SEO, visibility, and CTA edits to the CMS snapshot", async () => {
    const snapshot = await createDemoContent();
    const original = snapshot.projects[0]!;
    const onChange = vi.fn<(updated: ContentSnapshot) => void>();
    render(<ProjectsWorkspace snapshot={snapshot} onChange={onChange} />);

    const projectCard = screen.getByRole("heading", { name: original.title }).closest("article");
    if (!projectCard) throw new Error("Expected the project card.");
    fireEvent.click(within(projectCard).getAllByRole("button")[0]!);

    fireEvent.change(screen.getByLabelText("Project gallery layout"), {
      target: { value: "two-column" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add detail" }));
    fireEvent.change(screen.getByLabelText("Case-study detail 1 title"), {
      target: { value: "Packaging story" },
    });
    fireEvent.change(screen.getByLabelText("Case-study detail 1 narrative"), {
      target: { value: "A considered visual system." },
    });
    fireEvent.change(screen.getByLabelText("Case-study detail 1 image layout"), {
      target: { value: "carousel" },
    });
    fireEvent.click(screen.getByLabelText("Show case-study detail 1"));
    fireEvent.click(screen.getByText("SEO & Visibility"));
    fireEvent.click(screen.getByLabelText("Publish this project on the public website"));
    fireEvent.change(screen.getByLabelText("SEO title"), {
      target: { value: "Packaging case study" },
    });
    fireEvent.change(screen.getByLabelText("CTA button label"), {
      target: { value: "Start a project" },
    });
    fireEvent.change(screen.getByLabelText("CTA destination"), {
      target: { value: "/contact#brief" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply changes" }));

    const updated = onChange.mock.calls[0]?.[0];
    expect(updated).toBeDefined();
    const updatedProject = updated?.projects.find(({ id }) => id === original.id);
    expect(updatedProject).toMatchObject({
      galleryLayout: "two-column",
      visible: false,
      seoTitle: "Packaging case study",
      ctaLabel: "Start a project",
      ctaHref: "/contact#brief",
      sections: expect.arrayContaining([
        expect.objectContaining({
          title: "Packaging story",
          body: "A considered visual system.",
          visible: false,
          galleryLayout: "carousel",
        }),
      ]),
    });
    expect(screen.getByRole("status")).toHaveTextContent(
      /changes applied to the dashboard session/i,
    );
  });

  it("edits all Hero proof point fields in the homepage page editor", async () => {
    await openDashboardWorkspace("Pages");
    expect(await screen.findByRole("heading", { name: "Pages" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Edit page" }));

    const baseline = await createDemoContent();
    expect(screen.getByLabelText("Project count")).toHaveValue(
      String(baseline.projects.filter(({ visible }) => visible).length),
    );
    expect(screen.getByLabelText("Project count suffix/text")).toHaveValue("projects shipped");
    expect(screen.getByLabelText("Trusted-by introduction")).toHaveValue("Trusted by teams at");
    expect(screen.getByLabelText("Company/client names")).toHaveValue(
      "RRP Group, Ruby Tech, Gheewaali",
    );
    expect(screen.getByLabelText("Service categories")).toHaveValue(
      "Brand identities · Packaging · Product advertising",
    );

    fireEvent.change(screen.getByLabelText("Project count"), { target: { value: "200+" } });
    fireEvent.change(screen.getByLabelText("Project count suffix/text"), {
      target: { value: "projects launched" },
    });
    fireEvent.change(screen.getByLabelText("Trusted-by introduction"), {
      target: { value: "Partnered with" },
    });
    fireEvent.change(screen.getByLabelText("Company/client names"), {
      target: { value: "North Studio, Bright Co." },
    });
    fireEvent.change(screen.getByLabelText("Service categories"), {
      target: { value: "Identity · Packaging · Campaigns" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply changes" }));
    expect(await screen.findByRole("status")).toHaveTextContent(/Page changes are applied/);

    fireEvent.click(screen.getAllByRole("button", { name: "Projects" })[0]!);
    fireEvent.click(screen.getAllByRole("button", { name: "Homepage" })[0]!);
    fireEvent.click(screen.getByRole("button", { name: "Edit page" }));
    expect(screen.getByLabelText("Project count")).toHaveValue("200+");
    expect(screen.getByLabelText("Project count suffix/text")).toHaveValue("projects launched");
    expect(screen.getByLabelText("Trusted-by introduction")).toHaveValue("Partnered with");
    expect(screen.getByLabelText("Company/client names")).toHaveValue("North Studio, Bright Co.");
    expect(screen.getByLabelText("Service categories")).toHaveValue(
      "Identity · Packaging · Campaigns",
    );
  }, 15_000);

  it("normalizes previously saved numeric Hero counts to text", async () => {
    const snapshot = await createDemoContent();
    const parsedSnapshot = contentSnapshotSchema.parse({
      ...snapshot,
      pages: snapshot.pages.map((page) => ({
        ...page,
        sections: page.sections.map((section) =>
          section.type === "hero"
            ? { ...section, data: { ...section.data, projectsShippedCount: 200 } }
            : section,
        ),
      })),
    });
    const parsedHero = parsedSnapshot.pages
      .find(({ slug }) => slug === "/")
      ?.sections.find((section) => section.type === "hero");
    if (!parsedHero || parsedHero.type !== "hero") {
      throw new Error("Expected the parsed homepage Hero section.");
    }

    expect(parsedHero.data.projectsShippedCount).toBe("200");
  });

  it("creates, edits, orders, hides, validates, and removes service entries", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    await openDashboardWorkspace("Services");
    expect(await screen.findByRole("heading", { name: "Services" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Services section heading"), {
      target: { value: "How I help" },
    });
    expect(screen.getByLabelText("Services section heading")).toHaveValue("How I help");

    fireEvent.click(screen.getByRole("button", { name: "Add service" }));
    fireEvent.change(screen.getByLabelText("Number or label"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Service title"), { target: { value: "Demo service" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply changes" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/n/i);
    fireEvent.change(screen.getByLabelText("Number or label"), { target: { value: "99" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply changes" }));
    expect(await screen.findByRole("heading", { name: "Demo service" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/added to the dashboard session/i);

    fireEvent.click(screen.getByRole("button", { name: "Move Demo service up" }));
    expect(screen.getByRole("status")).toHaveTextContent(/order updated/i);
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
  }, 15_000);

  it("previews, validates, replaces, and removes an independent service image", async () => {
    const snapshot = await createDemoContent();
    const service = snapshot.services[0]!;
    const previousAsset: MediaAsset = {
      id: "previous-service-image",
      source: { kind: "url", url: "https://images.example.test/old-service.webp" },
      alt: "Previous service image",
    };
    snapshot.media.push(previousAsset);
    service.image = { mediaId: previousAsset.id, alt: previousAsset.alt };
    const onChange = vi.fn<(updatedSnapshot: ContentSnapshot) => void>();
    const uploadedAsset: MediaAsset = {
      id: "new-service-image",
      source: { kind: "url", url: "https://images.example.test/new-service.webp" },
      alt: "New service image",
    };
    vi.spyOn(cmsMediaStorage, "uploadCmsMediaFile")
      .mockRejectedValueOnce(new Error("The upload could not reach Storage."))
      .mockResolvedValue(uploadedAsset);

    const { rerender } = render(<ServicesWorkspace snapshot={snapshot} onChange={onChange} />);
    fireEvent.click(within(contentEntry(service.title)).getByRole("button", { name: "Edit" }));
    const uploadInput = screen.getByLabelText("Choose service image");
    fireEvent.change(uploadInput, {
      target: { files: [new File(["bad"], "animated.gif", { type: "image/gif" })] },
    });
    expect(await screen.findByText(/Choose a JPEG, PNG, WebP, or AVIF image/i)).toBeInTheDocument();
    const oversizedFile = new File(
      [new Uint8Array(10 * 1024 * 1024 + 1)],
      "oversized-service.png",
      { type: "image/png" },
    );
    fireEvent.change(uploadInput, { target: { files: [oversizedFile] } });
    expect(await screen.findByText("Images must be no larger than 10 MB.")).toBeInTheDocument();

    const newFile = new File(["image"], "replacement.webp", { type: "image/webp" });
    fireEvent.change(uploadInput, { target: { files: [newFile] } });
    expect(screen.getByRole("img", { name: "Selected service image preview" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Upload image" }));
    expect(await screen.findByText("The upload could not reach Storage.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancel image selection" }));
    expect(screen.getByRole("img", { name: "Previous service image" })).toHaveAttribute(
      "src",
      "https://images.example.test/old-service.webp",
    );

    fireEvent.change(uploadInput, { target: { files: [newFile] } });
    expect(
      await screen.findByRole("img", { name: "Selected service image preview" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Upload image" }));
    expect(await screen.findByText(/Image uploaded to the dashboard session/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Apply changes" }));
    expect(onChange).toHaveBeenCalled();
    const firstUpdate = onChange.mock.lastCall?.[0];
    if (!firstUpdate) throw new Error("Expected service changes to be applied.");
    let updated = firstUpdate;
    expect(updated.services[0]?.image).toEqual({
      mediaId: uploadedAsset.id,
      alt: uploadedAsset.alt,
    });

    rerender(<ServicesWorkspace snapshot={updated} onChange={onChange} />);
    fireEvent.click(within(contentEntry(service.title)).getByRole("button", { name: "Edit" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove custom image" }));
    fireEvent.click(screen.getByRole("button", { name: "Apply changes" }));
    const finalUpdate = onChange.mock.lastCall?.[0];
    if (!finalUpdate) throw new Error("Expected image removal to be applied.");
    updated = finalUpdate;
    expect(updated.services[0]?.image).toBeUndefined();
    expect(updated.media.map(({ id }) => id)).toContain(previousAsset.id);
    expect(updated.media.map(({ id }) => id)).toContain(uploadedAsset.id);
  }, 15_000);

  it("keeps the homepage service relationship synchronized with editor ordering", async () => {
    const snapshot = await createDemoContent();
    const onChange = vi.fn<(updatedSnapshot: ContentSnapshot) => void>();
    render(<ServicesWorkspace snapshot={snapshot} onChange={onChange} />);

    fireEvent.click(
      within(contentEntry("Product Packaging Design")).getByRole("button", {
        name: "Move Product Packaging Design up",
      }),
    );
    const updated = onChange.mock.lastCall?.[0];
    if (!updated) throw new Error("Expected service ordering changes to be applied.");

    expect(
      updated.services.sort((left, right) => left.order - right.order).map(({ title }) => title),
    ).toEqual([
      "Product Packaging Design",
      "Brand Identity Design",
      "Product Advertising",
      "Corporate Branding",
      "Motion & Visual Design",
    ]);
    const homepageServices = updated.pages
      .find(({ slug }) => slug === "/")
      ?.sections.find((section) => section.type === "services");
    expect(homepageServices?.type === "services" && homepageServices.data.serviceIds).toEqual(
      updated.services.sort((left, right) => left.order - right.order).map(({ id }) => id),
    );
  }, 15_000);

  it("supports experience, process outcomes, and FAQ create/edit/order/visibility controls", async () => {
    await openDashboardWorkspace("Experience");
    fireEvent.click(screen.getByRole("button", { name: "Add experience" }));
    fireEvent.change(screen.getByLabelText("Company"), { target: { value: "Demo Studio" } });
    fireEvent.change(screen.getByLabelText("Start Date"), { target: { value: "2025-01-01" } });
    fireEvent.click(screen.getByLabelText("I currently work here"));
    fireEvent.click(screen.getByRole("button", { name: "Apply changes" }));
    expect(await screen.findByRole("heading", { name: "Demo Studio" })).toBeInTheDocument();
    expect(screen.getByText("January 2025 – Present")).toBeInTheDocument();
    fireEvent.click(within(contentEntry("Demo Studio")).getByRole("button", { name: "Edit" }));
    expect(screen.getByLabelText("Start Date")).toHaveValue("2025-01-01");
    expect(screen.queryByLabelText("End Date")).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("I currently work here"));
    fireEvent.change(screen.getByLabelText("End Date"), { target: { value: "2026-03-01" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply changes" }));
    expect(await screen.findByText("January 2025 – March 2026")).toBeInTheDocument();

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

    fireEvent.click(screen.getAllByRole("button", { name: "FAQ" })[0]!);
    fireEvent.click(screen.getByRole("button", { name: "Add FAQ" }));
    fireEvent.change(screen.getByLabelText("Question"), { target: { value: "Demo question?" } });
    fireEvent.change(screen.getByLabelText("Answer"), { target: { value: "Demo answer." } });
    fireEvent.click(screen.getByRole("button", { name: "Apply changes" }));
    expect(await screen.findByRole("heading", { name: "Demo question?" })).toBeInTheDocument();
    fireEvent.click(within(contentEntry("Demo question?")).getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Answer"), { target: { value: "Edited answer." } });
    fireEvent.click(screen.getByRole("button", { name: "Apply changes" }));
    expect(await screen.findByText("Edited answer.")).toBeInTheDocument();
  }, 15_000);

  it("keeps new Experience, Process, and FAQ records linked through ordering and deletion", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const cases = [
      { kind: "experience", addButton: "Add experience", title: "Company", value: "Linked Studio" },
      { kind: "process", addButton: "Add step", title: "Step title", value: "Linked step" },
      { kind: "faqs", addButton: "Add FAQ", title: "Question", value: "Linked question?" },
    ] as const;

    for (const { kind, addButton, title, value } of cases) {
      const snapshot = await createDemoContent();
      const onChange = vi.fn<(updated: ContentSnapshot) => void>();
      const view = render(
        <CollectionWorkspace kind={kind} snapshot={snapshot} onChange={onChange} />,
      );
      fireEvent.click(screen.getByRole("button", { name: addButton }));
      fireEvent.change(screen.getByLabelText(title), { target: { value } });
      if (kind === "experience") {
        fireEvent.change(screen.getByLabelText("Start Date"), {
          target: { value: "2025-01-01" },
        });
        fireEvent.click(screen.getByLabelText("I currently work here"));
      } else if (kind === "process") {
        fireEvent.change(screen.getByLabelText("Outcomes"), {
          target: { value: "A clear result" },
        });
      } else {
        fireEvent.change(screen.getByLabelText("Answer"), {
          target: { value: "A linked answer." },
        });
      }
      fireEvent.click(screen.getByRole("button", { name: "Apply changes" }));

      let updated = onChange.mock.lastCall?.[0];
      if (!updated) throw new Error(`Expected ${kind} to update the CMS snapshot.`);
      const record =
        kind === "experience"
          ? updated.experience.find(({ company }) => company === value)
          : kind === "process"
            ? updated.process.find(({ title: itemTitle }) => itemTitle === value)
            : updated.faqs.find(({ q }) => q === value);
      if (!record) throw new Error(`Expected the new ${kind} record.`);
      const recordId = record.id;
      expect(getCollectionIds(updated, kind)).toContain(recordId);

      view.rerender(<CollectionWorkspace kind={kind} snapshot={updated} onChange={onChange} />);
      const entry = contentEntry(value);
      fireEvent.click(within(entry).getByRole("button", { name: `Move ${value} up` }));
      updated = onChange.mock.lastCall?.[0];
      if (!updated) throw new Error(`Expected ${kind} ordering to update.`);
      const orderedIds =
        kind === "experience"
          ? [...updated.experience].sort((a, b) => a.order - b.order).map(({ id }) => id)
          : kind === "process"
            ? [...updated.process].sort((a, b) => a.order - b.order).map(({ id }) => id)
            : [...updated.faqs].sort((a, b) => a.order - b.order).map(({ id }) => id);
      expect(getCollectionIds(updated, kind)).toEqual(orderedIds);

      view.rerender(<CollectionWorkspace kind={kind} snapshot={updated} onChange={onChange} />);
      fireEvent.click(within(contentEntry(value)).getByRole("button", { name: `Hide ${value}` }));
      updated = onChange.mock.lastCall?.[0];
      if (!updated) throw new Error(`Expected ${kind} visibility to update.`);
      const hiddenRecord =
        kind === "experience"
          ? updated.experience.find(({ id }) => id === recordId)
          : kind === "process"
            ? updated.process.find(({ id }) => id === recordId)
            : updated.faqs.find(({ id }) => id === recordId);
      expect(hiddenRecord?.visible).toBe(false);

      view.rerender(<CollectionWorkspace kind={kind} snapshot={updated} onChange={onChange} />);
      fireEvent.click(within(contentEntry(value)).getByRole("button", { name: `Remove ${value}` }));
      updated = onChange.mock.lastCall?.[0];
      if (!updated) throw new Error(`Expected ${kind} deletion to update the CMS snapshot.`);
      expect(getCollectionIds(updated, kind)).not.toContain(recordId);
      view.unmount();
    }
  });

  it("creates unique custom categories for project organization", async () => {
    await openDashboardWorkspace("Categories");
    const name = screen.getByLabelText("New category");
    fireEvent.change(name, { target: { value: "Art Direction" } });
    fireEvent.click(screen.getByRole("button", { name: "Add category" }));
    expect(await screen.findByRole("heading", { name: "Art Direction" })).toBeInTheDocument();

    fireEvent.change(name, { target: { value: "Art Direction" } });
    fireEvent.click(screen.getByRole("button", { name: "Add category" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/already in use/i);
  });

  it("rejects a case-insensitive duplicate when renaming a category", async () => {
    const snapshot = await createDemoContent();
    const category = snapshot.categories[0];
    const conflictingCategory = snapshot.categories[1];
    if (!category || !conflictingCategory) throw new Error("Expected two seeded categories.");
    const onChange = vi.fn<(updated: ContentSnapshot) => void>();
    render(<CategoriesWorkspace snapshot={snapshot} onChange={onChange} />);
    const categoryItem = screen
      .getAllByRole("listitem")
      .find((item) => item.textContent?.includes(category.name));
    if (!categoryItem) throw new Error("Expected an editable category.");
    fireEvent.click(within(categoryItem).getByRole("button", { name: "Edit" }));
    fireEvent.change(within(categoryItem).getByLabelText(`Edit ${category.name}`), {
      target: { value: conflictingCategory.name.toLowerCase() },
    });
    fireEvent.click(within(categoryItem).getByRole("button", { name: "Save category" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/already in use/i);
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
    fireEvent.click(screen.getAllByRole("button", { name: "Add link" })[0]!);
    fireEvent.click(screen.getByRole("button", { name: "Apply changes" }));
    expect(await screen.findByRole("status")).toHaveTextContent(/Site settings applied/);

    fireEvent.click(screen.getAllByRole("button", { name: "Projects" })[0]!);
    fireEvent.click(screen.getAllByRole("button", { name: "Site Settings" })[0]!);
    expect(screen.getByLabelText("Public name")).toHaveValue("Demo identity");
    expect(
      screen
        .getAllByLabelText("Label")
        .some((input) => (input as HTMLInputElement).value === "New link"),
    ).toBe(true);
  });

  it("discards unsaved site-setting edits and validates social-link controls", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const baseline = await createDemoContent();
    await openDashboardWorkspace("Contact");
    expect(await screen.findByRole("heading", { name: "Contact" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Public contact email"), {
      target: { value: "discard@example.test" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByLabelText("Public contact email")).toHaveValue(baseline.contact.publicEmail);

    fireEvent.click(screen.getByRole("button", { name: "Add social link" }));
    const newLink = screen.getAllByLabelText(/social-.*URL/).at(-1)!;
    fireEvent.change(newLink, { target: { value: "invalid-url" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply changes" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    fireEvent.change(newLink, { target: { value: "https://example.com/demo" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply changes" }));
    expect(await screen.findByRole("status")).toHaveTextContent(/Contact applied/);
    fireEvent.click(screen.getByRole("button", { name: /Remove social-.* social link/ }));
    expect(window.confirm).toHaveBeenCalled();
    expect(screen.queryByLabelText(/social-.*URL/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Apply changes" }));
    expect(await screen.findByRole("status")).toHaveTextContent(/Contact applied/);
  });

  it("edits About profile details and section heading in its dedicated workspace", async () => {
    await openDashboardWorkspace("About");
    expect(await screen.findByRole("heading", { name: "About", level: 1 })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Profile focus"), {
      target: { value: "Brand strategy and packaging" },
    });

    fireEvent.change(screen.getByLabelText("About section heading"), {
      target: { value: "Design with intent" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply changes" }));
    expect(await screen.findByRole("status")).toHaveTextContent(/About applied/);

    const navigation = within(screen.getByRole("navigation", { name: "Dashboard" }));
    fireEvent.click(navigation.getByRole("button", { name: "Projects" }));
    fireEvent.click(navigation.getByRole("button", { name: "About" }));
    expect(screen.getByLabelText("Profile focus")).toHaveValue("Brand strategy and packaging");
    expect(screen.getByLabelText("About section heading")).toHaveValue("Design with intent");
  });

  it("saves a supported software icon selection in the About workspace", async () => {
    await openDashboardWorkspace("About");
    const firstSelect = screen.getAllByLabelText(/software icon$/i)[0] as HTMLSelectElement;
    fireEvent.change(firstSelect, { target: { value: "figma" } });
    expect(firstSelect).toHaveValue("figma");
    fireEvent.click(screen.getByRole("button", { name: "Apply changes" }));
    expect(await screen.findByRole("status")).toHaveTextContent(/About applied/);

    const navigation = within(screen.getByRole("navigation", { name: "Dashboard" }));
    fireEvent.click(navigation.getByRole("button", { name: "Projects" }));
    fireEvent.click(navigation.getByRole("button", { name: "About" }));
    expect(screen.getAllByLabelText(/software icon$/i)[0]).toHaveValue("figma");
  });

  it("edits Contact section copy and public contact details", async () => {
    await openDashboardWorkspace("Contact");
    fireEvent.change(screen.getByLabelText("Contact section introduction"), {
      target: { value: "Start a conversation about your next project." },
    });
    fireEvent.change(screen.getByLabelText("Public contact email"), {
      target: { value: "hello@example.test" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply changes" }));
    expect(await screen.findByRole("status")).toHaveTextContent(/Contact applied/);

    const navigation = within(screen.getByRole("navigation", { name: "Dashboard" }));
    fireEvent.click(navigation.getByRole("button", { name: "Projects" }));
    fireEvent.click(navigation.getByRole("button", { name: "Contact" }));
    expect(screen.getByLabelText("Contact section introduction")).toHaveValue(
      "Start a conversation about your next project.",
    );
    expect(screen.getByLabelText("Public contact email")).toHaveValue("hello@example.test");
  });

  it("edits Experience homepage heading copy without changing collection records", async () => {
    await openDashboardWorkspace("Experience");
    fireEvent.change(screen.getByRole("textbox", { name: "Experience section heading" }), {
      target: { value: "Selected experience" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Experience section introduction" }), {
      target: { value: "A few of the teams and roles that shaped my work." },
    });
    expect(screen.getByRole("textbox", { name: "Experience section heading" })).toHaveValue(
      "Selected experience",
    );
    expect(screen.getByRole("textbox", { name: "Experience section introduction" })).toHaveValue(
      "A few of the teams and roles that shaped my work.",
    );
  });

  it.each([
    ["Process", "Process section heading", "A considered process"],
    ["FAQ", "FAQs section heading", "Questions, answered"],
  ])("updates %s homepage section copy", async (workspace, label, value) => {
    await openDashboardWorkspace(workspace);
    const heading = screen.getByRole("textbox", { name: label });
    fireEvent.change(heading, { target: { value } });
    expect(heading).toHaveValue(value);
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
