import { createRdfClient, type RdfSearchHit } from "../../src/sources/rdf/client";

export function rdfTransport(cookie: string): (input: string, init?: RequestInit) => Promise<Response> {
  return (input, init) => {
    const headers = new Headers(init?.headers);
    headers.set("Cookie", cookie);
    headers.set("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:153.0) Gecko/20100101 Firefox/153.0");
    return fetch(input, { ...init, headers });
  };
}

export function makeRdfClient(cookie: string) {
  return createRdfClient({
    baseUrl: "https://rdf-przegladarka.ms.gov.pl",
    transport: rdfTransport(cookie),
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
