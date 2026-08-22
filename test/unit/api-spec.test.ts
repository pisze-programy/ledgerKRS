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
import { API_SCHEMAS, buildOpenApiDocument } from "../../src/api/contract";
import type { CatalogRow } from "../../src/store/catalog";

function buildApp() {
  const repository = createMemoryRepository();
  const catalog = createMemoryCatalogRepository();
  const krsClient = createKrsClient({
    baseUrl: "https://api-krs.ms.gov.pl",
    fetchJson: async () =>
      JSON.parse(readFileSync(join(process.cwd(), "test", "fixtures", "krs-jeronimo.json"), "utf-8")),
  });
  const ingest = createIngest({ krsClient, repository });
  const app = createApp({
    repository,
    ingest,
    billing: createMemoryBillingRepository(),
    catalog,
    config: loadConfig({ FREE_CREDITS: "100" }),
    fetchAsset: fsFetchAsset(),
  });
  return { app, repository, catalog };
}

async function createKey(app: ReturnType<typeof createApp>): Promise<string> {
  const response = await app.request("/api/account", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "spec@test.pl" }),
  });
  const body = (await response.json()) as { api_key: string };
  return body.api_key;
}

function headers(key: string): Record<string, string> {
  return { "x-api-key": key, "content-type": "application/json" };
}

describe("api contract parity", () => {
  it("account response matches the contract schema", async () => {
    const { app } = buildApp();
    const response = await app.request("/api/account", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "spec@test.pl" }),
    });
    const body = await response.json();
    expect(API_SCHEMAS.account.safeParse(body).success).toBe(true);
  });

  it("dane response matches the contract schema", async () => {
    const { app } = buildApp();
    const key = await createKey(app);
    await app.request("/ingest/krs/0000222483", { method: "POST" });
    const response = await app.request("/api/dane?krs=0000222483", { headers: headers(key) });
    const body = await response.json();
    const parsed = API_SCHEMAS.dane.safeParse(body);
    expect(parsed.success, JSON.stringify(parsed.error?.issues ?? [], null, 1).slice(0, 600)).toBe(true);
  });

  it("sprawozdania response matches the contract schema", async () => {
    const { app } = buildApp();
    const key = await createKey(app);
    const response = await app.request("/api/sprawozdania?krs=0000597711", { headers: headers(key) });
    const body = await response.json();
    expect(API_SCHEMAS.sprawozdania.safeParse(body).success).toBe(true);
  });

  it("katalog response matches the contract schema", async () => {
    const { app, catalog } = buildApp();
    const key = await createKey(app);
    const rows: CatalogRow[] = [
      catalogRow("0000222483", "JERONIMO MARTINS", "WIELKOPOLSKIE", 100),
      catalogRow("0000597711", "LIDL SP. K.", "WIELKOPOLSKIE", 50),
    ];
    await catalog.upsertCatalogRows(rows);
    const response = await app.request("/api/katalog?przychody_od=60", { headers: headers(key) });
    const body = await response.json();
    const parsed = API_SCHEMAS.katalog.safeParse(body);
    expect(parsed.success, JSON.stringify(parsed.error?.issues ?? []).slice(0, 600)).toBe(true);
  });

  it("szukaj response matches the contract schema", async () => {
    const { app, catalog } = buildApp();
    const key = await createKey(app);
    await catalog.upsertCatalogRows([catalogRow("0000222483", "JERONIMO MARTINS", "WIELKOPOLSKIE", 100)]);
    const response = await app.request("/api/szukaj?q=jer", { headers: headers(key) });
    const body = await response.json();
    expect(API_SCHEMAS.szukaj.safeParse(body).success).toBe(true);
  });

  it("branze response matches the contract schema", async () => {
    const { app } = buildApp();
    const key = await createKey(app);
    const response = await app.request("/api/branze", { headers: headers(key) });
    const body = await response.json();
    expect(API_SCHEMAS.branze.safeParse(body).success).toBe(true);
  });

  it("pkd response matches the contract schema", async () => {
    const { app, catalog } = buildApp();
    const key = await createKey(app);
    await catalog.upsertCatalogRows([catalogRow("0000222483", "JERONIMO MARTINS", "WIELKOPOLSKIE", 100, "47.11.Z")]);
    const response = await app.request("/api/pkd/47.11.Z", { headers: headers(key) });
    const body = await response.json();
    const parsed = API_SCHEMAS.pkd.safeParse(body);
    expect(parsed.success, JSON.stringify(parsed.error?.issues ?? []).slice(0, 600)).toBe(true);
  });

  it("balance and zuzycie match the contract schema", async () => {
    const { app } = buildApp();
    const key = await createKey(app);
    const balance = await (await app.request("/api/balance", { headers: headers(key) })).json();
    expect(API_SCHEMAS.balance.safeParse(balance).success).toBe(true);
    const zuzycie = await (await app.request("/api/zuzycie", { headers: headers(key) })).json();
    expect(API_SCHEMAS.zuzycie.safeParse(zuzycie).success).toBe(true);
  });
});

describe("request validation per contract", () => {
  it("dane without krs or nip returns 400", async () => {
    const { app } = buildApp();
    const key = await createKey(app);
    const response = await app.request("/api/dane", { headers: headers(key) });
    expect(response.status).toBe(400);
  });

  it("katalog without a filter returns 400", async () => {
    const { app } = buildApp();
    const key = await createKey(app);
    const response = await app.request("/api/katalog", { headers: headers(key) });
    expect(response.status).toBe(400);
  });

  it("szukaj without q returns 400", async () => {
    const { app } = buildApp();
    const key = await createKey(app);
    const response = await app.request("/api/szukaj", { headers: headers(key) });
    expect(response.status).toBe(400);
  });

  it("account without email returns 400", async () => {
    const { app } = buildApp();
    const response = await app.request("/api/account", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(response.status).toBe(400);
  });
});

describe("openapi document", () => {
  it("covers all endpoints with parameters and schemas", () => {
    const doc = buildOpenApiDocument();
    const paths = doc.paths as Record<string, Record<string, unknown>>;
    expect(Object.keys(paths).length).toBeGreaterThanOrEqual(9);
    expect(paths["/api/dane"]).toBeDefined();
    expect(paths["/api/account"]).toBeDefined();
    const danePath = paths["/api/dane"] as { get?: { parameters?: unknown[]; responses: Record<string, unknown> } };
    const dane = danePath.get!;
    expect(dane).toBeDefined();
    expect(dane.parameters).toBeDefined();
    expect((dane.parameters as unknown[]).length).toBeGreaterThanOrEqual(2);
    expect(dane.responses["200"]).toBeDefined();
    const components = (doc as { components?: { schemas: Record<string, unknown> } }).components;
    expect(components).toBeDefined();
    const schemas = components!.schemas;
    expect(schemas["CompanyReport"]).toBeDefined();
    expect(schemas["CatalogRow"]).toBeDefined();
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
