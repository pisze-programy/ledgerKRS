import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseSprawozdanie } from "../../src/sources/rdf/parser";
import { statementMeta } from "../../src/sources/rdf/layouts";
import { extractFinancialInput } from "../../src/sources/rdf/indicators";
import { computeIndicators } from "../../src/metrics/indicators";
import { selectAnnualYears, type AnnualCandidate } from "../../src/sources/rdf/selection";
import { compareYear, summarizeComparison, type ComparisonRow } from "../../tools/rdf-parity/compare";
import type { BizraportCompany } from "../../tools/rdf-parity/bizraport";

const CORPUS = join(process.cwd(), "test", "fixtures", "rdf-corpus");

import { KNOWN_ISSUES, isKnownIssue } from "./known-issues";

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
  // Mirror the production pipeline: one primary statement per fiscal year.
  const candidates: AnnualCandidate[] = [];
  const parsed = new Map<string, { xml: string; statement: NonNullable<ReturnType<typeof parseSprawozdanie>>; meta: ReturnType<typeof statementMeta> }>();
  for (const xmlName of xmls) {
    const xml = readFileSync(join(dir, xmlName), "utf8");
    const statement = parseSprawozdanie(xml);
    if (!statement) {
      continue;
    }
    const meta = statementMeta(xml);
    parsed.set(xmlName, { xml, statement, meta });
    candidates.push({
      id: xmlName,
      rodzaj: "18",
      okres: statement.okres_sprawozdawczy,
      dataDodania: null,
    });
  }
  const winners = new Set(selectAnnualYears(candidates).map((s) => s.candidate.id));
  for (const [xmlName, { statement, meta }] of parsed) {
    if (!winners.has(xmlName)) {
      continue;
    }
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

  it("STRICT: every residual is documented (0 unexplained mismatches, 0 only_theirs)", () => {
    if (withData.length === 0) {
      expect(true).toBe(true);
      return;
    }
    const all = withData.flatMap((c) => c.rows);
    const agg = summarizeComparison(all);
    console.log(`STRICT aggregate: ${JSON.stringify(agg)}`);
    expect(agg.mismatch).toBe(0);
    expect(agg.only_theirs).toBe(0);
  });

  for (const c of withData) {
    it(`[${c.krs}] years=${c.years.join(",")} match>=80%`, () => {
      console.log(`  ${c.krs}: ${JSON.stringify(c.summary)}`);
      expect(c.summary.total_rows).toBeGreaterThan(0);
      expect(c.summary.match_pct as number).toBeGreaterThanOrEqual(80);
    });
  }
});
