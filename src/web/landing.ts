import { marked } from "marked";
import { shell } from "./html/shell";
import landingPl from "./md/landing.pl.txt?raw";
import landingEn from "./md/landing.en.txt?raw";

export type WebLang = "pl" | "en";

export const CSS_PATH = "/css/style.css";
export const JS_PATH = "/js/main.js";

export function renderLanding(lang: WebLang, origin: string): Response {
  const markdown = lang === "en" ? landingEn : landingPl;
  const body = marked.parse(markdown.replaceAll("{{BASE}}", origin)) as string;
  const title = lang === "en" ? "Polish company data from KRS — API and MCP" : "Dane polskich firm z KRS — API i MCP";
  const description =
    lang === "en"
      ? "Public data about Polish companies through REST API and MCP. Pay as you go: 1000 credits for 9.99 USD."
      : "Publiczne dane o polskich firmach przez REST API i MCP. Pay as you go: 1000 kredytów za 9,99 USD.";
  return new Response(
    shell({ lang, title, description, bodyHtml: body, cssPath: CSS_PATH, jsPath: JS_PATH }),
    { headers: { "content-type": "text/html; charset=utf-8" } },
  );
}
