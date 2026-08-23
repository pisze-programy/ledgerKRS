import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright-core";
import { createRdfClient, isXmlCapable, isHtmlCapable, isPdfCapable } from "../../src/sources/rdf/client";

const CHROMIUM =
  "/Users/krystianblaszczyk/Library/Caches/ms-playwright/chromium-1234/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing";
const CHROME_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36";
const OUT = join(process.cwd(), "tools", "rdf-parity", "discover");

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
      cookie = c.filter((x) => /reese84|incap_ses|visid_incap|nlbi/.test(x.name)).map((x) => `${x.name}=${x.value}`).join("; ");
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

/** Classify a raw document payload. */
function classify(raw: string): "XML" | "XHTML" | "BINARY_PDF" | "HTML" | "OTHER" {
  if (!raw) {
    return "OTHER";
  }
  const head = raw.slice(0, 2000);
  if (head.startsWith("%PDF")) {
    return "BINARY_PDF";
  }
  if (head.includes("<?xml") && /<html[\s>]/i.test(head)) {
    return "XHTML";
  }
  if (/<html[\s>]/i.test(head)) {
    return "HTML";
  }
  if (head.includes("<?xml") || /<[A-Za-z0-9]+:?[A-Za-z]/i.test(head)) {
    return "XML";
  }
  return "OTHER";
}

async function main(): Promise<void> {
  await refresh();
  const list = (process.argv[2] ?? "0000014843,0000005455,0000025237,0000008723,0000305178,0000021371,0000009831")
    .split(",")
    .filter(Boolean);
  mkdirSync(OUT, { recursive: true });
  const report: Record<string, unknown> = {};
  for (const krs of list) {
    const hits = (await withRefresh(() => client.searchDocuments(krs))) ?? [];
    const annual = hits.filter((h) => h.rodzaj === "18" || h.rodzaj === "22");
    const docs: { id: string; metaCap: string; rawCap: string; size: number }[] = [];
    for (const h of annual.slice(0, 3)) {
      const meta = await withRefresh(() => client.documentMeta(h.id));
      const metaCap = meta
        ? [isXmlCapable(meta) ? "XML" : null, isHtmlCapable(meta) ? "HTML" : null, isPdfCapable(meta) ? "PDF" : null].filter(Boolean).join("+") || "none"
        : "no-meta";
      const raw = await withRefresh(() => client.downloadRaw(h.id));
      const cap = raw ? classify(raw) : "null";
      // save the first binary PDF per firm for text-extraction testing
      if (cap === "BINARY_PDF" && !report[krs]?.pdfPath) {
        const path = join(OUT, `${krs}-${h.id.slice(0, 8)}.pdf`);
        writeFileSync(path, raw!);
        (report[krs] as Record<string, unknown> | undefined)?.pdfPath ?? (report[krs] = report[krs] ?? {}), (report[krs] as { pdfPath: string }).pdfPath = path;
      }
      docs.push({ id: h.id.slice(0, 16), metaCap, rawCap: cap, size: raw?.length ?? 0 });
    }
    report[krs] = { hits_total: hits.length, hits_annual: annual.length, docs };
    console.log(`${krs}: annual=${annual.length} docs=${JSON.stringify(docs)}`);
  }
  writeFileSync(join(OUT, "discovery.json"), JSON.stringify(report, null, 1));
  console.log(`saved -> ${join(OUT, "discovery.json")}`);
}

main().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
