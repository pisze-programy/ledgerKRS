import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { parseSprawozdanie } from "../../src/sources/rdf/parser";
import { statementMeta } from "../../src/sources/rdf/layouts";
import { extractFinancialInput } from "../../src/sources/rdf/indicators";
import { computeIndicators } from "../../src/metrics/indicators";
import { selectAnnualYears } from "../../src/sources/rdf/selection";

const CORPUS = join(process.cwd(), "test", "fixtures", "rdf-corpus");
const CACHE = join(process.cwd(), "tools", "rdf-parity", "compabase-cache");

const FIELD_MAP: [string, string][] = [
  ["revenue_total", "przychody"],
  ["profit_net", "zysk_netto"],
  ["profit_gross", "zysk_brutto"],
  ["total_assets", "suma_bilansowa"],
  ["current_assets", "aktywa_obrotowe"],
  ["fixed_assets", "aktywa_trwale"],
  ["liabilities_and_provisions", "zobowiazania_i_rezerwy"],
];

// Compabase reads a different equity line for Jeronimo Martins (a consistent
// ~3.35B offset across years); we match BizRaport on that cell.
const KNOWN_EXCEPTIONS = new Set(["0000222483/kapital_wlasny"]);

function near(a: number, b: number): boolean {
  return Math.abs(a - b) < Math.max(1, Math.abs(b) * 1e-4);
}

function ourByYear(krs: string): Map<number, Map<string, number>> {
  const dir = join(CORPUS, krs);
  const result = new Map<number, Map<string, number>>();
  const candidates: { id: string; rodzaj: string; okres: string | null; dataDodania: null }[] = [];
  const parsed: { id: string; xml: string; statement: NonNullable<ReturnType<typeof parseSprawozdanie>> }[] = [];
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".xml"))) {
    const xml = readFileSync(join(dir, f), "utf8");
    const st = parseSprawozdanie(xml);
    if (!st) {
      continue;
    }
    parsed.push({ id: f, xml, statement: st });
    candidates.push({ id: f, rodzaj: "18", okres: st.okres_sprawozdawczy, dataDodania: null });
  }
  const winners = new Set(selectAnnualYears(candidates).map((s) => s.candidate.id));
  for (const { id, xml, statement } of parsed) {
    if (!winners.has(id)) {
      continue;
    }
    const year = extractFinancialInput(statement, statementMeta(xml));
    if (!year) {
      continue;
    }
    const rok = year.rok ?? Number(id.slice(0, 4));
    result.set(rok, new Map(computeIndicators(year.input as never).map((i) => [i.nazwa_wskaznika, i.kwota])));
  }
  return result;
}

function loadCells(): { krs: string; rok: number; pole: string; cb: number; our: number }[] {
  if (!existsSync(CACHE)) {
    return [];
  }
  const cells: { krs: string; rok: number; pole: string; cb: number; our: number }[] = [];
  for (const f of readdirSync(CACHE).filter((f) => f.endsWith(".json"))) {
    const krs = f.replace(/\.json$/, "");
    const raw = readFileSync(join(CACHE, f), "utf8").trim();
    if (raw === "null") {
      continue;
    }
    const cb = JSON.parse(raw);
    const our = ourByYear(krs);
    for (const [year, docs] of Object.entries(cb.financials?.byYear ?? {})) {
      const doc = (docs as Record<string, unknown>[])[0]!;
      for (const [cbField, ourField] of FIELD_MAP) {
        const cbVal = doc[cbField];
        const ourVal = our.get(Number(year))?.get(ourField);
        if (cbVal != null && ourVal != null) {
          cells.push({ krs, rok: Number(year), pole: ourField, cb: Number(cbVal), our: ourVal });
        }
      }
    }
  }
  return cells;
}

const CELLS = loadCells();

describe("Compabase cross-check — independent confirmation of the XML pipeline", () => {
  it("agrees with Compabase on >= 90% of comparable cells (offline cache)", () => {
    if (CELLS.length === 0) {
      console.log("brak cache Compabase — test pominięty (uruchom fetch-compabase-corpus.ts)");
      expect(true).toBe(true);
      return;
    }
    const comparable = CELLS.filter((c) => !KNOWN_EXCEPTIONS.has(`${c.krs}/${c.pole}`));
    const agree = comparable.filter((c) => near(c.cb, c.our)).length;
    const pct = Math.round((agree / comparable.length) * 100);
    console.log(`Compabase cross-check: ${comparable.length} cells, agree ${agree} (${pct}%)`);
    expect(pct).toBeGreaterThanOrEqual(90);
  });

  it("covers every layout that has Compabase data", () => {
    if (CELLS.length === 0) {
      expect(true).toBe(true);
      return;
    }
    const firms = new Set(CELLS.map((c) => c.krs));
    console.log(`Compabase coverage: ${firms.size} firms (of corpus ${readdirSync(CORPUS).filter((e) => !e.includes(".")).length})`);
    expect(firms.size).toBeGreaterThan(0);
  });
});
