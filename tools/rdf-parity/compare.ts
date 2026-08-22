import type { ParsedStatement } from "../../src/sources/rdf/parser";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export interface IndicatorSet {
  rok: number;
  values: Map<string, number | null>;
}

export const CANONICAL = [
  "suma_bilansowa",
  "aktywa_trwale",
  "aktywa_obrotowe",
  "kapital_wlasny",
  "zobowiazania_i_rezerwy",
  "przychody",
  "przychody_ze_sprzedazy",
  "koszty_sprzedanych_produktow",
  "zysk_ze_sprzedazy",
  "zysk_operacyjny",
  "zysk_brutto",
  "zysk_netto",
  "podatek_dochodowy",
  "amortyzacja",
] as const;

const SECTION_BY_NAME: Record<string, string> = {
  "Bilans": "Bilans",
  "Rachunek zysków i strat": "RZiS",
  "Zestawienie zmian w kapitale": "ZestZmianWKapitale",
  "Rachunek przepływów pieniężnych": "RachPrzeplywow",
};

const CODE_MAP: Record<string, [string, string]> = {
  suma_bilansowa: ["Bilans", "Aktywa"],
  aktywa_trwale: ["Bilans", "Aktywa_A"],
  aktywa_obrotowe: ["Bilans", "Aktywa_B"],
  kapital_wlasny: ["Bilans", "Pasywa_A"],
  zobowiazania_i_rezerwy: ["Bilans", "Pasywa_B"],
  przychody: ["RZiS", "A"],
  przychody_ze_sprzedazy: ["RZiS", "A"],
  koszty_sprzedanych_produktow: ["RZiS", "B"],
  zysk_ze_sprzedazy: ["RZiS", "C"],
  zysk_operacyjny: ["RZiS", "F"],
  zysk_brutto: ["RZiS", "I"],
  zysk_netto: ["RZiS", "L"],
  podatek_dochodowy: ["RZiS", "J"],
  amortyzacja: ["RZiS", "B_VIII"],
};

const XML_LAYOUT_TO_KEY: Record<string, string> = {
  JednostkaInna: "SFJINZ",
  JednostkaMala: "SFJMAZ",
  JednostkaMikro: "SFJMIZ",
  JednostkaOp: "SFJOPZ",
  JednostkaPozytkuPublicznego: "SFJOPZ",
  Bank: "SFBNKZ",
};

export function detectLayout(xml: string): string | null {
  const match = xml.match(/<(?:[A-Za-z0-9]+:)?(Jednostka[A-Za-z]*|Bank)[\s>]/);
  if (!match) return null;
  const name = match[1]!;
  return XML_LAYOUT_TO_KEY[name] ?? null;
}

let layoutMapCache: Record<string, { map: Record<string, [string, string]> }> | null = null;
function loadLayoutMap(): Record<string, { map: Record<string, [string, string]> }> {
  if (!layoutMapCache) {
    layoutMapCache = JSON.parse(
      readFileSync(join(process.cwd(), "tools", "rdf-parity", "dump", "layout-indicator-map.json"), "utf8"),
    );
  }
  return layoutMapCache!;
}

export function ourIndicators(statement: ParsedStatement, layoutKey?: string | null): Map<string, number | null> {
  let map = CODE_MAP;
  if (layoutKey) {
    const byKey = loadLayoutMap()[layoutKey]?.map;
    if (byKey && Object.keys(byKey).length > 0) {
      const layoutMap: Record<string, [string, string]> = {};
      for (const [ind, [key, _doc]] of Object.entries(byKey)) {
        layoutMap[ind] = key.split(".") as [string, string];
      }
      map = { ...CODE_MAP, ...layoutMap };
    }
  }
  const bySection = new Map<string, Map<string, number | null>>();
  for (const section of statement.sekcje) {
    const internal = SECTION_BY_NAME[section.sekcja] ?? section.sekcja;
    const codes = new Map<string, number | null>();
    for (const p of section.pozycje) {
      if (p.kod_pozycji) {
        codes.set(p.kod_pozycji, p.kwota);
      }
    }
    bySection.set(internal, codes);
  }
  const out = new Map<string, number | null>();
  for (const name of CANONICAL) {
    const [section, code] = map[name] ?? CODE_MAP[name]!;
    out.set(name, bySection.get(section)?.get(code) ?? null);
  }
  return out;
}

export function bizIndicators(rows: { nazwa_wskaznika: string; kwota: number | null }[]): Map<string, number | null> {
  const out = new Map<string, number | null>();
  for (const row of rows) {
    out.set(row.nazwa_wskaznika, row.kwota);
  }
  return out;
}

export interface ComparisonRow {
  rok: number;
  indicator: string;
  ours: number | null;
  theirs: number | null;
  match: boolean;
  reason: "MATCH" | "MISMATCH" | "ONLY_OURS" | "ONLY_THEIRS";
}

export function compareYear(
  rok: number,
  our: Map<string, number | null>,
  their: Map<string, number | null>,
): ComparisonRow[] {
  const rows: ComparisonRow[] = [];
  for (const name of CANONICAL) {
    const ours = our.get(name) ?? null;
    const theirs = their.get(name) ?? null;
    if (ours === null && theirs === null) {
      continue;
    }
    if (ours === null) {
      rows.push({ rok, indicator: name, ours, theirs, match: false, reason: "ONLY_THEIRS" });
      continue;
    }
    if (theirs === null) {
      rows.push({ rok, indicator: name, ours, theirs, match: false, reason: "ONLY_OURS" });
      continue;
    }
    const equal = Math.abs(ours - theirs) < Math.max(1, Math.abs(theirs) * 1e-6);
    rows.push({ rok, indicator: name, ours, theirs, match: equal, reason: equal ? "MATCH" : "MISMATCH" });
  }
  return rows;
}

export function summarizeComparison(rows: ComparisonRow[]): Record<string, unknown> {
  const total = rows.length;
  const match = rows.filter((r) => r.match).length;
  const mismatch = rows.filter((r) => r.reason === "MISMATCH").length;
  const onlyTheirs = rows.filter((r) => r.reason === "ONLY_THEIRS").length;
  const onlyOurs = rows.filter((r) => r.reason === "ONLY_OURS").length;
  const years = [...new Set(rows.map((r) => r.rok))].sort((a, b) => a - b);
  const mismatches = rows.filter((r) => r.reason === "MISMATCH").slice(0, 10).map((r) => `${r.rok}:${r.indicator} ours=${r.ours} theirs=${r.theirs}`);
  return {
    total_rows: total,
    match,
    mismatch,
    only_theirs: onlyTheirs,
    only_ours: onlyOurs,
    years,
    match_pct: total > 0 ? Math.round((match / total) * 100) : null,
    mismatches,
  };
}
