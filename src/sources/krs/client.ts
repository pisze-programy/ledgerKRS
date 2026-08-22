import { SourceError } from "../../lib/errors";
import { httpGetJson } from "../../lib/http";
import { padKrs } from "../../lib/normalize";

export interface KrsClientOptions {
  baseUrl: string;
  fetchJson?: typeof httpGetJson;
}

export function createKrsClient(options: KrsClientOptions) {
  const baseUrl = options.baseUrl.replace(/\/$/, "");
  const fetchJson = options.fetchJson ?? httpGetJson;
  return {
    getOdpisAktualny(krs: string): Promise<unknown> {
      return getOdpis(fetchJson, baseUrl, krs, "OdpisAktualny");
    },
    getOdpisPelny(krs: string): Promise<unknown> {
      return getOdpis(fetchJson, baseUrl, krs, "OdpisPelny");
    },
    getBiuletyn(dzien: string): Promise<string[]> {
      return getList(fetchJson, baseUrl, `/api/Krs/Biuletyn/${dzien}`);
    },
    getBiuletynGodzinowy(dzien: string, godzinaOd: string, godzinaDo: string): Promise<string[]> {
      return getList(fetchJson, baseUrl, `/api/Krs/BiuletynGodzinowy/${dzien}?godzinaOd=${godzinaOd}&godzinaDo=${godzinaDo}`);
    },
  };
}

function getOdpis(fetchJson: typeof httpGetJson, baseUrl: string, krs: string, endpoint: string): Promise<unknown> {
  const padded = padKrs(krs);
  return Promise.resolve()
    .then(() => tryOdpis(fetchJson, baseUrl, padded, endpoint, "P"))
    .then((result) => {
      if (hasOdpis(result)) {
        return result;
      }
      return tryOdpis(fetchJson, baseUrl, padded, endpoint, "S");
    })
    .catch((error) => {
      throw new SourceError("krs", `odpis ${endpoint} failed for ${padded}: ${String(error)}`);
    });
}

function tryOdpis(fetchJson: typeof httpGetJson, baseUrl: string, padded: string, endpoint: string, rejestr: string): Promise<unknown> {
  return fetchJson(`${baseUrl}/api/krs/${endpoint}/${padded}?rejestr=${rejestr}&format=json`);
}

function hasOdpis(value: unknown): boolean {
  return typeof value === "object" && value !== null && (value as Record<string, unknown>).odpis !== undefined;
}

function getList(fetchJson: typeof httpGetJson, baseUrl: string, path: string): Promise<string[]> {
  return fetchJson(`${baseUrl}${path}`).then(asStringArray).catch((error) => {
    throw new SourceError("krs", `biuletyn failed: ${String(error)}`);
  });
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}
