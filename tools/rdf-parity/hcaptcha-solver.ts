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
  const dir = mkdtempSync(join(tmpdir(), "hs-"));
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

export interface HcChallenge {
  pageUrl: string;
  scriptUrl: string;
  sitekey: string;
  postUrl: string;
  cookies: string;
}

export function fetchChallenge(proxy?: string): HcChallenge | null {
  const pageUrl = `${RDF_BASE}/wyszukaj-podmiot`;
  const r = curl(pageUrl, { proxy });
  const m = r.body.match(/["']([^"']*?_Incapsula_Resource[^"']*?)["']/);
  if (!m) {
    return null;
  }
  const scriptUrl = m[1]!.startsWith("/") ? RDF_BASE + m[1]! : m[1]!;
  const s = curl(scriptUrl, { proxy, headers: { Accept: "*/*", Referer: pageUrl } });
  const sitekey = s.body.match(/sitekey["']?\s*[:=]\s*["']([^"']+)["']/i)?.[1] ?? "";
  const postMatch = s.body.match(/xhr\.open\("POST",\s*"([^"]+)"/);
  const postUrl = postMatch ? (postMatch[1]!.startsWith("/") ? RDF_BASE + postMatch[1]! : postMatch[1]!) : "";
  if (!sitekey || !postUrl) {
    return null;
  }
  const cookies: string[] = [];
  for (const h of r.setCookies) {
    const name = h.split("=")[0]!.trim();
    const value = h.split(";")[0]!.split("=").slice(1).join("=");
    if (name) cookies.push(`${name}=${value}`);
  }
  return { pageUrl, scriptUrl, sitekey, postUrl, cookies: cookies.join("; ") };
}

function post2captcha(key: string, sitekey: string, pageUrl: string): string | null {
  const form = new URLSearchParams({ key, method: "hcaptcha", sitekey, pageurl: pageUrl, json: "1" });
  const r = curl("https://2captcha.com/in.php", { method: "POST", data: form.toString(), headers: { "Content-Type": "application/x-www-form-urlencoded" } });
  let id: string | null = null;
  try {
    const j = JSON.parse(r.body) as { status?: number; request?: string; error_text?: string };
    if (j.status === 1 && j.request) id = j.request;
    else {
      console.error("hcaptcha in.php:", j.error_text ?? j.status);
      return null;
    }
  } catch {
    console.error("hcaptcha in.php non-json:", r.body.slice(0, 200));
    return null;
  }
  const deadline = Date.now() + 180000;
  while (Date.now() < deadline) {
    const pr = curl(`https://2captcha.com/res.php?key=${key}&action=get&id=${id}&json=1`, {});
    if (pr.body.includes("CAPCHA_NOT_READY")) {
      execFileSync("sleep", ["4"]);
      continue;
    }
    try {
      const j = JSON.parse(pr.body) as { status?: number; request?: unknown; error_text?: string };
      if (j.status === 1 && typeof j.request === "string") return j.request;
      if (j.status === 0) {
        console.error("hcaptcha solve failed:", pr.body.slice(0, 200));
        return null;
      }
    } catch {
      // retry
    }
    execFileSync("sleep", ["4"]);
  }
  console.error("hcaptcha solve timeout");
  return null;
}

export function solveAndPost(proxy: string, key: string): { cookies: string; setCookies: string[] } | null {
  const ch = fetchChallenge(proxy);
  if (!ch) {
    console.error("challenge fetch failed (no Incapsula script in page)");
    return null;
  }
  console.error(`  sitekey=${ch.sitekey}`);
  console.error(`  postUrl=${ch.postUrl.slice(0, 90)}`);
  console.error(`  challengeCookies=${ch.cookies.slice(0, 60)}...`);
  console.error("solving hCaptcha via 2captcha...");
  const token = post2captcha(key, ch.sitekey, ch.pageUrl);
  if (!token) {
    return null;
  }
  console.error("token OK, posting to Incapsula...");
  const body = new URLSearchParams({ "g-recaptcha-response": token }).toString();
  const post = curl(ch.postUrl, { proxy, method: "POST", cookie: ch.cookies, data: body, headers: { "Content-Type": "application/x-www-form-urlencoded", Referer: ch.pageUrl } });
  if (!post.setCookies.length) {
    console.error("no Set-Cookie after POST (status", post.status, ") body:", post.body.slice(0, 200));
    return null;
  }
  const cookieParts: string[] = [];
  for (const h of post.setCookies) {
    const name = h.split("=")[0]!.trim();
    const value = h.split(";")[0]!.split("=").slice(1).join("=");
    if (name) cookieParts.push(`${name}=${value}`);
  }
  const merged = [...cookieParts];
  for (const c of ch.cookies.split("; ")) {
    if (c && !merged.some((m) => m.split("=")[0] === c.split("=")[0])) merged.push(c);
  }
  return { cookies: merged.join("; "), setCookies: post.setCookies };
}

async function main() {
  const creds = loadCreds();
  const proxy = process.argv[2] ?? creds.proxy;
  if (!creds.twoCaptchaKey || !proxy) {
    console.error("Usage: hcaptcha-solver.ts <proxy>");
    process.exit(1);
  }
  console.error("fetching challenge...");
  const sol = solveAndPost(proxy, creds.twoCaptchaKey);
  if (!sol) process.exit(1);
  console.error("got cookies:", sol.setCookies.map((c) => c.split("=")[0]).join(", "));
  console.error(`\nRDF_COOKIE="${sol.cookies}"`);
  writeFileSync(join(process.cwd(), "tools", "rdf-parity", "cookie-solved.txt"), sol.cookies);
}

const isCli = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
if (isCli) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
