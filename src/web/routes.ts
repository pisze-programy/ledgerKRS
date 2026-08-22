import { Hono } from "hono";
import { renderLanding, type FetchAsset, type WebLang } from "./landing";

export function createWebRoutes(fetchAsset: FetchAsset): Hono {
  const app = new Hono();

  app.get("/", async (c) => {
    const lang = pickLang(c.req.query("lang"));
    return renderLanding(lang, originOf(c.req.url), fetchAsset);
  });

  app.get("/pl", async (c) => renderLanding("pl", originOf(c.req.url), fetchAsset));
  app.get("/en", async (c) => renderLanding("en", originOf(c.req.url), fetchAsset));

  return app;
}

function pickLang(query: string | undefined): WebLang {
  return query === "en" ? "en" : "pl";
}

function originOf(url: string): string {
  return new URL(url).origin;
}
