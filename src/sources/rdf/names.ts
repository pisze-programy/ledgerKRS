import layoutDicts from "./data/layout-dicts.json";
import type { LayoutKey } from "./layouts";

interface LayoutDict {
  label: string;
  names: Record<string, string>;
}

const DICTS = layoutDicts as Record<string, LayoutDict>;

const RZIS_VARIANTS = ["RZiSKalk", "RZiSPor"] as const;
export type RzisVariant = (typeof RZIS_VARIANTS)[number];

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

export function entriesFor(
  layout: LayoutKey,
  section: string,
  variant?: RzisVariant,
): [string, string][] {
  if (layout === "LEGACY") {
    return [];
  }
  const names = DICTS[layout]?.names;
  if (!names) {
    return [];
  }
  const prefix = section === "RZiS" && variant ? `RZiS.${variant}.` : `${section}.`;
  return Object.entries(names)
    .filter(([key]) => key.startsWith(prefix))
    .map(([key, name]) => [key.slice(prefix.length), name] as [string, string]);
}
