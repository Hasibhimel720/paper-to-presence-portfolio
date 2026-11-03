import { useEffect, useState } from "react";
import { Eye, RotateCcw, Sparkles } from "lucide-react";
import { defaultAppearanceSettings, getAppearanceSettings } from "@/lib/cms/appearance-settings";
import {
  appearanceSettingsSchema,
  contentSnapshotSchema,
  type AppearanceSettings,
  type ContentSnapshot,
} from "@/lib/cms/schema";

type ThemeMode = "light" | "dark";
type AppearanceColor = keyof AppearanceSettings["modes"]["light"]["colors"];
type Preset = AppearanceSettings["preset"];

type AppearanceWorkspaceProps = {
  snapshot: ContentSnapshot;
  onApply: (snapshot: ContentSnapshot) => void;
  onPreview: (snapshot: ContentSnapshot) => void;
};

const colors: { key: AppearanceColor; label: string }[] = [
  { key: "primary", label: "Primary color" },
  { key: "surfaceSecondary", label: "Secondary surface" },
  { key: "accent", label: "Accent and links" },
  { key: "background", label: "Page background" },
  { key: "surface", label: "Card and glass surface" },
  { key: "foreground", label: "Main text" },
  { key: "mutedForeground", label: "Secondary text" },
  { key: "primaryForeground", label: "Button text" },
  { key: "border", label: "Borders" },
  { key: "input", label: "Form controls" },
];

const pickerFallbacks: Record<ThemeMode, Record<AppearanceColor, string>> = {
  light: {
    primary: "#4f46e5",
    surfaceSecondary: "#f0efec",
    accent: "#426d99",
    background: "#f7f7f5",
    surface: "#fffefb",
    foreground: "#38393a",
    mutedForeground: "#707277",
    primaryForeground: "#fafafa",
    border: "#d5d4d2",
    input: "#b5b4b1",
  },
  dark: {
    primary: "#3b61ec",
    surfaceSecondary: "#19243a",
    accent: "#1cb8e4",
    background: "#090e1b",
    surface: "#10182a",
    foreground: "#f2f4f8",
    mutedForeground: "#a9abb3",
    primaryForeground: "#fafafa",
    border: "#272831",
    input: "#33343f",
  },
};

const presets: { id: Preset; label: string; description: string }[] = [
  {
    id: "premium-glass",
    label: "Premium Glass",
    description: "Current glass identity across both themes.",
  },
  {
    id: "minimal-editorial",
    label: "Minimal Editorial",
    description: "Quiet surfaces, restrained blur, generous whitespace.",
  },
  {
    id: "modern-minimal",
    label: "Modern Minimal",
    description: "Crisp surfaces, light shadows, and clean edges.",
  },
  {
    id: "premium-dark",
    label: "Premium Dark",
    description: "Emphasize the existing cinematic dark treatment.",
  },
  {
    id: "monochromatic-light",
    label: "Monochromatic Light",
    description: "Pearl, silver, and graphite with no colored lighting.",
  },
];

const fontChoices = ["Space Grotesk", "Manrope", "system-ui", "sans-serif", "serif"] as const;
const inputClass =
  "w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";
const cardClass = "rounded-2xl border border-border bg-card p-5 sm:p-6";

function NumberControl({
  label,
  value,
  min,
  max,
  step = 1,
  unit = "",
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block space-y-2">
      <span className="flex items-center justify-between gap-3 text-xs font-medium">
        <span>{label}</span>
        <output className="tabular-nums text-muted-foreground">
          {value}
          {unit}
        </output>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-primary"
        aria-label={label}
      />
    </label>
  );
}

function fieldsetValue<T extends object, K extends keyof T>(source: T, key: K, value: T[K]) {
  return { ...source, [key]: value };
}

function presetSettings(preset: Preset, previous: AppearanceSettings): AppearanceSettings {
  const next = structuredClone(defaultAppearanceSettings);
  next.preset = preset;

  if (preset === "minimal-editorial") {
    next.modes.light.background.gradientOpacity = 24;
    next.modes.light.background.ambientIntensity = 0;
    next.modes.light.glass = {
      surfaceOpacity: 94,
      blur: 6,
      borderOpacity: 52,
      shadowIntensity: 16,
      highlightIntensity: 42,
    };
    next.modes.dark.glass = {
      surfaceOpacity: 88,
      blur: 8,
      borderOpacity: 10,
      shadowIntensity: 54,
      highlightIntensity: 6,
    };
  } else if (preset === "modern-minimal") {
    next.modes.light.background.gradientOpacity = 18;
    next.modes.light.background.ambientIntensity = 0;
    next.modes.light.glass = {
      surfaceOpacity: 98,
      blur: 2,
      borderOpacity: 64,
      shadowIntensity: 12,
      highlightIntensity: 28,
    };
    next.modes.dark.glass = {
      surfaceOpacity: 92,
      blur: 4,
      borderOpacity: 14,
      shadowIntensity: 40,
      highlightIntensity: 5,
    };
  } else if (preset === "premium-dark") {
    next.modes.light = structuredClone(previous.modes.light);
    next.modes.dark.glass = {
      surfaceOpacity: 82,
      blur: 20,
      borderOpacity: 16,
      shadowIntensity: 78,
      highlightIntensity: 10,
    };
  } else if (preset === "monochromatic-light") {
    next.modes.light.background.gradientOpacity = 34;
    next.modes.light.background.ambientIntensity = 0;
    next.modes.light.glass = {
      surfaceOpacity: 86,
      blur: 16,
      borderOpacity: 74,
      shadowIntensity: 22,
      highlightIntensity: 74,
    };
    next.modes.dark = structuredClone(previous.modes.dark);
  } else if (preset === "premium-glass") {
    next.modes.dark = structuredClone(previous.modes.dark);
  }

  return next;
}

export function AppearanceWorkspace({ snapshot, onApply, onPreview }: AppearanceWorkspaceProps) {
  const [draft, setDraft] = useState(() => structuredClone(snapshot));
  const [mode, setMode] = useState<ThemeMode>("light");
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!dirty) setDraft(structuredClone(snapshot));
  }, [snapshot, dirty]);

  const appearance = getAppearanceSettings(draft.theme);
  const modeSettings = appearance.modes[mode];

  function updateTheme(change: (current: ContentSnapshot["theme"]) => ContentSnapshot["theme"]) {
    setDraft((current) => ({ ...current, theme: change(structuredClone(current.theme)) }));
    setDirty(true);
    setError("");
    setMessage("");
  }

  function updateAppearance(change: (current: AppearanceSettings) => AppearanceSettings) {
    updateTheme((theme) =>
      fieldsetValue(theme, "appearance", change(getAppearanceSettings(theme))),
    );
  }

  function updateMode(
    change: (
      current: AppearanceSettings["modes"][ThemeMode],
    ) => AppearanceSettings["modes"][ThemeMode],
  ) {
    updateAppearance((current) => ({
      ...current,
      modes: { ...current.modes, [mode]: change(current.modes[mode]) },
    }));
  }

  function applyDraft(forPreview: boolean) {
    const appearanceValidation = appearanceSettingsSchema.safeParse(appearance);
    if (!appearanceValidation.success) {
      setError(appearanceValidation.error.issues[0]?.message ?? "Review the appearance settings.");
      return;
    }

    const candidate: ContentSnapshot = {
      ...draft,
      theme: { ...draft.theme, appearance: appearanceValidation.data },
    };
    const validation = contentSnapshotSchema.safeParse(candidate);
    if (!validation.success) {
      setError(validation.error.issues[0]?.message ?? "Review the appearance settings.");
      return;
    }
    onApply(validation.data);
    if (forPreview) {
      setMessage("Previewing the actual homepage with your current unsaved design settings.");
      onPreview(validation.data);
    } else {
      setDraft(validation.data);
      setDirty(false);
      setMessage("Appearance changes are in the dashboard draft. Save Draft to persist them.");
    }
    setError("");
  }

  function resetAppearance() {
    updateTheme((theme) =>
      fieldsetValue(theme, "appearance", structuredClone(defaultAppearanceSettings)),
    );
    setMessage("Default appearance settings selected. Apply changes to use them in the preview.");
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-muted-foreground">Public website design controls</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Appearance / Design Studio</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          These settings are stored with CMS content. Applying updates your current dashboard draft;
          only Save Draft and Publish change the public website.
        </p>
      </header>

      {dirty && (
        <p className="rounded-xl border border-primary/25 bg-primary/5 px-4 py-3 text-sm">
          Unsaved design settings · changes are local until applied to the dashboard draft.
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-destructive/40 bg-card p-3 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="rounded-lg border border-success/30 bg-success/5 p-3 text-sm">
          {message}
        </p>
      )}

      <section aria-label="Design presets" className={cardClass}>
        <div className="flex items-start gap-3">
          <Sparkles aria-hidden="true" className="mt-0.5 h-5 w-5 text-primary" />
          <div>
            <h2 className="font-semibold">Design presets</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Presets change appearance controls only. They never save or publish automatically.
            </p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {presets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              aria-pressed={appearance.preset === preset.id}
              onClick={() => {
                updateAppearance((current) => presetSettings(preset.id, current));
                setMessage(
                  `${preset.label} selected for preview. Apply changes to update the draft.`,
                );
              }}
              className={`rounded-xl border p-3 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                appearance.preset === preset.id ? "border-primary bg-primary/5" : "border-border"
              }`}
            >
              <span className="block text-sm font-medium">{preset.label}</span>
              <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                {preset.description}
              </span>
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={resetAppearance}
          className="mt-4 inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-accent"
        >
          <RotateCcw aria-hidden="true" className="h-4 w-4" />
          Reset appearance defaults
        </button>
      </section>

      <section aria-label="Colors and themes" className={cardClass}>
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div>
            <h2 className="font-semibold">Colors &amp; themes</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Light and Dark Mode colors are independent; unset saved CMS settings use the current
              site defaults.
            </p>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              For accessible text, aim for a WCAG AA contrast ratio of 4.5:1 for body text and 3:1
              for large text and controls.
            </p>
          </div>
          <div
            role="tablist"
            aria-label="Theme to edit"
            className="inline-flex rounded-lg border border-border p-1"
          >
            {(["light", "dark"] as const).map((themeMode) => (
              <button
                key={themeMode}
                type="button"
                role="tab"
                aria-selected={mode === themeMode}
                onClick={() => setMode(themeMode)}
                className={`rounded-md px-4 py-2 text-sm capitalize ${
                  mode === themeMode ? "bg-accent font-medium" : "text-muted-foreground"
                }`}
              >
                {themeMode} Mode
              </button>
            ))}
          </div>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {colors.map(({ key, label }) => {
            const value = modeSettings.colors[key];
            const hexValue = /^#[\da-f]{6}$/i.test(value) ? value : pickerFallbacks[mode][key];
            return (
              <div key={key} className="space-y-2">
                <label htmlFor={`${mode}-color-${key}`} className="block text-xs font-medium">
                  {label}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id={`${mode}-color-${key}`}
                    type="color"
                    value={hexValue}
                    onChange={(event) =>
                      updateMode((current) => ({
                        ...current,
                        colors: { ...current.colors, [key]: event.target.value },
                      }))
                    }
                    className="h-11 w-14 cursor-pointer rounded-lg border border-border bg-background p-1"
                  />
                  <input
                    aria-label={`${label} HEX value`}
                    inputMode="text"
                    value={value}
                    onChange={(event) =>
                      updateMode((current) => ({
                        ...current,
                        colors: { ...current.colors, [key]: event.target.value },
                      }))
                    }
                    className={inputClass}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section aria-label="Typography controls" className={cardClass}>
        <h2 className="font-semibold">Typography</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Curated system-safe font families are applied to the public site without external font
          loading.
        </p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {(
            [
              ["displayFont", "Heading font"],
              ["bodyFont", "Body font"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="block space-y-1.5">
              <span className="text-xs font-medium">{label}</span>
              <select
                value={draft.theme.typography[key]}
                onChange={(event) =>
                  updateTheme((theme) => ({
                    ...theme,
                    typography: {
                      ...theme.typography,
                      [key]: event.target.value as (typeof fontChoices)[number],
                    },
                  }))
                }
                className={inputClass}
              >
                {fontChoices.map((font) => (
                  <option key={font} value={font}>
                    {font}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <NumberControl
            label="Heading weight"
            min={300}
            max={900}
            step={100}
            value={draft.theme.typography.displayWeight}
            onChange={(displayWeight) =>
              updateTheme((theme) => ({
                ...theme,
                typography: { ...theme.typography, displayWeight },
              }))
            }
          />
          <NumberControl
            label="Body weight"
            min={300}
            max={900}
            step={100}
            value={draft.theme.typography.bodyWeight}
            onChange={(bodyWeight) =>
              updateTheme((theme) => ({
                ...theme,
                typography: { ...theme.typography, bodyWeight },
              }))
            }
          />
          <NumberControl
            label="Heading letter spacing"
            min={-0.08}
            max={0.12}
            step={0.01}
            unit="em"
            value={draft.theme.typography.displayLetterSpacing ?? -0.01}
            onChange={(displayLetterSpacing) =>
              updateTheme((theme) => ({
                ...theme,
                typography: { ...theme.typography, displayLetterSpacing },
              }))
            }
          />
          <NumberControl
            label="Body letter spacing"
            min={-0.02}
            max={0.1}
            step={0.005}
            unit="em"
            value={draft.theme.typography.bodyLetterSpacing ?? 0}
            onChange={(bodyLetterSpacing) =>
              updateTheme((theme) => ({
                ...theme,
                typography: { ...theme.typography, bodyLetterSpacing },
              }))
            }
          />
          <NumberControl
            label="Heading line height"
            min={0.8}
            max={1.6}
            step={0.05}
            value={draft.theme.typography.displayLineHeight ?? 1}
            onChange={(displayLineHeight) =>
              updateTheme((theme) => ({
                ...theme,
                typography: { ...theme.typography, displayLineHeight },
              }))
            }
          />
          <NumberControl
            label="Body line height"
            min={1}
            max={2.5}
            step={0.1}
            value={draft.theme.typography.bodyLineHeight ?? 1.5}
            onChange={(bodyLineHeight) =>
              updateTheme((theme) => ({
                ...theme,
                typography: { ...theme.typography, bodyLineHeight },
              }))
            }
          />
          <NumberControl
            label="Base body font size"
            min={12}
            max={24}
            value={draft.theme.typography.baseFontSize ?? 16}
            unit="px"
            onChange={(baseFontSize) =>
              updateTheme((theme) => ({
                ...theme,
                typography: { ...theme.typography, baseFontSize },
              }))
            }
          />
          <NumberControl
            label="Heading scale"
            min={1}
            max={1.5}
            step={0.05}
            value={draft.theme.typography.headingScale ?? 1}
            onChange={(headingScale) =>
              updateTheme((theme) => ({
                ...theme,
                typography: { ...theme.typography, headingScale },
              }))
            }
          />
        </div>
        <div className="mt-5 rounded-xl border border-border bg-background p-5">
          <p className="eyebrow">Typography preview</p>
          <p
            className="mt-3 font-semibold"
            style={{
              fontFamily: `"${draft.theme.typography.displayFont}", ui-sans-serif, system-ui`,
              fontWeight: draft.theme.typography.displayWeight,
            }}
          >
            A considered identity, made to last.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Clear supporting copy demonstrates the selected body typeface and reading scale.
          </p>
          <button
            type="button"
            className="mt-4 rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground"
          >
            Button label
          </button>
        </div>
      </section>

      <section aria-label="Glass visual style" className={cardClass}>
        <h2 className="font-semibold">Visual style · glassmorphism</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Adjust the treatment used by existing navigation, cards, and controls.
        </p>
        <div className="mt-5 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          <NumberControl
            label="Glass surface opacity"
            min={40}
            max={100}
            unit="%"
            value={modeSettings.glass.surfaceOpacity}
            onChange={(surfaceOpacity) =>
              updateMode((current) => ({
                ...current,
                glass: fieldsetValue(current.glass, "surfaceOpacity", surfaceOpacity),
              }))
            }
          />
          <NumberControl
            label="Backdrop blur"
            min={0}
            max={32}
            unit="px"
            value={modeSettings.glass.blur}
            onChange={(blur) =>
              updateMode((current) => ({
                ...current,
                glass: fieldsetValue(current.glass, "blur", blur),
              }))
            }
          />
          <NumberControl
            label="Border opacity"
            min={0}
            max={100}
            unit="%"
            value={modeSettings.glass.borderOpacity}
            onChange={(borderOpacity) =>
              updateMode((current) => ({
                ...current,
                glass: fieldsetValue(current.glass, "borderOpacity", borderOpacity),
              }))
            }
          />
          <NumberControl
            label="Shadow intensity"
            min={0}
            max={100}
            unit="%"
            value={modeSettings.glass.shadowIntensity}
            onChange={(shadowIntensity) =>
              updateMode((current) => ({
                ...current,
                glass: fieldsetValue(current.glass, "shadowIntensity", shadowIntensity),
              }))
            }
          />
          <NumberControl
            label="Inner highlight intensity"
            min={0}
            max={100}
            unit="%"
            value={modeSettings.glass.highlightIntensity}
            onChange={(highlightIntensity) =>
              updateMode((current) => ({
                ...current,
                glass: fieldsetValue(current.glass, "highlightIntensity", highlightIntensity),
              }))
            }
          />
          <NumberControl
            label="Background gradient opacity"
            min={0}
            max={100}
            unit="%"
            value={modeSettings.background.gradientOpacity}
            onChange={(gradientOpacity) =>
              updateMode((current) => ({
                ...current,
                background: fieldsetValue(current.background, "gradientOpacity", gradientOpacity),
              }))
            }
          />
          <NumberControl
            label="Ambient lighting"
            min={0}
            max={100}
            unit="%"
            value={modeSettings.background.ambientIntensity}
            onChange={(ambientIntensity) =>
              updateMode((current) => ({
                ...current,
                background: fieldsetValue(current.background, "ambientIntensity", ambientIntensity),
              }))
            }
          />
          <label className="block space-y-1.5">
            <span className="text-xs font-medium">Gradient position</span>
            <select
              value={modeSettings.background.gradientPosition}
              onChange={(event) => {
                const gradientPosition = event.target.value;
                if (
                  gradientPosition !== "top" &&
                  gradientPosition !== "center" &&
                  gradientPosition !== "bottom"
                ) {
                  return;
                }
                updateMode((current) => ({
                  ...current,
                  background: fieldsetValue(
                    current.background,
                    "gradientPosition",
                    gradientPosition,
                  ),
                }));
              }}
              className={inputClass}
            >
              <option value="top">Top</option>
              <option value="center">Center</option>
              <option value="bottom">Bottom</option>
            </select>
          </label>
        </div>
      </section>

      <section aria-label="Layout and spacing" className={cardClass}>
        <h2 className="font-semibold">Layout &amp; spacing</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Values are bounded to preserve responsive page layouts.
        </p>
        <div className="mt-5 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          <NumberControl
            label="Maximum content width"
            min={640}
            max={1920}
            step={20}
            unit="px"
            value={draft.theme.layout.contentMaxWidth}
            onChange={(contentMaxWidth) =>
              updateTheme((theme) => ({
                ...theme,
                layout: { ...theme.layout, contentMaxWidth },
              }))
            }
          />
          <NumberControl
            label="Section vertical spacing"
            min={32}
            max={180}
            step={4}
            unit="px"
            value={draft.theme.spacing.sectionBlock}
            onChange={(sectionBlock) =>
              updateTheme((theme) => ({
                ...theme,
                spacing: { ...theme.spacing, sectionBlock },
              }))
            }
          />
          <NumberControl
            label="Section horizontal padding"
            min={8}
            max={64}
            unit="px"
            value={draft.theme.layout.sectionHorizontalPadding ?? 20}
            onChange={(sectionHorizontalPadding) =>
              updateTheme((theme) => ({
                ...theme,
                layout: { ...theme.layout, sectionHorizontalPadding },
              }))
            }
          />
          <NumberControl
            label="Wide section padding"
            min={8}
            max={96}
            unit="px"
            value={draft.theme.layout.sectionHorizontalPaddingWide ?? 40}
            onChange={(sectionHorizontalPaddingWide) =>
              updateTheme((theme) => ({
                ...theme,
                layout: { ...theme.layout, sectionHorizontalPaddingWide },
              }))
            }
          />
          <NumberControl
            label="Card gap"
            min={8}
            max={48}
            unit="px"
            value={draft.theme.layout.cardGap ?? 20}
            onChange={(cardGap) =>
              updateTheme((theme) => ({
                ...theme,
                layout: { ...theme.layout, cardGap },
              }))
            }
          />
          <NumberControl
            label="Card corner radius"
            min={0}
            max={48}
            unit="px"
            value={appearance.cardRadius}
            onChange={(cardRadius) =>
              updateAppearance((current) => fieldsetValue(current, "cardRadius", cardRadius))
            }
          />
          <NumberControl
            label="Button corner radius"
            min={0}
            max={999}
            step={4}
            unit="px"
            value={appearance.buttonRadius}
            onChange={(buttonRadius) =>
              updateAppearance((current) => fieldsetValue(current, "buttonRadius", buttonRadius))
            }
          />
          <NumberControl
            label="Glass border thickness"
            min={0.5}
            max={3}
            step={0.5}
            unit="px"
            value={appearance.borderWidth}
            onChange={(borderWidth) =>
              updateAppearance((current) => fieldsetValue(current, "borderWidth", borderWidth))
            }
          />
        </div>
      </section>

      <section aria-label="Live preview" className={`${cardClass} border-primary/25`}>
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="font-semibold">Live preview</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Open the actual homepage components with your current settings. The preview is
              isolated from the published site; use Save Draft and Publish separately when ready.
            </p>
          </div>
          <button
            type="button"
            onClick={() => applyDraft(true)}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground"
          >
            <Eye aria-hidden="true" className="h-4 w-4" />
            Preview actual website
          </button>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-background p-3 text-xs">
            <span className="font-medium">Preview modes</span>
            <p className="mt-1 text-muted-foreground">
              Light and Dark controls are available in the preview.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-background p-3 text-xs">
            <span className="font-medium">Responsive widths</span>
            <p className="mt-1 text-muted-foreground">
              Inspect Desktop, Tablet, and Mobile layouts.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-background p-3 text-xs">
            <span className="font-medium">Publishing</span>
            <p className="mt-1 text-muted-foreground">
              Nothing changes publicly until the CMS draft is published.
            </p>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap justify-end gap-3">
        <button
          type="button"
          onClick={() => {
            if (dirty && !window.confirm("Discard your unsaved appearance settings?")) return;
            setDraft(structuredClone(snapshot));
            setDirty(false);
            setError("");
            setMessage("Unsaved appearance settings discarded.");
          }}
          disabled={!dirty}
          className="rounded-lg border border-border px-4 py-2.5 text-sm disabled:opacity-50"
        >
          Discard changes
        </button>
        <button
          type="button"
          onClick={() => applyDraft(false)}
          disabled={!dirty}
          className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          Apply to dashboard draft
        </button>
      </div>
    </div>
  );
}
