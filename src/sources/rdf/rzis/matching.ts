import { nameFor, type RzisVariant } from "../names";
import type { StatementMeta } from "../layouts";

/** All single-letter RZiS codes across every layout (up to consolidated W). */
const LETTER_CODES = "ABCDEFGHIJKLMNOPQRSTUVW".split("");

/**
 * Case-fold a Polish name for matching: lower-case, strip combining
 * diacritics (ą/ę/ó/ś/ź/ż/ć/ń via NFD) and the non-combining "ł" (U+0142).
 */
export function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ł/g, "l");
}

/**
 * The canonical role phrase of a dict entry: the name minus the trailing
 * formula parenthetical, e.g. "Zysk (strata) brutto (M - N + O +/- P)"
 * -> "zysk (strata) brutto". The "(strata)" part is preserved.
 */
export function namePhrase(name: string): string {
  return normalizeName(name).replace(/\s*\([^()]*\)\s*$/, "");
}

/** Build the dict-name map for a layout's RZiS variant (letters A..W). */
export function dictNamesFor(meta: StatementMeta, variant: RzisVariant): Map<string, string> {
  const names = new Map<string, string>();
  for (const code of LETTER_CODES) {
    const name = nameFor(meta.layout, "RZiS", code, variant);
    if (name) {
      names.set(code, name);
    }
  }
  return names;
}

/**
 * Match a role needle against dict names. Prefer an exact phrase match
 * ("zysk (strata) brutto" = the formula position, not "…brutto ze sprzedaży"),
 * then fall back to a substring match.
 */
export function findRoleByDict(names: Map<string, string>, needle: string): string | null {
  const target = normalizeName(needle);
  for (const [code, name] of names) {
    if (namePhrase(name) === target) {
      return code;
    }
  }
  for (const [code, name] of names) {
    if (namePhrase(name).includes(target)) {
      return code;
    }
  }
  return null;
}
