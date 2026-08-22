import { Hono } from "hono";
import { CSS_PATH, JS_PATH, renderLanding, type WebLang } from "./landing";
import styleRaw from "./css/style.txt?raw";
import mainJsRaw from "./js/main.txt?raw";

const style = rawText(styleRaw);
const mainJs = rawText(mainJsRaw);

function rawText(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (value && typeof value === "object" && "default" in value) {
    const nested = (value as { default: unknown }).default;
    return typeof nested === "string" ? nested : "";
  }
  return "";
}

export function createWebRoutes(): Hono {
  const app = new Hono();

  app.get("/", (c) => {
    const lang = pickLang(c.req.query("lang"), c.req.header("accept-language"));
    return renderLanding(lang, originOf(c.req.url));
  });

  app.get("/pl", (c) => renderLanding("pl", originOf(c.req.url)));
  app.get("/en", (c) => renderLanding("en", originOf(c.req.url)));

  app.get(CSS_PATH, (c) =>
    new Response(style, { headers: { "content-type": "text/css; charset=utf-8", "cache-control": "public, max-age=3600" } }),
  );
  app.get(JS_PATH, (c) =>
    new Response(mainJs, { headers: { "content-type": "application/javascript; charset=utf-8", "cache-control": "public, max-age=3600" } }),
  );

  return app;
}

function pickLang(query: string | undefined, acceptLanguage: string | undefined): WebLang {
  if (query === "en") {
    return "en";
  }
  if (query === "pl") {
    return "pl";
  }
  return (acceptLanguage ?? "").toLowerCase().startsWith("en") ? "en" : "pl";
}

function originOf(url: string): string {
  return new URL(url).origin;
}
