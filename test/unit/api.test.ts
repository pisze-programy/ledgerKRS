import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createApp } from "../../src/api/routes";
import { createIngest } from "../../src/pipeline/ingest";
import { createKrsClient } from "../../src/sources/krs/client";
import { createMemoryRepository } from "../helpers/memory-repository";
import { createMemoryBillingRepository } from "../../src/store/billing-memory";
import { createMemoryCatalogRepository } from "../../src/store/catalog-memory";
import { fsFetchAsset } from "../helpers/assets";
import { loadConfig } from "../../src/config";
import type { ApiDeps } from "../../src/api/deps";
import type { CatalogRow } from "../../src/store/catalog";

function buildDeps(): ApiDeps & { repository: ReturnType<typeof createMemoryRepository> } {
  const repository = createMemoryRepository();
  const krsClient = createKrsClient({
    baseUrl: "https://api-krs.ms.gov.pl",
    fetchJson: async () => JSON.parse(readFileSync(join(process.cwd(), "test", "fixtures", "krs-jeronimo.json"), "utf-8")),
  });
  const ingest = createIngest({ krsClient, repository });
  return {
    repository,
    ingest,
    billing: createMemoryBillingRepository(),
    catalog: createMemoryCatalogRepository(),
    config: loadConfig({ FREE_CREDITS: "100" }),
    fetchAsset: fsFetchAsset(),
  };
}

async function buildApp() {
  const deps = buildDeps();
  const app = createApp(deps);
  return { app, deps };
}

async function createAccount(app: ReturnType<typeof createApp>): Promise<{ key: string; accountId: number }> {
  const response = await app.request("/api/account", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "test@example.com" }),
  });
  const body = (await response.json()) as { api_key: string; account_id: number; balance: number };
  expect(response.status).toBe(200);
  expect(body.balance).toBe(100);
  return { key: body.api_key, accountId: body.account_id };
}

function authHeaders(key: string): Record<string, string> {
  return { "x-api-key": key, "content-type": "application/json" };
}

describe("createApp — account and credits", () => {
  it("returns ok on /health", async () => {
    const { app } = await buildApp();
    expect(await (await app.request("/health")).json()).toEqual({ status: "ok" });
  });

  it("creates an account with free credits and api key", async () => {
    const { app } = await buildApp();
    const body = await createAccount(app);
    expect(body.key.length).toBeGreaterThan(20);
  });

  it("requires api key for balance", async () => {
    const { app } = await buildApp();
    const response = await app.request("/api/balance");
    expect(response.status).toBe(401);
  });

  it("reads balance", async () => {
    const { app } = await buildApp();
    const { key } = await createAccount(app);
    const response = await app.request("/api/balance", { headers: authHeaders(key) });
    expect(await response.json()).toEqual({ balance: 100 });
  });

  it("reads usage", async () => {
    const { app } = await buildApp();
    const { key } = await createAccount(app);
    const response = await app.request("/api/zuzycie", { headers: authHeaders(key) });
    const body = (await response.json()) as { balance: number; model: string };
    expect(body.model).toBe("payg");
    expect(body.balance).toBe(100);
  });
});

describe("createApp — checkout and billing", () => {
  it("creates a mock checkout with pending credits", async () => {
    const { app } = await buildApp();
    const { key } = await createAccount(app);
    const response = await app.request("/api/billing/checkout", { method: "POST", headers: authHeaders(key) });
    const body = (await response.json()) as { checkout_url: string; mode: string; credits: number; pending: boolean; confirm_after_ms: number };
    expect(body.mode).toBe("mock");
    expect(body.credits).toBe(1000);
    expect(body.pending).toBe(true);
    expect(body.confirm_after_ms).toBeGreaterThan(0);
    const balance = (await (await app.request("/api/balance", { headers: authHeaders(key) })).json()) as { balance: number };
    expect(balance.balance).toBe(100);
  });
});

describe("createApp — data endpoints and charging", () => {
  it("ingests and reads a company via /api/dane with charge", async () => {
    const { app, deps } = await buildApp();
    const { key } = await createAccount(app);
    await app.request("/ingest/krs/0000222483", { method: "POST" });
    const response = await app.request("/api/dane?krs=0000222483", { headers: authHeaders(key) });
    expect(response.status).toBe(200);
    const body = (await response.json()) as { data: { company: { krs: string } }[]; credits_spent: number; credits_remaining: number };
    expect(body.data[0]!.company.krs).toBe("0000222483");
    expect(body.credits_spent).toBe(1);
    expect(body.credits_remaining).toBe(99);
  });

  it("returns empty data for a missing company (free)", async () => {
    const { app } = await buildApp();
    const { key } = await createAccount(app);
    const response = await app.request("/api/dane?krs=0000000000", { headers: authHeaders(key) });
    const body = (await response.json()) as { data: unknown[]; credits_spent?: number };
    expect(body.data).toEqual([]);
    expect(body.credits_spent).toBeUndefined();
  });

  it("rejects dane without identifiers", async () => {
    const { app } = await buildApp();
    const { key } = await createAccount(app);
    const response = await app.request("/api/dane", { headers: authHeaders(key) });
    expect(response.status).toBe(400);
  });

  it("filters catalog and charges", async () => {
    const { app, deps } = await buildApp();
    const { key } = await createAccount(app);
    const rows: CatalogRow[] = [
      catalogRow("0000222483", "JERONIMO MARTINS", "WIELKOPOLSKIE", 100),
      catalogRow("0000597711", "LIDL SP. K.", "WIELKOPOLSKIE", 50),
    ];
    await deps.catalog.upsertCatalogRows(rows);
    const response = await app.request("/api/katalog?przychody_od=60&wojewodztwo=WIELKOPOLSKIE", { headers: authHeaders(key) });
    const body = (await response.json()) as { count: number; data: { krs: string }[]; credits_spent: number };
    expect(body.count).toBe(1);
    expect(body.data[0]!.krs).toBe("0000222483");
    expect(body.credits_spent).toBe(1);
  });

  it("rejects a catalog call without filters", async () => {
    const { app } = await buildApp();
    const { key } = await createAccount(app);
    const response = await app.request("/api/katalog", { headers: authHeaders(key) });
    expect(response.status).toBe(400);
  });

  it("searches companies", async () => {
    const { app, deps } = await buildApp();
    const { key } = await createAccount(app);
    await deps.catalog.upsertCatalogRows([catalogRow("0000222483", "JERONIMO MARTINS", "WIELKOPOLSKIE", 100)]);
    const response = await app.request("/api/szukaj?q=jer", { headers: authHeaders(key) });
    const body = (await response.json()) as { data: { krs: string }[] };
    expect(body.data[0]!.krs).toBe("0000222483");
  });
});

describe("createApp — branches and pkd", () => {
  it("lists branches", async () => {
    const { app } = await buildApp();
    const { key } = await createAccount(app);
    const response = await app.request("/api/branze", { headers: authHeaders(key) });
    const body = (await response.json()) as { data: unknown[]; credits_spent: number };
    expect(body.data.length).toBe(21);
    expect(body.credits_spent).toBe(1);
    const usage = (await (await app.request("/api/zuzycie", { headers: authHeaders(key) })).json()) as { balance: number; zuzycie: Record<string, number> };
    expect(usage.balance).toBe(99);
    expect(usage.zuzycie["/branze"]).toBe(1);
  });

  it("reports a pkd branch", async () => {
    const { app, deps } = await buildApp();
    const { key } = await createAccount(app);
    await deps.catalog.upsertCatalogRows([catalogRow("0000222483", "JERONIMO MARTINS", "WIELKOPOLSKIE", 100, "47.11.Z")]);
    const response = await app.request("/api/pkd/47.11.Z", { headers: authHeaders(key) });
    const body = (await response.json()) as { data: { code: string; summary: { count: number } }[] };
    expect(body.data[0]!.code).toBe("47.11.Z");
    expect(body.data[0]!.summary.count).toBe(1);
  });

  it("returns 404 for unknown pkd", async () => {
    const { app } = await buildApp();
    const { key } = await createAccount(app);
    const response = await app.request("/api/pkd/99.99.Z", { headers: authHeaders(key) });
    expect(response.status).toBe(404);
  });
});

describe("createApp — MCP", () => {
  it("lists tools via GET /mcp", async () => {
    const { app } = await buildApp();
    const response = await app.request("/mcp");
    const body = (await response.json()) as { tools: { name: string }[] };
    expect(body.tools.length).toBeGreaterThanOrEqual(9);
    expect(body.tools.map((tool) => tool.name)).toContain("get_company");
  });

  it("runs tools/call get_balance with a key", async () => {
    const { app } = await buildApp();
    const { key } = await createAccount(app);
    const response = await app.request("/mcp", {
      method: "POST",
      headers: authHeaders(key),
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "get_balance", arguments: {} } }),
    });
    const body = (await response.json()) as { result: { content: { type: string; text: string }[] } };
    expect(body.result.content[0]!.text).toContain("100");
  });

  it("runs tools/call get_company and charges", async () => {
    const { app } = await buildApp();
    const { key } = await createAccount(app);
    await app.request("/ingest/krs/0000222483", { method: "POST" });
    const response = await app.request("/mcp", {
      method: "POST",
      headers: authHeaders(key),
      body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "get_company", arguments: { krs: "0000222483" } } }),
    });
    const body = (await response.json()) as { result: { content: { text: string }[] } };
    expect(body.result.content[0]!.text).toContain("0000222483");
    expect(body.result.content[0]!.text).toContain("credits_spent");
  });

  it("rejects MCP without a key", async () => {
    const { app } = await buildApp();
    const response = await app.request("/mcp", {
      method: "POST",
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    });
    expect(response.status).toBe(401);
  });
});

function catalogRow(krs: string, name: string, voivodeship: string, przychody: number, pkdPodklasa = "47.11.Z"): CatalogRow {
  return {
    krs,
    name,
    nip: null,
    regon: null,
    legalForm: null,
    street: null,
    city: null,
    voivodeship,
    postalCode: null,
    website: null,
    email: null,
    pkdSekcja: "G",
    pkdDzial: "47",
    pkdPodklasa,
    pkdOpis: null,
    nieWykreslona: true,
    czyStatusOpp: false,
    citEstonski: false,
    ostatniKrz: 0,
    ostatniMonitor: 0,
    rok: 2024,
    przychody,
  };
}
