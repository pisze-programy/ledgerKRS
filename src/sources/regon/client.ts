import { SourceError } from "../../lib/errors";
import { mockRegonEntries } from "./mock";

export interface RegonClientOptions {
  baseUrl: string;
  apiKey: string;
  mode?: "mock" | "live";
  fetchJson?: (url: string, init: RequestInit) => Promise<unknown>;
}

export interface RegonEntry {
  regon: string;
  name: string | null;
  nip: string | null;
  status: string | null;
}

export function createRegonClient(options: RegonClientOptions) {
  const mode = options.mode ?? "mock";
  if (mode === "live" && !options.apiKey) {
    throw new SourceError("regon", "REGON_API_KEY is required in live mode");
  }
  if (mode === "mock") {
    return {
      async searchByNip(nip: string): Promise<RegonEntry[]> {
        return mockRegonEntries(nip);
      },
    };
  }
  const baseUrl = options.baseUrl.replace(/\/$/, "");
  const fetchJson = options.fetchJson ?? defaultFetchJson;
  return {
    async searchByNip(nip: string): Promise<RegonEntry[]> {
      const sid = await login(fetchJson, baseUrl, options.apiKey);
      try {
        return await search(fetchJson, baseUrl, sid, nip);
      } finally {
        await logout(fetchJson, baseUrl, sid);
      }
    },
  };
}

async function login(fetchJson: (url: string, init: RequestInit) => Promise<unknown>, baseUrl: string, apiKey: string): Promise<string> {
  const body = await fetchJson(`${baseUrl}/ApiZaloguj`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pKluczUzytkownika: apiKey }),
  });
  const sid = extractSid(body);
  if (!sid) {
    throw new SourceError("regon", "login failed");
  }
  return sid;
}

async function search(fetchJson: (url: string, init: RequestInit) => Promise<unknown>, baseUrl: string, sid: string, nip: string): Promise<RegonEntry[]> {
  const body = await fetchJson(`${baseUrl}/ApiDaneSzukaj`, {
    method: "POST",
    headers: { "Content-Type": "application/json", sid: sid },
    body: JSON.stringify({ pParametryWyszukiwania: { Nip: nip } }),
  });
  return parseEntries(body);
}

async function logout(fetchJson: (url: string, init: RequestInit) => Promise<unknown>, baseUrl: string, sid: string): Promise<void> {
  await fetchJson(`${baseUrl}/ApiWyloguj`, {
    method: "POST",
    headers: { "Content-Type": "application/json", sid: sid },
  });
}

function extractSid(body: unknown): string | null {
  const dane = recordOf(body, "dane");
  const sid = stringValue(dane?.Sesja) ?? stringValue(recordOf(body, "Sesja")?.value);
  return sid ?? null;
}

function parseEntries(body: unknown): RegonEntry[] {
  const dane = recordOf(body, "dane");
  const rows = dane?.["PKD"] ?? dane?.["WyszukanePodmioty"] ?? dane;
  if (!rows) {
    return [];
  }
  const list = Array.isArray(rows) ? rows : [rows];
  return list.map((row) => {
    const record = typeof row === "object" && row !== null ? (row as Record<string, unknown>) : {};
    return {
      regon: String(record.regon ?? record["REGON"] ?? ""),
      name: stringValue(record.nazwa ?? record["Nazwa"]),
      nip: stringValue(record.nip ?? record["NIP"]),
      status: stringValue(record.status ?? record["Status"]),
    };
  });
}

function recordOf(body: unknown, key: string): Record<string, unknown> | undefined {
  if (typeof body !== "object" || body === null) {
    return undefined;
  }
  const value = (body as Record<string, unknown>)[key];
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : undefined;
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

async function defaultFetchJson(url: string, init: RequestInit): Promise<unknown> {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new SourceError("regon", `request failed: ${response.status}`);
  }
  return response.json();
}
