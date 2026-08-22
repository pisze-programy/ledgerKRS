import { execFileSync } from "node:child_process";
import { createRdfClient, type RdfSearchHit } from "../../src/sources/rdf/client";

const CHROME_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36";

export function rdfTransport(cookie: string): (input: string, init?: RequestInit) => Promise<Response> {
  return (input, init) => {
    const headers = new Headers(init?.headers);
    headers.set("Cookie", cookie);
    headers.set("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:153.0) Gecko/20100101 Firefox/153.0");
    return fetch(input, { ...init, headers });
  };
}

export function proxyTransport(cookie: string, proxy = process.env.RDF_PROXY ?? "socks5h://127.0.0.1:1080"): (input: string, init?: RequestInit) => Promise<Response> {
  const hostport = proxy.replace(/^socks5h?:\/\//, "");
  return (input, init) => {
    const method = init?.method ?? "GET";
    const args = ["-s", "-m", "60", "--socks5-hostname", hostport, "-X", method, "-H", `Cookie: ${cookie}`, "-H", "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:153.0) Gecko/20100101 Firefox/153.0", "-H", "Accept: application/json"];
    if (init?.headers) {
      const h = new Headers(init.headers);
      if (h.get("content-type")) args.push("-H", `Content-Type: ${h.get("content-type")}`);
      if (h.get("origin")) args.push("-H", `Origin: ${h.get("origin")}`);
      if (h.get("referer")) args.push("-H", `Referer: ${h.get("referer")}`);
    }
    if (init?.body) args.push("--data-raw", String(init.body));
    args.push(input);
    const out = execFileSync("curl", args, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
    return Promise.resolve(new Response(out, { status: 200, headers: { "content-type": "application/json" } }));
  };
}

export interface WebshareSession {
  cookie: string;
  ip: string;
  proxyHost: string;
  proxyUser: string;
  proxyPass: string;
}

export function makeWebshareTransport(session: () => WebshareSession): (input: string, init?: RequestInit) => Promise<Response> {
  return (input, init) => {
    const s = session();
    const hostport = s.proxyHost.replace(/^https?:\/\//, "");
    const method = init?.method ?? "GET";
    const args = ["-s", "-m", "60", "--proxy", hostport, "-X", method];
    args.push("-H", `Proxy-Authorization: Basic ${Buffer.from(`${s.proxyUser}:${s.proxyPass}`).toString("base64")}`);
    args.push("-H", `Cookie: ${s.cookie}`);
    args.push("-H", `User-Agent: ${CHROME_UA}`);
    args.push("-H", 'sec-ch-ua: "Google Chrome";v="123", "Not:A-Brand";v="8", "Chromium";v="123"');
    args.push("-H", "sec-ch-ua-mobile: ?0");
    args.push("-H", 'sec-ch-ua-platform: "macOS"');
    args.push("-H", "Accept: application/json");
    if (init?.headers) {
      const h = new Headers(init.headers);
      if (h.get("content-type")) args.push("-H", `Content-Type: ${h.get("content-type")}`);
      if (h.get("origin")) args.push("-H", `Origin: ${h.get("origin")}`);
      if (h.get("referer")) args.push("-H", `Referer: ${h.get("referer")}`);
    }
    if (init?.body) args.push("--data-raw", String(init.body));
    args.push(input);
    const out = execFileSync("curl", args, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
    return Promise.resolve(new Response(out, { status: 200, headers: { "content-type": "application/json" } }));
  };
}

export function makeRdfClient(cookie: string) {
  const transport = process.env.RDF_PROXY ? proxyTransport(cookie) : rdfTransport(cookie);
  return createRdfClient({
    baseUrl: "https://rdf-przegladarka.ms.gov.pl",
    transport,
  });
}

export function annualStatementHits(hits: RdfSearchHit[]): RdfSearchHit[] {
  return hits
    .filter((h) => h.rodzaj === "18")
    .sort((a, b) => (b.okresSprawozdawczyPoczatek ?? "").localeCompare(a.okresSprawozdawczyPoczatek ?? ""));
}

export async function withRetry<T>(fn: () => Promise<T>, attempts = 3, delayMs = 1500): Promise<T | null> {
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await fn();
    } catch {
      if (i === attempts - 1) {
        return null;
      }
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  return null;
}
