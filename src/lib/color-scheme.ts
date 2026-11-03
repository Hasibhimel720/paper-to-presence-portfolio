export type ColorScheme = "light" | "dark";

export const colorSchemeStorageKey = "portfolio-color-scheme";
const themeColors = { light: "#f8f6ef", dark: "#10131d" } satisfies Record<ColorScheme, string>;

export const colorSchemeBootstrap = `(() => {
  const storageKey = ${JSON.stringify(colorSchemeStorageKey)};
  const colors = ${JSON.stringify(themeColors)};
  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  const readStoredScheme = () => {
    try {
      const scheme = window.localStorage.getItem(storageKey);
      return scheme === "light" || scheme === "dark" ? scheme : null;
    } catch (error) {
      console.warn("Could not read the saved color scheme.", error);
      return null;
    }
  };
  const applyScheme = (scheme) => {
    document.documentElement.dataset.theme = scheme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", colors[scheme]);
  };

  applyScheme(readStoredScheme() || (mediaQuery.matches ? "dark" : "light"));
  mediaQuery.addEventListener("change", (event) => {
    if (!readStoredScheme()) applyScheme(event.matches ? "dark" : "light");
  });
  const themeColorObserver = new MutationObserver(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) return;
    meta.setAttribute("content", colors[document.documentElement.dataset.theme]);
    themeColorObserver.disconnect();
  });
  themeColorObserver.observe(document.head, { childList: true, subtree: true });
  window.addEventListener("storage", (event) => {
    if (event.key !== storageKey && event.key !== null) return;
    applyScheme(
      event.newValue === "light" || event.newValue === "dark"
        ? event.newValue
        : mediaQuery.matches
          ? "dark"
          : "light",
    );
  });
})();`;

export function syncThemeColor(scheme: ColorScheme) {
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", themeColors[scheme]);
}

export function toggleColorScheme() {
  const root = document.documentElement;
  const nextScheme: ColorScheme = root.dataset["theme"] === "light" ? "dark" : "light";
  root.dataset["theme"] = nextScheme;
  syncThemeColor(nextScheme);
  try {
    window.localStorage.setItem(colorSchemeStorageKey, nextScheme);
  } catch (error) {
    console.warn("Could not save the selected color scheme.", error);
  }
}
