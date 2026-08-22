import { describe, expect, it } from "vitest";
import { createApp } from "../../src/api/routes";
import { createIngest } from "../../src/pipeline/ingest";
import { createKrsClient } from "../../src/sources/krs/client";
import { createMemoryRepository } from "../helpers/memory-repository";
import { createMemoryBillingRepository } from "../../src/store/billing-memory";
import { createMemoryCatalogRepository } from "../../src/store/catalog-memory";
import { loadConfig } from "../../src/config";

function buildApp() {
  const repository = createMemoryRepository();
  const ingest = createIngest({
    krsClient: createKrsClient({ baseUrl: "x", fetchJson: async () => ({}) }),
    repository,
  });
  const app = createApp({
    repository,
    ingest,
    billing: createMemoryBillingRepository(),
    catalog: createMemoryCatalogRepository(),
    config: loadConfig(),
  });
  return app;
}

describe("landing page", () => {
  it("serves the polish landing by default", async () => {
    const app = buildApp();
    const response = await app.request("/");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    const html = await response.text();
    expect(html).toContain("Dane polskich firm z KRS");
    expect(html).toContain("/css/style.css");
  });

  it("serves the english landing at /en", async () => {
    const app = buildApp();
    const html = await (await app.request("/en")).text();
    expect(html).toContain("Polish company data from KRS");
    expect(html).toContain('lang="en"');
  });

  it("serves the english landing via accept-language", async () => {
    const app = buildApp();
    const html = await (await app.request("/", { headers: { "accept-language": "en-US,en;q=0.9" } })).text();
    expect(html).toContain("Polish company data from KRS");
  });

  it("honors the lang query parameter", async () => {
    const app = buildApp();
    const html = await (await app.request("/?lang=en")).text();
    expect(html).toContain("Polish company data from KRS");
  });

  it("injects the request origin into curl examples", async () => {
    const app = buildApp();
    const html = await (await app.request("https://raporty-firmowe.dev/")).text();
    expect(html).not.toContain("{{BASE}}");
  });

  it("serves the stylesheet", async () => {
    const app = buildApp();
    const response = await app.request("/css/style.css");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/css");
    expect(await response.text()).toContain("--primary");
  });

  it("serves the script", async () => {
    const app = buildApp();
    const response = await app.request("/js/main.js");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("javascript");
  });

  it("keeps the api routes working", async () => {
    const app = buildApp();
    expect(await (await app.request("/health")).json()).toEqual({ status: "ok" });
    expect((await app.request("/api/account", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "x@y.pl" }) })).status).toBe(200);
  });
});
