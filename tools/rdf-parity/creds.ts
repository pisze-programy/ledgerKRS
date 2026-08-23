import { readFileSync } from "node:fs";
import { join } from "node:path";

export interface ParityCreds {
  bizraportEmail: string;
  bizraportPassword: string;
  rdfCookie: string;
  twoCaptchaKey?: string;
  proxy?: string;
  proxyType?: "HTTP" | "SOCKS5" | "SOCKS4" | "HTTPS";
  wsUserPrefix?: string;
  wsUsers?: string[];
  wsPassword?: string;
  compabaseKey?: string;
}

const DEFAULT_PATH = join(process.cwd(), "tools", "rdf-parity", "creds.local.json");

export function loadCreds(): ParityCreds {
  let local: Partial<ParityCreds> = {};
  try {
    local = JSON.parse(readFileSync(DEFAULT_PATH, "utf8"));
  } catch {
    // no local file; fall back to env
  }
  return {
    bizraportEmail: process.env.BIZRAPORT_EMAIL ?? local.bizraportEmail ?? "",
    bizraportPassword: process.env.BIZRAPORT_PASSWORD ?? local.bizraportPassword ?? "",
    rdfCookie: process.env.RDF_COOKIE ?? local.rdfCookie ?? "",
    twoCaptchaKey: process.env.TWO_CAPTCHA_KEY ?? local.twoCaptchaKey ?? "",
    proxy: process.env.RDF_PROXY ?? local.proxy ?? "",
    proxyType: (process.env.PROXY_TYPE as ParityCreds["proxyType"]) ?? local.proxyType ?? "HTTP",
    wsUserPrefix: local.wsUserPrefix ?? "",
    wsUsers: local.wsUsers ?? [],
    wsPassword: local.wsPassword ?? "",
    compabaseKey: process.env.COMPABASE_KEY ?? local.compabaseKey ?? "",
  };
}
