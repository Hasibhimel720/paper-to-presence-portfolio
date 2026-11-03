import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { colorSchemeStorageKey } from "@/lib/color-scheme";
import { ThemeToggle } from "@/components/site/ThemeToggle";

describe("public color scheme toggle", () => {
  beforeEach(() => {
    localStorage.removeItem(colorSchemeStorageKey);
    document.documentElement.dataset["theme"] = "dark";
  });

  afterEach(() => {
    localStorage.removeItem(colorSchemeStorageKey);
    delete document.documentElement.dataset["theme"];
  });

  it("switches the active theme and saves the visitor's preference", () => {
    const themeColor = document.createElement("meta");
    themeColor.name = "theme-color";
    document.head.append(themeColor);
    render(<ThemeToggle />);
    const toggle = screen.getByRole("button", { name: "Toggle light and dark themes" });

    fireEvent.click(toggle);

    expect(document.documentElement).toHaveAttribute("data-theme", "light");
    expect(localStorage.getItem(colorSchemeStorageKey)).toBe("light");
    expect(themeColor).toHaveAttribute("content", "#f8f6ef");

    fireEvent.click(toggle);

    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(localStorage.getItem(colorSchemeStorageKey)).toBe("dark");
    expect(themeColor).toHaveAttribute("content", "#10131d");
    themeColor.remove();
  });
});
