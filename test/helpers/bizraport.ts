import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export interface BizraportCreds {
  email: string;
  password: string;
}

export interface ProbeResult {
  status: number;
  json: Record<string, unknown>;
  credits: number;
}

export interface CallRecord {
  at: string;
  endpoint: string;
  params: Record<string, string>;
  status: number;
  credits: number;
  fixture: string | null;
  note?: string;
}

export const FIXTURE_DIR = join(process.cwd(), "test", "fixtures", "bizraport");
export const RAW_DIR = join(FIXTURE_DIR, "raw");
export const LEDGER_FILE = join(FIXTURE_DIR, "ledger.json");

export function getCreds(): BizraportCreds | null {
  const email = process.env.BIZRAPORT_EMAIL;
  const password = process.env.BIZRAPORT_PASSWORD;
  return email && password ? { email, password } : null;
}

export async function callApi(
  endpoint: string,
  params: Record<string, string>,
  creds: BizraportCreds,
): Promise<ProbeResult> {
  const url = new URL(`https://api.bizraport.pl/api/${endpoint}`);
  if (!params.email) {
    url.searchParams.set("email", creds.email);
  }
  if (!params.password) {
    url.searchParams.set("password", creds.password);
  }
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  const response = await fetch(url, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(60000),
  });
  const json = (await response.json()) as Record<string, unknown>;
  const data = json.data;
  const hasData = response.status === 200 && Array.isArray(data) && data.length > 0;
  return { status: response.status, json, credits: hasData ? 1 : 0 };
}

export async function checkUsage(creds: BizraportCreds): Promise<number> {
  const url = new URL("https://api.bizraport.pl/api/zuzycie");
  url.searchParams.set("email", creds.email);
  url.searchParams.set("password", creds.password);
  const response = await fetch(url);
  const json = (await response.json()) as { odpytania_razem?: number };
  return json.odpytania_razem ?? 0;
}

export function writeFixture(name: string, json: unknown): string {
  mkdirSync(FIXTURE_DIR, { recursive: true });
  writeFileSync(join(FIXTURE_DIR, name), JSON.stringify(json, null, 2));
  return name;
}

export function readFixture(name: string): Record<string, unknown> | null {
  const path = join(FIXTURE_DIR, name);
  if (!existsSync(path)) {
    return null;
  }
  return JSON.parse(readFileSync(path, "utf-8")) as Record<string, unknown>;
}

export function hasFixture(name: string): boolean {
  return existsSync(join(FIXTURE_DIR, name));
}

export function reuseEnabled(): boolean {
  return process.env.BIZRAPORT_REUSE_FIXTURES === "1";
}

export function writeRaw(name: string, json: unknown): string {
  mkdirSync(RAW_DIR, { recursive: true });
  writeFileSync(join(RAW_DIR, name), JSON.stringify(json, null, 2));
  return `raw/${name}`;
}

export function trimKatalog(json: Record<string, unknown>): Record<string, unknown> {
  const data = Array.isArray(json.data) ? json.data : [];
  return {
    count: json.count,
    fetchedCount: json.fetchedCount,
    data: data.slice(0, 20),
    note: "trimmed for fixture; full raw dump in raw/",
  };
}

export function writeLedger(ledger: Record<string, unknown>): void {
  mkdirSync(FIXTURE_DIR, { recursive: true });
  writeFileSync(LEDGER_FILE, JSON.stringify(ledger, null, 2));
}
