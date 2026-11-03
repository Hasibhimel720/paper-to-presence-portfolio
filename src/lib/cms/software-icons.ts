import type { ContentSnapshot } from "@/lib/cms/schema";

export type SoftwareIcon = NonNullable<ContentSnapshot["profile"]["toolkit"][number]["icon"]>;

export function inferSoftwareIcon(name: string): SoftwareIcon {
  const normalized = name.toLowerCase();
  if (normalized.includes("illustrator")) return "illustrator";
  if (normalized.includes("photoshop")) return "photoshop";
  if (normalized.includes("after effect")) return "after-effects";
  if (normalized.includes("premiere")) return "premiere-pro";
  if (normalized.includes("figma")) return "figma";
  return "other";
}
