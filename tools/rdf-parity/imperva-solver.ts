import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { loadCreds } from "./creds";

const RDF_BASE = "https://rdf-przegladarka.ms.gov.pl";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:153.0) Gecko/20100101 Firefox/153.0";

interface CurlResult {
  status: number;
  headers: Record<string, string>;
  setCookies: string[];
  body: string;
}

function curl(url: string, opts: { method?: string; proxy?: string; cookie?: string; data?: string; headers?: Record<string, string> } = {}): CurlResult {
  const dir = mkdtempSync(join(tmpdir(), "ivs-"));
  const hf = join(dir, "h.txt");
  const bf = join(dir, "b.txt");
  const args = ["-s", "-m", "40", "-L"];
  const proxy = opts.proxy ?? loadCreds().proxy;
  if (proxy) {
    const hostport = proxy.replace(/^socks5h?:\/\//, "").replace(/^https?:\/\//, "");
    const isSocks = /^socks/i.test(proxy);
    args.push(isSocks ? "--socks5-hostname" : "--proxy", hostport);
  }
  if (opts.method) args.push("-X", opts.method);
  args.push("-D", hf, "-o", bf, "-H", `User-Agent: ${UA}`);
  if (opts.cookie) args.push("-H", `Cookie: ${opts.cookie}`);
  for (const [k, v] of Object.entries(opts.headers ?? {})) args.push("-H", `${k}: ${v}`);
  if (opts.data !== undefined) args.push("--data-raw", opts.data);
  args.push(url);
  execFileSync("curl", args, { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
  const headerText = readFileSync(hf, "utf8");
  const body = readFileSync(bf, "utf8");
  rmSync(dir, { recursive: true, force: true });
  const headers: Record<string, string> = {};
  const setCookies: string[] = [];
  for (const line of headerText.split("\r\n")) {
    const m = line.match(/^([^:]+):\s*(.*)$/);
    if (m) {
      const name = m[1]!.toLowerCase();
      if (name === "set-cookie") setCookies.push(m[2]!);
      headers[name] = m[2]!;
    }
  }
  const status = Number(headerText.split(" ")[1] ?? 0);
  return { status, headers, setCookies, body };
}

export interface ImpervaChallenge {
  pageUrl: string;
  scriptUrl: string;
  incapsulaCookies: string;
}

export function fetchChallenge(proxy?: string): ImpervaChallenge | null {
  const url = `${RDF_BASE}/wyszukaj-podmiot`;
  const r = curl(url, { proxy });
  if (r.status !== 200) return null;
  const m = r.body.match(/["']([^"']*?_Incapsula_Resource[^"']*?)["']/);
  const scriptUrl = m ? m[1]! : "";
  if (!scriptUrl) return null;
  const cookies: string[] = [];
  const addCookie = (h: string | undefined) => {
    if (!h) return;
    const name = h.split("=")[0]!.trim();
    const value = h.split(";")[0]!.split("=").slice(1).join("=");
    if (name) cookies.push(`${name}=${value}`);
  };
  r.setCookies.forEach(addCookie);
  addCookie(r.headers["set-cookie"]);
  const inc = cookies.filter((c) => c.startsWith("visid_incap") || c.startsWith("incap_ses") || c.startsWith("nlbi"));
  return { pageUrl: url, scriptUrl, incapsulaCookies: inc.join("; ") };
}

export interface ImpervaSolution {
  cookies: Record<string, string>;
  userAgent?: string;
}

function pollRes(key: string, id: string, timeoutMs = 300000): { json: string; last: string } | null {
  const deadline = Date.now() + timeoutMs;
  let last = "";
  while (Date.now() < deadline) {
    const r = curl(`https://2captcha.com/res.php?key=${key}&action=get&id=${id}&json=1`, {});
    last = r.body;
    if (r.body.includes("CAPCHA_NOT_READY")) {
      execFileSync("sleep", ["5"]);
      continue;
    }
    try {
      const j = JSON.parse(r.body) as { status?: number; request?: unknown; error_text?: string };
      if (j.status === 1) return { json: JSON.stringify(j.request), last: r.body };
      if (j.status === 0) return { json: "", last: r.body };
    } catch {
      // not json yet
    }
    execFileSync("sleep", ["5"]);
  }
  return { json: "", last };
}

export function solveImperva(key: string, challenge: ImpervaChallenge, proxy: string, proxyType: string, ua = UA): ImpervaSolution | null {
  const form = new URLSearchParams();
  form.set("key", key);
  form.set("method", "incapsula");
  form.set("pageurl", challenge.pageUrl);
  form.set("incapsula_script_url", challenge.scriptUrl);
  form.set("incapsula_cookies", challenge.incapsulaCookies);
  form.set("useragent", ua);
  form.set("proxytype", proxyType);
  const cleaned = proxy.replace(/^https?:\/\//, "").replace(/^socks5h?:\/\//, "").replace(/\/+$/, "");
  form.set("proxy", cleaned);
  form.set("json", "1");
  const r = curl("https://2captcha.com/in.php", { method: "POST", data: form.toString(), headers: { "Content-Type": "application/x-www-form-urlencoded" } });
  let id: string | null = null;
  try {
    const j = JSON.parse(r.body) as { status?: number; request?: string; error_text?: string };
    if (j.status === 1 && j.request) id = j.request;
    else {
      console.error("2captcha in.php:", j.error_text ?? j.status, r.body.slice(0, 200));
      return null;
    }
  } catch {
    console.error("2captcha in.php non-json:", r.body.slice(0, 200));
    return null;
  }
  const sol = pollRes(key, id);
  if (!sol?.json) {
    console.error("2captcha solve failed. last res.php:", (sol?.last ?? "").slice(0, 400));
    return null;
  }
  let parsed: { domains?: Record<string, { cookies?: Record<string, string> }>; headers?: { "User-Agent"?: string } };
  try {
    parsed = JSON.parse(sol.json) as typeof parsed;
  } catch {
    console.error("2captcha result parse failed:", sol.json.slice(0, 200));
    return null;
  }
  const domain = Object.values(parsed.domains ?? {})[0];
  if (!domain?.cookies) {
    console.error("2captcha result has no cookies:", sol.slice(0, 300));
    return null;
  }
  return { cookies: domain.cookies, userAgent: parsed.headers?.["User-Agent"] };
}

export function cookieString(sol: ImpervaSolution): string {
  return Object.entries(sol.cookies).map(([k, v]) => `${k}=${v}`).join("; ");
}

async function main() {
  const creds = loadCreds();
  const proxy = process.argv[2] ?? creds.proxy;
  if (!creds.twoCaptchaKey || !proxy) {
    console.error("Usage: imperva-solver.ts <proxy>  (proxy e.g. login:pass@host:port)");
    process.exit(1);
  }
  console.error("1/3 fetching challenge...");
  const challenge = fetchChallenge(proxy);
  if (!challenge) {
    console.error("challenge fetch failed (site may be reachable already, or proxy dead)");
    process.exit(1);
  }
  console.error(`   scriptUrl=${challenge.scriptUrl}`);
  console.error(`   incapsulaCookies=${challenge.incapsulaCookies}`);
  console.error("2/3 solving via 2captcha...");
  const sol = solveImperva(creds.twoCaptchaKey, challenge, proxy, creds.proxyType ?? "HTTP");
  if (!sol) {
    process.exit(1);
  }
  console.error("3/3 got cookies:", Object.keys(sol.cookies).join(", "));
  const cookie = cookieString(sol);
  console.error(`\nRDF_COOKIE="${cookie}"`);
  writeFileSync(join(process.cwd(), "tools", "rdf-parity", "cookie-solved.txt"), cookie);
}

const isCli = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
if (isCli) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
