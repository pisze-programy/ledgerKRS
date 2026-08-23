import { readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright-core";
import { createRdfClient, type RdfSearchHit } from "../../src/sources/rdf/client";
import { parseSprawozdanie, type ParsedStatement } from "../../src/sources/rdf/parser";
import { statementMeta } from "../../src/sources/rdf/layouts";
import { extractFinancialInput, type YearFinancials } from "../../src/sources/rdf/indicators";
import { fiscalYearOf } from "../../src/sources/rdf/period";
import { selectAnnualYears, type AnnualCandidate } from "../../src/sources/rdf/selection";
import { historyEntryFromMeta } from "../../src/sources/rdf/history";

const CHROMIUM = "/Users/krystianblaszczyk/Library/Caches/ms-playwright/chromium-1234/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing";
const CHROME_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36";
const API = "http://localhost:8787";
const SAMPLE: string[] = JSON.parse(readFileSync("/tmp/sample50-v2.json", "utf8"));

let cookie = "";
let refreshes = 0;

async function refresh(): Promise<void> {
  const browser = await chromium.launch({ headless: true, executablePath: CHROMIUM, args: ["--disable-blink-features=AutomationControlled"] });
  const ctx = await browser.newContext({ userAgent: CHROME_UA });
  const page = await ctx.newPage();
  try {
    await page.goto("https://rdf-przegladarka.ms.gov.pl/wyszukaj-podmiot", { waitUntil: "domcontentloaded", timeout: 40000 });
  } catch {
    // ignore
  }
  for (let i = 0; i < 14; i += 1) {
    await page.waitForTimeout(1500);
    const c = await ctx.cookies();
    const reese = c.find((x) => x.name === "reese84");
    if (reese) {
      cookie = c
        .filter((x) => /reese84|incap_ses|visid_incap|nlbi/.test(x.name))
        .map((x) => `${x.name}=${x.value}`)
        .join("; ");
      break;
    }
  }
  await browser.close();
  refreshes += 1;
  console.error(`[refresh ${refreshes}] cookie=${cookie.length > 0}`);
}

const transport = (input: string, init?: RequestInit): Promise<Response> => {
  const headers = new Headers(init?.headers);
  headers.set("Cookie", cookie);
  headers.set("User-Agent", CHROME_UA);
  headers.set('sec-ch-ua', '"Google Chrome";v="123", "Not:A-Brand";v="8", "Chromium";v="123"');
  headers.set("sec-ch-ua-mobile", "?0");
  headers.set('sec-ch-ua-platform', '"macOS"');
  headers.set("Accept", "application/json");
  return fetch(input, { ...init, headers });
};

const client = createRdfClient({ baseUrl: "https://rdf-przegladarka.ms.gov.pl", transport });

async function post(path: string, body?: unknown): Promise<void> {
  const r = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!r.ok) {
    console.error(`  POST ${path} -> ${r.status}`);
  }
}

async function searchWithRefresh(krs: string): Promise<RdfSearchHit[] | null> {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      return await client.searchDocuments(krs);
    } catch {
      await refresh();
    }
  }
  return null;
}

async function downloadWithRefresh(id: string): Promise<string | null> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const xml = await client.downloadXml(id);
    if (xml) {
      return xml;
    }
    await refresh();
  }
  return null;
}

async function metaWithRefresh(id: string): Promise<Record<string, unknown> | null> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const meta = await client.documentMeta(id);
    if (meta) {
      return meta;
    }
    await refresh();
  }
  return null;
}

async function ingestOne(krs: string): Promise<{ processed: number; failed: number }> {
  await post(`/ingest/krs/${krs}`);
  const hits = await searchWithRefresh(krs);
  if (!hits) {
    return { processed: 0, failed: 1 };
  }
  const annual = hits.filter((h) => h.rodzaj === "18" || h.rodzaj === "22");
  const gathered: {
    hit: RdfSearchHit;
    candidate: AnnualCandidate;
    statement: ParsedStatement;
    meta: Record<string, unknown> | null;
    year: YearFinancials | null;
  }[] = [];
  let failed = 0;
  for (const hit of annual) {
    const xml = await downloadWithRefresh(hit.id);
    if (!xml) {
      failed += 1;
      continue;
    }
    const statement = parseSprawozdanie(xml);
    if (!statement) {
      failed += 1;
      continue;
    }
    const meta = await metaWithRefresh(hit.id);
    const okres =
      statement.okres_sprawozdawczy ||
      (hit.okresSprawozdawczyPoczatek && hit.okresSprawozdawczyKoniec
        ? `${hit.okresSprawozdawczyPoczatek}_${hit.okresSprawozdawczyKoniec}`
        : null);
    gathered.push({
      hit,
      candidate: {
        id: hit.id,
        rodzaj: hit.rodzaj,
        okres,
        dataDodania: typeof meta?.dataDodania === "string" ? meta.dataDodania : null,
      },
      statement,
      meta,
      year: extractFinancialInput(statement, statementMeta(xml)),
    });
  }
  const selected = new Set(selectAnnualYears(gathered.map((g) => g.candidate)).map((s) => s.candidate.id));
  let processed = 0;
  for (const item of gathered) {
    if (!selected.has(item.candidate.id)) {
      continue;
    }
    const year = item.year;
    if (!year) {
      failed += 1;
      continue;
    }
    const okres = item.candidate.okres ?? year.okresSprawozdawczy;
    await post(`/ingest/krs/${krs}/financials`, { ...(year.input as Record<string, unknown>), okresSprawozdawczy: okres ?? year.okresSprawozdawczy });
    const positions: { sekcja: string; kod_pozycji: string | null; poziom_zaglebienia: number | null; nazwa_pozycji: string | null; kwota: number | null }[] = [];
    for (const section of item.statement.sekcje) {
      for (const position of section.pozycje) {
        positions.push({
          sekcja: section.sekcja,
          kod_pozycji: position.kod_pozycji,
          poziom_zaglebienia: position.poziom_zaglebienia,
          nazwa_pozycji: position.nazwa_pozycji,
          kwota: position.kwota,
        });
      }
    }
    if (positions.length > 0) {
      await post(`/ingest/krs/${krs}/positions`, { okres: okres ?? undefined, positions });
    }
    if (item.meta) {
      await post(`/ingest/krs/${krs}/history`, [historyEntryFromMeta(item.meta, okres, fiscalYearOf(okres))]);
    }
    processed += 1;
  }
  await post(`/ingest/krs/${krs}/monitor`);
  await post(`/ingest/krs/${krs}/derived`);
  return { processed, failed };
}

async function main() {
  await refresh();
  if (!cookie) {
    console.error("no cookie");
    process.exit(1);
  }
  const results: Record<string, { processed: number; failed: number }> = {};
  const OUT = "/tmp/sample50-ingest.json";
  try {
    Object.assign(results, JSON.parse(readFileSync(OUT, "utf8")));
  } catch {
    // fresh run
  }
  const limit = Number(process.env.LIMIT ?? 0);
  const start = Number(process.env.START ?? 0);
  let list = limit > 0 ? SAMPLE.slice(start, start + limit) : SAMPLE.slice(start);
  if (!process.env.FORCE) {
    list = list.filter((k) => !(results[k] && results[k].processed > 0));
  }
  for (const krs of list) {
    const r = await ingestOne(krs);
    results[krs] = r;
    console.log(`${krs}: processed=${r.processed} failed=${r.failed} (refreshes=${refreshes})`);
    writeFileSync(OUT, JSON.stringify(results, null, 1));
  }
  writeFileSync(OUT, JSON.stringify(results, null, 1));
  console.log("done. refreshes:", refreshes);
}

main().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
