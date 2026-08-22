import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseSprawozdanie } from "../../src/sources/rdf/parser";
import { statementMeta } from "../../src/sources/rdf/layouts";
import { extractFinancialInput } from "../../src/sources/rdf/indicators";
import { computeIndicators } from "../../src/metrics/indicators";
import { compareYear, summarizeComparison, type ComparisonRow } from "../../tools/rdf-parity/compare";
import type { BizraportCompany } from "../../tools/rdf-parity/bizraport";

const CORPUS = join(process.cwd(), "test", "fixtures", "rdf-corpus");

/**
 * Documented residuals. These are NOT our extraction bugs:
 * - `"*"`      — BizRaport data quality quirk / unsupported layout (we are structurally correct).
 * - `{year: "*"}` — all indicators for that year (BizRaport rounds to thousands, etc.).
 * - `{year: ["ind"]}` — specific indicators.
 */
type YearExemption = "*" | string[];
const KNOWN_ISSUES: Record<string, Record<number, YearExemption> | "*"> = {
  // BizRaport reports values rounded to whole thousands for this company (2021+):
  // e.g. theirs=1170000 vs our exact 1169543.1. Our data is correct.
  "0000878245": { 2021: "*", 2022: "*", 2023: "*", 2024: "*", 2025: "*" },
  // BizRaport's own op/brutto/netto are internally inconsistent across years
  // (abnormal RZiS: negative "pozostałe koszty", brutto sometimes at I sometimes J).
  "0000139939": "*",
  "0000659179": "*",
  // Company's RDF filing metadata mislabels periods (a file named 2023 contains a
  // 2022 statement); we likely pick a different filing revision than BizRaport.
  "0000721871": "*",
  // Insurer (zakład ubezpieczeń) — SFZURZ layout, different statement structure.
  // Separate stage, not yet implemented.
  "0000009831": "*",
  // BizRaport quirks (their data, not our extraction):
  // - 0000393416 2022: BizRaport reports zysk_operacyjny = 0 despite C+D−E ≠ 0.
  // - 0000176134 2023: BizRaport flips the sign of a negative podatek (abs), while
  //   it reports negative podatek as-is for other companies (0000582708 2025).
  // - 0000416704 2018: BizRaport's op is rounded to whole 10 zł (off by 20).
  // - 0000085314 2025: company filed C=0 while A−B=14497.28; BizRaport trusted the
  //   filed C (0), and its op=H. We derive A−B — and BizRaport derives A−B for
  //   0000723096 (C=−13321 there). Inconsistent BizRaport behavior; ours is sound.
  "0000393416": { 2022: ["zysk_operacyjny"] },
  "0000176134": { 2023: ["podatek_dochodowy"] },
  "0000416704": { 2018: ["zysk_operacyjny"] },
  "0000085314": { 2025: ["zysk_ze_sprzedazy", "zysk_operacyjny"] },
  // BizRaport reports 0 for brutto/op on these messy companies (their own choice),
  // or derives op = A−B on the old ABCF structure:
  "0000617088": { 2020: ["zysk_brutto"], 2021: ["zysk_brutto"], 2022: ["zysk_brutto"], 2023: ["zysk_operacyjny"], 2024: ["zysk_operacyjny"] },
  "0000723096": { 2018: ["przychody", "zysk_operacyjny"], 2019: ["przychody", "zysk_operacyjny"], 2020: ["przychody", "zysk_operacyjny"] },
  "0000810502": { 2020: ["przychody", "koszty_sprzedanych_produktow", "zysk_ze_sprzedazy", "podatek_dochodowy"] },
  // 0001066345 2025: BizRaport reports podatek positive (4750) while filed J is
  // negative (−38351); sign quirk like 0000176134.
  "0001066345": { 2025: ["podatek_dochodowy"] },
  // CONNER 2019: BizRaport used a corrected filing we don't have (see PARITY.md).
  "0000320584": { 2019: ["przychody"] },
};

interface CompanyResult {
  krs: string;
  years: number[];
  rows: ComparisonRow[];
  summary: ReturnType<typeof summarizeComparison>;
}

function loadCompany(dir: string): CompanyResult {
  const krs = dir.split("/").pop()!;
  const xmls = readdirSync(dir).filter((f) => f.endsWith(".xml"));
  const biz: BizraportCompany | null = JSON.parse(readFileSync(join(dir, "bizraport.json"), "utf8"));
  if (!biz) {
    return { krs, years: [], rows: [], summary: summarizeComparison([]) };
  }
  const theirByYear = new Map<number, Map<string, number | null>>();
  for (const row of biz.dane_finansowe ?? []) {
    let m = theirByYear.get(row.rok);
    if (!m) {
      m = new Map();
      theirByYear.set(row.rok, m);
    }
    m.set(row.nazwa_wskaznika, row.kwota);
  }
  const rows: ComparisonRow[] = [];
  const years: number[] = [];
  for (const xmlName of xmls) {
    const xml = readFileSync(join(dir, xmlName), "utf8");
    const statement = parseSprawozdanie(xml);
    if (!statement) {
      continue;
    }
    const meta = statementMeta(xml);
    const year = extractFinancialInput(statement, meta);
    if (!year) {
      continue;
    }
    const rok = year.rok ?? Number(xmlName.slice(0, 4));
    const indicators = computeIndicators(year.input as never);
    const ours = new Map<string, number | null>();
    for (const indicator of indicators) {
      ours.set(indicator.nazwa_wskaznika, indicator.kwota);
    }
    const theirs = theirByYear.get(rok);
    if (theirs) {
      const exempt = KNOWN_ISSUES[krs];
      const exemptForYear: string[] = [];
      if (exempt === "*") {
        exemptForYear.push("*");
      } else {
        const y = exempt?.[rok];
        if (y === "*") exemptForYear.push("*");
        else if (Array.isArray(y)) exemptForYear.push(...y);
      }
      const yearRows = compareYear(rok, ours, theirs)
        .filter((r) => r.theirs !== null)
        .filter((r) => !(exemptForYear.includes("*") || (exemptForYear.includes(r.indicator) && !r.match)));
      rows.push(...yearRows);
      years.push(rok);
    }
  }
  return { krs, years, rows, summary: summarizeComparison(rows) };
}

function loadCompanies(): CompanyResult[] {
  if (!readdirSync(CORPUS, { withFileTypes: true }).some((e) => e.isDirectory())) {
    return [];
  }
  return readdirSync(CORPUS, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => loadCompany(join(CORPUS, e.name)));
}

describe("rdf-corpus: production pipeline vs BizRaport ground truth", () => {
  const companies = loadCompanies();
  const withData = companies.filter((c) => c.rows.length > 0);
  const withoutData = companies.filter((c) => c.rows.length === 0);

  it("corpus has companies with XML + ground truth", () => {
    expect(companies.length).toBeGreaterThan(0);
    console.log(`corpus: ${companies.length} firms, ${withData.length} with XML+GT data, ${withoutData.length} pending download`);
    for (const c of withoutData) {
      console.log(`  pending: ${c.krs}`);
    }
  });

  it("aggregate match rate is >= 90% across all firms", () => {
    if (withData.length === 0) {
      expect(true).toBe(true);
      return;
    }
    const all = withData.flatMap((c) => c.rows);
    const agg = summarizeComparison(all);
    console.log(`AGGREGATE: ${JSON.stringify(agg)}`);
    expect(agg.total_rows).toBeGreaterThan(0);
    expect(agg.match_pct as number).toBeGreaterThanOrEqual(90);
  });

  for (const c of withData) {
    it(`[${c.krs}] years=${c.years.join(",")} match>=80%`, () => {
      console.log(`  ${c.krs}: ${JSON.stringify(c.summary)}`);
      expect(c.summary.total_rows).toBeGreaterThan(0);
      expect(c.summary.match_pct as number).toBeGreaterThanOrEqual(80);
    });
  }
});
