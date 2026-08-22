import { chromium, type Browser, type BrowserContext } from "playwright-core";

const RDF_BASE = "https://rdf-przegladarka.ms.gov.pl";
const CHROMIUM =
  process.env.CHROMIUM ??
  "/Users/krystianblaszczyk/Library/Caches/ms-playwright/chromium-1234/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing";

export interface ProxySpec {
  server: string;
  username?: string;
  password?: string;
}

export function webshareProxy(username: string, password: string): ProxySpec {
  return { server: "http://p.webshare.io:80", username, password };
}

export interface SolvedSession {
  cookies: { name: string; value: string }[];
  cookieString: string;
}

export async function solveReese84(proxy: ProxySpec, url = `${RDF_BASE}/wyszukaj-podmiot`, timeoutMs = 25000): Promise<SolvedSession | null> {
  const browser = await chromium.launch({
    headless: true,
    executablePath: CHROMIUM,
    proxy,
    args: ["--disable-blink-features=AutomationControlled"],
  });
  try {
    const ctx = await browser.newContext({
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    });
    const page = await ctx.newPage();
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    } catch {
      // continue; the challenge page still loads and sets cookies
    }
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const cookies = await ctx.cookies();
      const reese = cookies.find((c) => c.name === "reese84");
      if (reese) {
        const kept = cookies
          .filter((c) => /reese84|incap_ses|visid_incap|nlbi|f5avr/i.test(c.name))
          .map((c) => ({ name: c.name, value: c.value }));
        return { cookies: kept, cookieString: kept.map((c) => `${c.name}=${c.value}`).join("; ") };
      }
      await page.waitForTimeout(1500);
    }
    console.error("reese84 not set within timeout (captcha shown?)");
    return null;
  } finally {
    await browser.close();
  }
}

export async function solveOnWebshare(username: string, password: string): Promise<SolvedSession | null> {
  return solveReese84(webshareProxy(username, password));
}
