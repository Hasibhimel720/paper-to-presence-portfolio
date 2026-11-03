import type { AppearanceSettings, ContentSnapshot } from "@/lib/cms/schema";

export const defaultAppearanceSettings: AppearanceSettings = {
  modes: {
    light: {
      colors: {
        background: "#f7f7f5",
        surface: "oklch(0.995 0.004 90)",
        surfaceSecondary: "oklch(0.94 0.012 90)",
        foreground: "oklch(0.23 0.015 260)",
        mutedForeground: "oklch(0.45 0.018 260)",
        primary: "oklch(0.62 0.21 262)",
        primaryForeground: "oklch(0.98 0.005 264)",
        accent: "oklch(0.48 0.12 220)",
        border: "oklch(0.82 0.012 260 / 75%)",
        input: "oklch(0.72 0.016 260 / 70%)",
      },
      background: {
        gradientOpacity: 58,
        ambientIntensity: 100,
        gradientPosition: "top",
      },
      glass: {
        surfaceOpacity: 78,
        blur: 18,
        borderOpacity: 82,
        shadowIntensity: 25,
        highlightIntensity: 86,
      },
    },
    dark: {
      colors: {
        background: "oklch(0.12 0.025 264)",
        surface: "oklch(0.16 0.03 264)",
        surfaceSecondary: "oklch(0.2 0.035 264)",
        foreground: "oklch(0.96 0.008 264)",
        mutedForeground: "oklch(0.68 0.02 264)",
        primary: "oklch(0.62 0.21 262)",
        primaryForeground: "oklch(0.98 0.005 264)",
        accent: "oklch(0.78 0.14 210)",
        border: "oklch(1 0 0 / 9%)",
        input: "oklch(1 0 0 / 14%)",
      },
      background: {
        gradientOpacity: 100,
        ambientIntensity: 100,
        gradientPosition: "top",
      },
      glass: {
        surfaceOpacity: 76,
        blur: 16,
        borderOpacity: 12,
        shadowIntensity: 72,
        highlightIntensity: 8,
      },
    },
  },
  borderWidth: 1,
  cardRadius: 24,
  buttonRadius: 999,
  preset: "premium-glass",
};

export function getAppearanceSettings(theme: ContentSnapshot["theme"]): AppearanceSettings {
  return structuredClone(theme.appearance ?? defaultAppearanceSettings);
}
