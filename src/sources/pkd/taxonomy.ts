import seed from "./taxonomy-seed.json";

export type PkdLevel = "section" | "division" | "group" | "class";

export interface PkdEntry {
  code: string;
  name: string;
  level: PkdLevel;
  parent: string | null;
  section: string | null;
}

interface SeedEntry {
  code: string;
  name: string;
}

export const PKD_TAXONOMY: PkdEntry[] = buildTaxonomy(seed as SeedEntry[]);

export function buildTaxonomy(entries: SeedEntry[]): PkdEntry[] {
  let currentSection: string | null = null;
  let currentDivision: string | null = null;
  let currentGroup: string | null = null;
  const result: PkdEntry[] = [];
  for (const entry of entries) {
    const level = levelOf(entry.code);
    if (level === "section") {
      currentSection = entry.code;
      currentDivision = null;
      currentGroup = null;
    } else if (level === "division") {
      currentDivision = entry.code;
      currentGroup = null;
    } else if (level === "group") {
      currentGroup = entry.code;
    }
    result.push({
      code: entry.code,
      name: entry.name,
      level,
      parent: level === "section" ? null : level === "division" ? currentSection : level === "group" ? currentDivision : currentGroup,
      section: currentSection,
    });
  }
  return result;
}

export function levelOf(code: string): PkdLevel {
  if (/^[A-U]$/.test(code)) {
    return "section";
  }
  if (/^\d{2}$/.test(code)) {
    return "division";
  }
  if (/^\d{2}\.\d$/.test(code)) {
    return "group";
  }
  return "class";
}

export function divisionOf(pkdClass: string): string | null {
  const match = pkdClass.match(/^(\d{2})/);
  return match?.[1] ?? null;
}

export function sectionLetterOf(pkdClass: string): string | null {
  const division = divisionOf(pkdClass);
  if (!division) {
    return null;
  }
  const entry = PKD_TAXONOMY.find((item) => item.code === division);
  return entry?.section ?? null;
}

export function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[ąćęłńóśźż]/g, (letter) => DIACRITIC_MAP[letter] ?? letter)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "branch";
}

const DIACRITIC_MAP: Record<string, string> = {
  ą: "a", ć: "c", ę: "e", ł: "l", ń: "n", ó: "o", ś: "s", ź: "z", ż: "z",
};

export function findByCode(code: string): PkdEntry | null {
  return PKD_TAXONOMY.find((item) => item.code === code) ?? null;
}

export function taxonomyByParent(parent: string | null, level: PkdLevel): PkdEntry[] {
  return PKD_TAXONOMY.filter((item) => item.level === level && item.parent === parent);
}
