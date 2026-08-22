import layoutDicts from "./data/layout-dicts.json";
import type { LayoutKey } from "./layouts";

interface LayoutDict {
  label: string;
  names: Record<string, string>;
}

const DICTS = layoutDicts as Record<string, LayoutDict>;

const RZIS_VARIANTS = ["RZiSKalk", "RZiSPor"] as const;
export type RzisVariant = (typeof RZIS_VARIANTS)[number];

export function rzisVariantOf(wariant: number | null): RzisVariant {
  return wariant === 2 ? "RZiSPor" : "RZiSKalk";
}

export function nameFor(layout: LayoutKey, section: string, code: string, variant?: RzisVariant): string | null {
  if (layout === "LEGACY") {
    return null;
  }
  const names = DICTS[layout]?.names;
  if (!names) {
    return null;
  }
  if (section === "RZiS" && variant) {
    return names[`RZiS.${variant}.${code}`] ?? null;
  }
  return names[`${section}.${code}`] ?? null;
}

export function hasLayoutDict(layout: LayoutKey): boolean {
  return layout !== "LEGACY" && Boolean(DICTS[layout]?.names);
}

export function layoutLabel(layout: LayoutKey): string {
  return DICTS[layout]?.label ?? "Legacy (pre-2025 schema)";
}
