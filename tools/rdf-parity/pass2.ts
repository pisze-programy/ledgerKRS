import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
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
const PACE_MS = Number(process.env.PACE_MS ?? 1200);
const BACKOFF_MS = Number(process.env.BACKOFF_MS ?? 25000);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function robust<T>(fn: () => Promise<T | null>): Promise<T | null> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    if (attempt > 0) {
      await sleep(BACKOFF_MS);
    }
    try {
      const result = await fn();
      if (result !== null) {
        return result;
      }
    } catch {
      // challenge / network — retry
    }
  }
  return null;
}

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
  const existing = existsSync(join(DUMP, "pass2-parity.json"))
    ? (JSON.parse(readFileSync(join(DUMP, "pass2-parity.json"), "utf8")) as Record<string, unknown>)
    : null;
  if (existing) {
    report.picked = existing.picked as string[];
    report.per_company = existing.per_company as Record<string, unknown>;
  }
  const done = new Set(report.picked as string[]);

  const allRows: ComparisonRow[] = [];
  for (const krs of picked) {
    if (done.has(krs)) {
      continue;
    }
    const hits = await robust(() => client.searchDocuments(krs).catch(() => null));
    const annual = hits ? annualStatementHits(hits) : [];
    const ourByYear = new Map<number, YearIndicators>();
    const rzisByYear = new Map<number, Record<string, number | null>>();
    for (const hit of annual) {
      const xml = await robust(() => client.downloadXml(hit.id).catch(() => null));
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
  const agg = { total_rows: 0, match: 0, mismatch: 0, only_theirs: 0, only_ours: 0, mismatches: [] as string[] };
  for (const info of Object.values(report.per_company as Record<string, { summary?: Record<string, unknown> }>)) {
    const s = info.summary;
    if (!s) {
      continue;
    }
    agg.total_rows += (s.total_rows as number) ?? 0;
    agg.match += (s.match as number) ?? 0;
    agg.mismatch += (s.mismatch as number) ?? 0;
    agg.only_theirs += (s.only_theirs as number) ?? 0;
    agg.only_ours += (s.only_ours as number) ?? 0;
    if (Array.isArray(s.mismatches)) {
      agg.mismatches.push(...(s.mismatches as string[]));
    }
  }
  if (agg.total_rows > 0) {
    agg.match_pct = Math.round((agg.match / agg.total_rows) * 100);
  }
  report.summary = agg;
  mkdirSync(DUMP, { recursive: true });
  writeFileSync(join(DUMP, "pass2-parity.json"), JSON.stringify(report, null, 2));
  console.log("picked:", report.picked.length);
  console.log("SUMMARY:", JSON.stringify(report.summary));
}

main().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
