import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createApp } from "../../src/api/routes";
import { createIngest } from "../../src/pipeline/ingest";
import { createKrsClient } from "../../src/sources/krs/client";
import { createMemoryRepository } from "../helpers/memory-repository";
import { createMemoryBillingRepository } from "../../src/store/billing-memory";
import { createMemoryCatalogRepository } from "../../src/store/catalog-memory";
import { fsFetchAsset } from "../helpers/assets";
import { loadConfig } from "../../src/config";
import { SECTIONS } from "../../src/web/landing";

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
    fetchAsset: fsFetchAsset(),
  });
  return app;
}

describe("landing page", () => {
  it("serves the polish landing at /", async () => {
    const app = buildApp();
    const response = await app.request("/");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    const html = await response.text();
    expect(html).toContain("Sprawozdania firmowe dla Twojego");
    expect(html).toContain('lang="pl"');
  });

  it("serves the english landing at /en", async () => {
    const app = buildApp();
    const html = await (await app.request("/en")).text();
    expect(html).toContain("Financial statements for your");
    expect(html).toContain('lang="en"');
  });

  it("serves polish at / regardless of accept-language", async () => {
    const app = buildApp();
    const html = await (await app.request("/", { headers: { "accept-language": "en-US,en;q=0.9" } })).text();
    expect(html).toContain("Sprawozdania firmowe dla Twojego");
  });

  it("honors the lang query parameter", async () => {
    const app = buildApp();
    const html = await (await app.request("/?lang=en")).text();
    expect(html).toContain("Financial statements for your");
  });

  it("links every section css and js asset", async () => {
    const app = buildApp();
    const html = await (await app.request("/")).text();
    for (const section of SECTIONS) {
      expect(html).toContain(`href="${section.css}"`);
      expect(html).toContain(`src="${section.js}"`);
    }
  });

  it("marks every section with a data-accent", async () => {
    const app = buildApp();
    const html = await (await app.request("/")).text();
    const accents = (html.match(/data-accent="/g) ?? []).length;
    expect(accents).toBe(SECTIONS.length);
  });

  it("injects the request origin into curl examples", async () => {
    const app = buildApp();
    const html = await (await app.request("https://raporty-firmowe.dev/")).text();
    expect(html).not.toContain("{{BASE}}");
    expect(html).toContain("https://raporty-firmowe.dev/api/dane");
  });

  it("keeps the api routes working", async () => {
    const app = buildApp();
    expect(await (await app.request("/health")).json()).toEqual({ status: "ok" });
    const account = await app.request("/api/account", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "x@y.pl" }),
    });
    expect(account.status).toBe(200);
  });
});

describe("section files", () => {
  it("every section has pl.html, en.html, css and js on disk", () => {
    for (const section of SECTIONS) {
      if (section.id === "api") {
        expect(existsSync(join(process.cwd(), "public", `sections/${section.id}/${section.id}.css`)), "api css").toBe(true);
        expect(existsSync(join(process.cwd(), "public", `sections/${section.id}/${section.id}.js`)), "api js").toBe(true);
        continue;
      }
      expect(existsSync(join(process.cwd(), "public", `sections/${section.id}/pl.html`)), `${section.id} pl.html`).toBe(true);
      expect(existsSync(join(process.cwd(), "public", `sections/${section.id}/en.html`)), `${section.id} en.html`).toBe(true);
      expect(existsSync(join(process.cwd(), "public", `sections/${section.id}/${section.id}.css`)), `${section.id} css`).toBe(true);
      expect(existsSync(join(process.cwd(), "public", `sections/${section.id}/${section.id}.js`)), `${section.id} js`).toBe(true);
    }
  });

  it("base assets exist", () => {
    for (const file of ["base.css", "main.js", "shell.html"]) {
      expect(existsSync(join(process.cwd(), "public", "base", file)), file).toBe(true);
    }
  });
});

describe("explorers", () => {
  function readPublic(relative: string): string {
    return readFileSync(join(process.cwd(), "public", relative), "utf-8");
  }

  it("renders the api accordion from the openapi contract", async () => {
    const app = buildApp();
    const html = await (await app.request("/")).text();
    const rows = (html.match(/class="api-item"/g) ?? []).length;
    expect(rows).toBe(10);
    expect(html).toContain("/api/account");
    expect(html).toContain("/api/pkd/{code}");
    expect(html).toContain("/api/raport");
    expect(html).toContain("Parametry");
    expect(html).toContain("Request");
    expect(html).toContain("Response — schema");
    expect(html).not.toContain("data-explorer=");
  });

  it("response schema documents the real report fields", async () => {
    const app = buildApp();
    const html = await (await app.request("/")).text();
    for (const field of ["company", "connections", "ownership", "financials", "monitor", "krz", "history", "descriptions", "benchmarks"]) {
      expect(html).toContain(field);
    }
  });

  it("serves the openapi document", async () => {
    const app = buildApp();
    const response = await app.request("/openapi.json");
    expect(response.status).toBe(200);
    const doc = (await response.json()) as { openapi: string; paths: Record<string, unknown> };
    expect(doc.openapi).toContain("3.");
    expect(doc.paths["/api/dane"]).toBeDefined();
    expect(Object.keys(doc.paths).length).toBeGreaterThanOrEqual(9);
  });

  it("agenci section lists opencode and drops harness chips", () => {
    const html = readPublic("sections/agenci/pl.html");
    expect(html).toContain("opencode");
    expect(html).not.toContain("LangChain");
    expect(html).not.toContain("CrewAI");
  });

  it("hero and closing CTAs point to #start, not to the api endpoint", () => {
    const hero = readPublic("sections/hero/pl.html");
    const closing = readPublic("sections/closing/pl.html");
    expect(hero).toContain('href="#start"');
    expect(closing).toContain('href="#start"');
    expect(hero).not.toContain('href="/api/account"');
    expect(closing).not.toContain('href="/api/account"');
  });

  it("base main.js wires the explorer tabs and select", () => {
    const js = readPublic("base/main.js");
    expect(js).toContain(".explorer-tab");
    expect(js).toContain(".explorer-select");
    expect(js).toContain("addEventListener");
  });
});
