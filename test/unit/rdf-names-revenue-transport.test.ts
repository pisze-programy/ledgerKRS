import { describe, expect, it, vi, afterEach } from "vitest";
import { nameFor, entriesFor } from "../../src/sources/rdf/names";
import { revenueFor } from "../../src/sources/rdf/revenue";
import { createRdfFetchTransport } from "../../src/sources/rdf/transport";
import { createRdfClient, encryptNrKrs } from "../../src/sources/rdf/client";
import type { RzisRoles } from "../../src/sources/rdf/rzis";
import type { StatementMeta } from "../../src/sources/rdf/layouts";

function roles(codes: Record<string, number>, overrides: Partial<RzisRoles> = {}): RzisRoles {
  return {
    przychody: codes["A"] ?? null,
    koszty: codes["B"] ?? null,
    zyskZeSprzedazy: null,
    zyskOperacyjny: null,
    zyskBrutto: null,
    podatek: null,
    zyskNetto: null,
    codes,
    source: "dict",
    ...overrides,
  };
}

const meta = (layout: StatementMeta["layout"]): StatementMeta => ({ layout, wariant: null, version: null });

describe("names — dict lookup", () => {
  it("nameFor reads the consolidated SFSINZ dict (W = netto, S = podatek)", () => {
    expect(nameFor("SFSINZ", "RZiS", "W", "RZiSKalk")).toContain("netto");
    expect(nameFor("SFSINZ", "RZiS", "S", "RZiSKalk")).toContain("Podatek");
    expect(nameFor("LEGACY", "RZiS", "A")).toBeNull();
  });

  it("entriesFor lists a section's codes", () => {
    const entries = entriesFor("SFJINZ", "RZiS", "RZiSPor");
    expect(entries.some(([code]) => code === "A")).toBe(true);
  });
});

describe("revenue — per-form rules", () => {
  it("JednostkaOp: A+D+I+K", () => {
    const r = revenueFor(meta("SFJOPZ"), roles({ A: 100, D: 10, I: 5, K: 1 }, { source: "op-fixed" }));
    expect(r.total).toBe(116);
    expect(r.operating).toBe(115);
  });

  it("truncated Mikro: A+C, operating = A", () => {
    const r = revenueFor(meta("SFJMIZ"), roles({ A: 100, C: 20 }, { source: "truncated" }));
    expect(r.total).toBe(120);
    expect(r.operating).toBe(100);
  });

  it("legacy: A+D+G", () => {
    const r = revenueFor(meta("LEGACY"), roles({ A: 100, D: 10, G: 5 }));
    expect(r.total).toBe(115);
    expect(r.operating).toBe(110);
  });

  it("simplified porównawczy (H−I=J, no L): A+D+F", () => {
    const r = revenueFor(meta("SFJMIZ"), roles({ A: 100, D: 10, F: 3, H: 50, I: 40, J: 10 }));
    expect(r.total).toBe(113);
    expect(r.operating).toBe(110);
  });

  it("does not apply simplified when L is present", () => {
    const r = revenueFor(meta("SFJINZ"), roles({ A: 100, D: 10, G: 5, L: 1 }));
    expect(r.total).toBe(115);
  });

  it("consolidated SFSINZ via dict income letters: A+G+J", () => {
    const r = revenueFor(meta("SFSINZ"), roles({ A: 100, G: 5, J: 3 }, { variant: "RZiSKalk" }));
    expect(r.total).toBe(108);
  });
});

describe("transport — CF-compatible fetch", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("sets the browser headers and cookie Incapsula expects", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const transport = createRdfFetchTransport("reese84=abc; incap_ses=def");
    await transport("https://rdf.example.test/x", { method: "POST", body: "{}" });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(String(url)).toBe("https://rdf.example.test/x");
    const headers = new Headers(init?.headers);
    expect(headers.get("Cookie")).toBe("reese84=abc; incap_ses=def");
    expect(headers.get("User-Agent")).toContain("Chrome/123");
    expect(headers.get("sec-ch-ua")).toContain("Google Chrome");
  });
});

describe("client — encryption + search", () => {
  it("encryptNrKrs produces a base64 token", async () => {
    const token = await encryptNrKrs("0000007411");
    expect(token.length).toBeGreaterThan(20);
    expect(Buffer.from(token, "base64").length).toBeGreaterThan(0);
  });

  it("searchDocuments parses hits through the injected transport", async () => {
    const payload = { content: [{ id: "x", rodzaj: "18", status: "NIEUSUNIETY" }] };
    const transport = async () => new Response(JSON.stringify(payload), { status: 200 });
    const client = createRdfClient({ baseUrl: "https://rdf.example.test", transport });
    const hits = await client.searchDocuments("0000007411");
    expect(hits.length).toBe(1);
    expect(hits[0]!.rodzaj).toBe("18");
  });

  it("downloadXml returns null when the transport serves a challenge (HTML)", async () => {
    const transport = async () => new Response("<html>challenge</html>", { status: 200 });
    const client = createRdfClient({ baseUrl: "https://rdf.example.test", transport });
    const xml = await client.downloadXml("id");
    expect(xml).toBeNull();
  });
});
