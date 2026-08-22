import { readFileSync } from "node:fs";
import { join } from "node:path";

export interface ParityCreds {
  bizraportEmail: string;
  bizraportPassword: string;
  rdfCookie: string;
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
  };
}
