import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { parseSprawozdanie } from "../../src/sources/rdf/parser";
import { statementMeta } from "../../src/sources/rdf/layouts";
import { extractFinancialInput } from "../../src/sources/rdf/indicators";
import { computeIndicators } from "../../src/metrics/indicators";
import { selectAnnualYears } from "../../src/sources/rdf/selection";

const CORPUS = join(process.cwd(), "test", "fixtures", "rdf-corpus");
const CACHE = join(process.cwd(), "tools", "rdf-parity", "compabase-cache");

/** Map Compabase field -> our canonical indicator name. */
const FIELD_MAP: [string, string][] = [
  ["revenue_total", "przychody"],
  ["profit_net", "zysk_netto"],
  ["profit_gross", "zysk_brutto"],
  ["total_assets", "suma_bilansowa"],
  ["equity", "kapital_wlasny"],
  ["current_assets", "aktywa_obrotowe"],
  ["fixed_assets", "aktywa_trwale"],
  ["liabilities_and_provisions", "zobowiazania_i_rezerwy"],
];

function near(a: number | null | undefined, b: number | null | undefined): boolean {
  if (a == null || b == null) {
    return false;
  }
  return Math.abs(a - b) < Math.max(1, Math.abs(b) * 1e-4);
}

/** Our extracted indicators per year for a corpus firm (production pipeline). */
function ourByYear(krs: string): Map<number, Map<string, number>> {
  const dir = join(CORPUS, krs);
  const result = new Map<number, Map<string, number>>();
  const candidates: { id: string; okres: string | null }[] = [];
  const parsed: { id: string; statement: ReturnType<typeof parseSprawozdanie> }[] = [];
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".xml"))) {
    const xml = readFileSync(join(dir, f), "utf8");
    const st = parseSprawozdanie(xml);
    if (!st) {
      continue;
    }
    parsed.push({ id: f, statement: st });
    candidates.push({ id: f, okres: st.okres_sprawozdawczy });
  }
  const winners = new Set(selectAnnualYears(candidates).map((s) => s.candidate.id));
  for (const { id, statement } of parsed) {
    if (!winners.has(id)) {
      continue;
    }
    const meta = statementMeta(readFileSync(join(dir, id), "utf8"));
    const year = extractFinancialInput(statement, meta);
    if (!year) {
      continue;
    }
    const rok = year.rok ?? Number(id.slice(0, 4));
    const inds = new Map(computeIndicators(year.input as never).map((i) => [i.nazwa_wskaznika, i.kwota]));
    result.set(rok, inds);
  }
  return result;
}

function bizraportByYear(krs: string): Map<number, Map<string, number>> {
  const b = JSON.parse(readFileSync(join(CORPUS, krs, "bizraport.json"), "utf8"));
  const by = new Map<number, Map<string, number>>();
  for (const r of b?.dane_finansowe ?? []) {
    let m = by.get(r.rok);
    if (!m) {
      m = new Map();
      by.set(r.rok, m);
    }
    m.set(r.nazwa_wskaznika, r.kwota);
  }
  return by;
}

interface Cell {
  krs: string;
  rok: number;
  pole: string;
  cb: number | null;
  biz: number | null;
  our: number | null;
}

function main(): void {
  const rows: Cell[] = [];
  let comparedFirms = 0;
  for (const f of readdirSync(CACHE).filter((f) => f.endsWith(".json"))) {
    const krs = f.replace(/\.json$/, "");
    const raw = readFileSync(join(CACHE, f), "utf8").trim();
    if (raw === "null") {
      continue;
    }
    const cb = JSON.parse(raw);
    const our = ourByYear(krs);
    const biz = bizraportByYear(krs);
    let firmCells = 0;
    for (const [year, docs] of Object.entries(cb.financials?.byYear ?? {})) {
      const rok = Number(year);
      const doc = docs[0]!;
      for (const [cbField, ourField] of FIELD_MAP) {
        const cbVal = doc[cbField] != null ? Number(doc[cbField]) : null;
        const ourVal = our.get(rok)?.get(ourField) ?? null;
        const bizVal = biz.get(rok)?.get(ourField) ?? null;
        if (cbVal !== null || bizVal !== null || ourVal !== null) {
          rows.push({ krs, rok, pole: ourField, cb: cbVal, biz: bizVal, our: ourVal });
          firmCells += 1;
        }
      }
    }
    if (firmCells > 0) {
      comparedFirms += 1;
    }
  }

  const both = rows.filter((r) => r.cb !== null && r.our !== null);
  const ourCbAgree = both.filter((r) => near(r.cb, r.our)).length;
  const bizCbAgree = rows.filter((r) => r.cb !== null && r.biz !== null && near(r.cb, r.biz)).length;
  const ourBizAgree = rows.filter((r) => r.our !== null && r.biz !== null && near(r.our, r.biz)).length;

  console.log(`Compabase-vs-our comparison: ${comparedFirms} firms, ${rows.length} cells`);
  console.log(`  cells with both cb+our: ${both.length}, agree: ${ourCbAgree} (${both.length ? Math.round((ourCbAgree / both.length) * 100) : 0}%)`);
  console.log(`  cells with both cb+biz: ${rows.filter((r) => r.cb !== null && r.biz !== null).length}, agree: ${bizCbAgree}`);
  console.log(`  cells with both our+biz: ${rows.filter((r) => r.our !== null && r.biz !== null).length}, agree: ${ourBizAgree}`);

  const mismatches = both.filter((r) => !near(r.cb, r.our));
  console.log(`\nMismatches (cb vs our):`);
  for (const m of mismatches.slice(0, 20)) {
    console.log(`  ${m.krs} ${m.rok} ${m.pole}: cb=${m.cb} our=${m.our} biz=${m.biz}`);
  }
  const cbOnly = rows.filter((r) => r.cb !== null && r.our === null);
  console.log(`\nCells Compabase has but we don't: ${cbOnly.length}`);
  for (const r of cbOnly.slice(0, 10)) {
    console.log(`  ${r.krs} ${r.rok} ${r.pole}: cb=${r.cb} biz=${r.biz}`);
  }
}

main();
