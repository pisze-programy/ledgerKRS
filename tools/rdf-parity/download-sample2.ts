import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright-core";
import { createRdfClient, type RdfSearchHit } from "../../src/sources/rdf/client";
import { parseSprawozdanie } from "../../src/sources/rdf/parser";
import { statementMeta } from "../../src/sources/rdf/layouts";

const CHROMIUM =
  "/Users/krystianblaszczyk/Library/Caches/ms-playwright/chromium-1234/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing";
const CHROME_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36";
const OUT = process.env.OUT ?? "/tmp/rdf-sample2";

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
  headers.set("sec-ch-ua", '"Google Chrome";v="123", "Not:A-Brand";v="8", "Chromium";v="123"');
  headers.set("sec-ch-ua-mobile", "?0");
  headers.set("sec-ch-ua-platform", '"macOS"');
  headers.set("Accept", "application/json");
  return fetch(input, { ...init, headers });
};

const client = createRdfClient({ baseUrl: "https://rdf-przegladarka.ms.gov.pl", transport });

async function withRefresh<T>(fn: () => Promise<T | null>): Promise<T | null> {
  for (let i = 0; i < 5; i += 1) {
    try {
      const v = await fn();
      if (v !== null && v !== undefined) {
        return v;
      }
    } catch {
      // fallthrough
    }
    await refresh();
  }
  return null;
}

function safeName(value: string): string {
  return value.replace(/[^0-9A-Za-z_.-]/g, "_");
}

function xmlFileName(xml: string, index: number): string {
  const okresOd = xml.match(/<[^>]*OkresOd[^>]*>([^<]+)</)?.[1];
  const okresDo = xml.match(/<[^>]*OkresDo[^>]*>([^<]+)</)?.[1];
  if (okresOd && okresDo) {
    return `${safeName(okresOd)}_${safeName(okresDo)}.xml`;
  }
  return `doc-${index}.xml`;
}

async function ingestOne(krs: string): Promise<void> {
  const dir = join(OUT, krs);
  mkdirSync(dir, { recursive: true });
  const hits = (await withRefresh(() => client.searchDocuments(krs))) ?? [];
  const annual = hits.filter((h) => h.rodzaj === "18" || h.rodzaj === "22");
  const downloaded: string[] = [];
  const layouts: string[] = [];
  let index = 0;
  for (const hit of annual) {
    const xml = await withRefresh(() => client.downloadXml(hit.id));
    if (!xml) {
      continue;
    }
    // Only keep real CRWDE statements — banks and some firms file XHTML/PDF
    // wrappers that start with `<?xml` but are not sprawozdania.
    if (!parseSprawozdanie(xml)) {
      continue;
    }
    const name = xmlFileName(xml, index);
    index += 1;
    writeFileSync(join(dir, name), xml);
    downloaded.push(name);
    const meta = statementMeta(xml);
    layouts.push(meta.layout);
  }
  const meta = {
    krs,
    hits_total: hits.length,
    hits_annual: annual.length,
    xml_files: downloaded,
    layouts,
    layout_distinct: [...new Set(layouts)],
    pdf_only: annual.length > 0 && downloaded.length === 0,
    no_annual: annual.length === 0,
    downloaded_at: new Date().toISOString(),
  };
  writeFileSync(join(dir, "meta.json"), JSON.stringify(meta, null, 1));
}

async function main() {
  await refresh();
  if (!cookie) {
    console.error("no cookie");
    process.exit(1);
  }
  const listSource = process.env.LIST ?? join(process.cwd(), "tools", "rdf-parity", "corpus2.json");
  const parsed = JSON.parse(readFileSync(listSource, "utf8")) as
    | { sample: { krs: string }[] }
    | string[];
  const krsList = Array.isArray(parsed) ? parsed : parsed.sample.map((s) => s.krs);

  const limit = Number(process.env.LIMIT ?? 0);
  const start = Number(process.env.START ?? 0);
  const list = limit > 0 ? krsList.slice(start, start + limit) : krsList.slice(start);

  let done = 0;
  for (const krs of list) {
    const dir = join(OUT, krs);
    const already = existsSync(dir) && readdirSync(dir).some((f) => f.endsWith(".xml"));
    if (already && !process.env.FORCE) {
      console.log(`${krs}: skip (already downloaded)`);
      continue;
    }
    await ingestOne(krs);
    done += 1;
    console.log(`${krs}: done (refreshes=${refreshes})`);
  }
  console.log(`done. downloaded=${done} refreshes=${refreshes}`);
}

main().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
