import { chromium } from "playwright-core";
import { createRdfClient, isXmlCapable } from "../../src/sources/rdf/client";
import { parseSprawozdanie } from "../../src/sources/rdf/parser";
import { statementMeta } from "../../src/sources/rdf/layouts";

const CHROMIUM =
  "/Users/krystianblaszczyk/Library/Caches/ms-playwright/chromium-1234/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing";
const CHROME_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36";

let cookie = "";

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
  console.error(`[refresh] cookie=${cookie.length > 0}`);
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
      if (v) {
        return v;
      }
    } catch {
      // fallthrough
    }
    await refresh();
  }
  return null;
}

function field(meta: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    if (meta[key] !== undefined && meta[key] !== null) {
      return meta[key];
    }
  }
  return undefined;
}

async function main() {
  await refresh();
  const KRS = (process.argv[2] ?? "0000005989,0000666310,0000080829").split(",");
  for (const krs of KRS) {
    const hits = (await withRefresh(() => client.searchDocuments(krs))) ?? [];
    console.log(`\n######## ${krs}: ${hits.length} hits ########`);
    for (const h of hits) {
      const meta = await withRefresh(() => client.documentMeta(h.id));
      const dodanie = field(meta, "dataDodania", "dataUtworzenia") as string | undefined;
      console.log(
        `  ALL id=${h.id} rodzaj=${h.rodzaj} status=${h.status} okres=${h.okresSprawozdawczyPoczatek}..${h.okresSprawozdawczyKoniec} dataDodania=${dodanie}`,
      );
    }
    const annual = hits.filter((h) => h.rodzaj === "18" || h.rodzaj === "22");
    for (const h of annual) {
      const meta = await withRefresh(() => client.documentMeta(h.id));
      const tytul = field(meta, "tytul", "tytulDokumentu") as string | undefined;
      const dodanie = field(meta, "dataDodania", "dataUtworzenia") as string | undefined;
      const publikacja = field(meta, "dataPublikacji", "dataOpublikowania") as string | undefined;
      const status = field(meta, "status", "statusDokumentu") as unknown;
      const xml = await withRefresh(() => client.downloadXml(h.id));
      let parsed = "n/a";
      let layout = "n/a";
      let rzis = "";
      if (xml) {
        const st = parseSprawozdanie(xml);
        layout = statementMeta(xml).layout;
        if (st) {
          parsed = st.okres_sprawozdawczy ?? "null";
          const rzisSec = st.sekcje.find((s) => s.sekcja.includes("Rachunek zysków"));
          if (rzisSec) {
            rzis = rzisSec.pozycje
              .filter((p) => p.kod_pozycji && /^[A-Z]$/.test(p.kod_pozycji))
              .map((p) => `${p.kod_pozycji}=${p.kwota}`)
              .join(" ");
          }
        }
      }
      console.log(
        `  id=${h.id} rodzaj=${h.rodzaj} status=${h.status}\n` +
          `    hit.okres=${h.okresSprawozdawczyPoczatek}..${h.okresSprawozdawczyKoniec}\n` +
          `    tytul=${tytul}\n    dataDodania=${dodanie} publikacja=${publikacja} statusMeta=${status}\n` +
          `    xml.okres=${parsed} layout=${layout}\n    RZiS: ${rzis}`,
      );
    }
  }
}

main().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
