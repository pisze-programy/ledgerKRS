import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { loadCreds } from "./creds";
import { makeRdfClient, annualStatementHits, withRetry } from "./rdf";
import { parseSprawozdanie } from "../../src/sources/rdf/parser";
import { statementMeta } from "../../src/sources/rdf/layouts";
import { extractFinancialInput } from "../../src/sources/rdf/indicators";
import { computeIndicators } from "../../src/metrics/indicators";
import { fetchBizraportDane } from "./bizraport";
import { summarizeComparison, type ComparisonRow } from "./compare";

const DUMP = join(process.cwd(), "tools", "rdf-parity", "dump");
const PACE_MS = Number(process.env.PACE_MS ?? 1000);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface YearIndicators {
  rok: number;
  values: Map<string, number | null>;
}

function productionIndicators(xml: string, hitOkres: string | null): YearIndicators | null {
  const statement = parseSprawozdanie(xml);
  if (!statement) {
    return null;
  }
  const meta = statementMeta(xml);
  const year = extractFinancialInput(statement, meta);
  if (!year) {
    return null;
  }
  const rok = year.rok ?? Number(hitOkres?.slice(0, 4));
  const indicators = computeIndicators(year.input as never);
  const values = new Map<string, number | null>();
  for (const indicator of indicators) {
    values.set(indicator.nazwa_wskaznika, indicator.kwota);
  }
  return { rok, values };
}

function compareYear(rok: number, ours: Map<string, number | null>, theirs: Map<string, number | null>): ComparisonRow[] {
  const rows: ComparisonRow[] = [];
  for (const [name, ourValue] of ours) {
    const theirValue = theirs.get(name) ?? null;
    if (theirValue === null) {
      continue;
    }
    if (ourValue === null) {
      rows.push({ rok, indicator: name, ours: null, theirs: theirValue, match: false, reason: "ONLY_THEIRS" });
      continue;
    }
    const match = Math.abs(ourValue - theirValue) < Math.max(1, Math.abs(theirValue) * 1e-4);
    rows.push({ rok, indicator: name, ours: ourValue, theirs: theirValue, match, reason: match ? "MATCH" : "MISMATCH" });
  }
  return rows;
}

interface Pass1Entry {
  krs: string;
  status: string;
}

async function main() {
  const creds = loadCreds();
  if (!creds.rdfCookie) {
    throw new Error("RDF_COOKIE required");
  }
  if (!creds.bizraportEmail || !creds.bizraportPassword) {
    throw new Error("BizRaport creds required");
  }
  const client = makeRdfClient(creds.rdfCookie);
  const pass1 = JSON.parse(readFileSync(join(DUMP, "pass1-structural.json"), "utf8")) as {
    results: Pass1Entry[];
  };
  const xmlCompanies = pass1.results.filter((r) => r.status === "HAS_XML");
  const budget = Number(process.env.BUDGET ?? 15);
  const byLayout = new Map<string, string[]>();
  for (const r of xmlCompanies) {
    const key = (r.layout as string) ?? "Bilans";
    const list = byLayout.get(key) ?? [];
    list.push(r.krs as string);
    byLayout.set(key, list);
  }
  const picked: string[] = [];
  const layouts = [...byLayout.keys()];
  let round = 0;
  while (picked.length < budget) {
    let added = false;
    for (const layout of layouts) {
      const list = byLayout.get(layout)!;
      if (round < list.length) {
        picked.push(list[round]!);
        added = true;
      }
    }
    if (!added) break;
    round += 1;
  }

  const report: Record<string, unknown> = {
    generated_at: new Date().toISOString(),
    picked: [],
    per_company: {},
    summary: null,
  };

  const allRows: ComparisonRow[] = [];
  for (const krs of picked) {
    const hits = await withRetry(() => client.searchDocuments(krs));
    const annual = hits ? annualStatementHits(hits) : [];
    const ourByYear = new Map<number, YearIndicators>();
    const rzisByYear = new Map<number, Record<string, number | null>>();
    for (const hit of annual) {
      const xml = await withRetry(() => client.downloadXml(hit.id));
      if (!xml) continue;
      const production = productionIndicators(xml, hit.okresSprawozdawczyKoniec);
      if (production) {
        ourByYear.set(production.rok, production);
      }
      const statement = parseSprawozdanie(xml);
      if (statement) {
        const year = statement.rok ?? Number(hit.okresSprawozdawczyKoniec?.slice(0, 4));
        const rzis = statement.sekcje.find((s) => s.sekcja === "Rachunek zysków i strat");
        if (year && rzis) {
          const codes: Record<string, number | null> = {};
          for (const p of rzis.pozycje) {
            if (p.kod_pozycji && /^[A-Z]{1,2}$/.test(p.kod_pozycji)) codes[p.kod_pozycji] = p.kwota;
          }
          rzisByYear.set(year, codes);
        }
      }
      await sleep(PACE_MS);
    }
    const biz = await fetchBizraportDane(creds, krs);
    const theirByYear = new Map<number, Map<string, number | null>>();
    for (const row of biz?.dane_finansowe ?? []) {
      let m = theirByYear.get(row.rok);
      if (!m) {
        m = new Map();
        theirByYear.set(row.rok, m);
      }
      m.set(row.nazwa_wskaznika, row.kwota);
    }
    const companyRows: ComparisonRow[] = [];
    for (const [year, our] of ourByYear) {
      const their = theirByYear.get(year);
      if (their) {
        companyRows.push(...compareYear(year, our.values, their));
      }
    }
    allRows.push(...companyRows);
    report.per_company[krs] = {
      our_years: [...ourByYear.keys()].sort((a, b) => a - b),
      their_years: [...theirByYear.keys()].sort((a, b) => a - b),
      rzis: Object.fromEntries(rzisByYear),
      theirs: Object.fromEntries([...theirByYear.entries()].map(([y, m]) => [String(y), Object.fromEntries(m)])),
      rows: companyRows.length,
      summary: summarizeComparison(companyRows),
    };
    report.picked.push(krs);
    await sleep(PACE_MS);
  }
  report.summary = summarizeComparison(allRows);
  mkdirSync(DUMP, { recursive: true });
  writeFileSync(join(DUMP, "pass2-parity.json"), JSON.stringify(report, null, 2));
  console.log("picked:", report.picked.length);
  console.log("SUMMARY:", JSON.stringify(report.summary));
}

main().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
