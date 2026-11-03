import { useEffect } from "react";
import { Moon, Sun } from "lucide-react";
import { syncThemeColor, toggleColorScheme } from "@/lib/color-scheme";

export function ThemeToggle() {
  useEffect(() => {
    const scheme = document.documentElement.dataset["theme"];
    if (scheme === "light" || scheme === "dark") syncThemeColor(scheme);
  }, []);

  return (
    <button
      type="button"
      className="theme-toggle"
      aria-label="Toggle light and dark themes"
      title="Toggle light and dark themes"
      onClick={toggleColorScheme}
    >
      <Sun className="theme-toggle-sun" aria-hidden="true" />
      <Moon className="theme-toggle-moon" aria-hidden="true" />
    </button>
  );
}
