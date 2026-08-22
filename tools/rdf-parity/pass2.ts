import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { loadCreds } from "./creds";
import { makeRdfClient, annualStatementHits, withRetry } from "./rdf";
import { parseSprawozdanie } from "../../src/sources/rdf/parser";
import { fetchBizraportDane } from "./bizraport";
import { ourIndicators, compareYear, summarizeComparison, type ComparisonRow } from "./compare";

const DUMP = join(process.cwd(), "tools", "rdf-parity", "dump");
const PACE_MS = Number(process.env.PACE_MS ?? 1000);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
  const xmlCompanies = pass1.results.filter((r) => r.status === "HAS_XML").map((r) => r.krs);
  const budget = Number(process.env.BUDGET ?? 15);
  const picked = xmlCompanies.slice(0, budget);

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
    const ourByYear = new Map<number, ReturnType<typeof ourIndicators>>();
    for (const hit of annual) {
      const xml = await withRetry(() => client.downloadXml(hit.id));
      if (!xml) continue;
      const statement = parseSprawozdanie(xml);
      if (!statement) continue;
      const year = statement.rok ?? Number(hit.okresSprawozdawczyKoniec?.slice(0, 4));
      if (year) ourByYear.set(year, ourIndicators(statement));
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
        companyRows.push(...compareYear(year, our, their));
      }
    }
    allRows.push(...companyRows);
    report.per_company[krs] = {
      our_years: [...ourByYear.keys()].sort((a, b) => a - b),
      their_years: [...theirByYear.keys()].sort((a, b) => a - b),
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
