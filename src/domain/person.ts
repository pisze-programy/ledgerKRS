/**
 * Person-name matching across the registry. KRS filings render the same person
 * with slight variations ("Kowalski Jan", "Jan Kowalski", "KOWALSKI JAN",
 * "Jan K. Kowalski", "Żółć" vs "Zolc"). To detect a person shared between
 * companies we reduce every name to a canonical key: lowercase, the Polish
 * stroke-ł flattened, diacritics stripped (NFD), runs of whitespace collapsed,
 * and — for the matching key — the tokens sorted so word order is irrelevant.
 */
export function normalizePersonName(name: string | null | undefined): string {
  if (!name) {
    return "";
  }
  return name
    .replace(/ł/g, "l")
    .replace(/Ł/g, "L")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** Canonical, order-insensitive matching key for a person name. */
export function personKey(name: string | null | undefined): string {
  return normalizePersonName(name).split(" ").sort().join(" ");
}
