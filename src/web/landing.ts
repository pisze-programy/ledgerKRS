export type WebLang = "pl" | "en";
export type FetchAsset = (path: string) => Promise<string | null>;

export interface SectionDef {
  id: string;
  accent: string;
  css: string;
  js: string;
  html: (lang: WebLang) => string;
}

export const SECTIONS: SectionDef[] = [
  { id: "hero", accent: "indigo", css: "/sections/hero/hero.css", js: "/sections/hero/hero.js", html: (l) => `/sections/hero/${l}.html` },
  { id: "marquee", accent: "indigo", css: "/sections/marquee/marquee.css", js: "/sections/marquee/marquee.js", html: (l) => `/sections/marquee/${l}.html` },
  { id: "data", accent: "green", css: "/sections/data/data.css", js: "/sections/data/data.js", html: (l) => `/sections/data/${l}.html` },
  { id: "zastosowania", accent: "orange", css: "/sections/zastosowania/zastosowania.css", js: "/sections/zastosowania/zastosowania.js", html: (l) => `/sections/zastosowania/${l}.html` },
  { id: "automatyzacja", accent: "teal", css: "/sections/automatyzacja/automatyzacja.css", js: "/sections/automatyzacja/automatyzacja.js", html: (l) => `/sections/automatyzacja/${l}.html` },
  { id: "mcp", accent: "fuchsia", css: "/sections/mcp/mcp.css", js: "/sections/mcp/mcp.js", html: (l) => `/sections/mcp/${l}.html` },
  { id: "agenci", accent: "fuchsia", css: "/sections/agenci/agenci.css", js: "/sections/agenci/agenci.js", html: (l) => `/sections/agenci/${l}.html` },
  { id: "api", accent: "blue", css: "/sections/api/api.css", js: "/sections/api/api.js", html: (l) => `/sections/api/${l}.html` },
  { id: "cennik", accent: "amber", css: "/sections/cennik/cennik.css", js: "/sections/cennik/cennik.js", html: (l) => `/sections/cennik/${l}.html` },
  { id: "start", accent: "green", css: "/sections/start/start.css", js: "/sections/start/start.js", html: (l) => `/sections/start/${l}.html` },
  { id: "faq", accent: "neutral", css: "/sections/faq/faq.css", js: "/sections/faq/faq.js", html: (l) => `/sections/faq/${l}.html` },
  { id: "closing", accent: "black", css: "/sections/closing/closing.css", js: "/sections/closing/closing.js", html: (l) => `/sections/closing/${l}.html` },
];

const TITLES: Record<WebLang, string> = {
  pl: "Sprawozdania firmowe dla Twojego Agenta AI — raporty-firmowe",
  en: "Financial statements for your AI Agent — raporty-firmowe",
};

const DESCRIPTIONS: Record<WebLang, string> = {
  pl: "Pełne dane z KRS przez API i MCP: raporty firm, sprawozdania, wskaźniki, wycena, ryzyko, MSiG i KRZ. 100 kredytów gratis, 1000 za 9,99 zł.",
  en: "Full KRS data through API and MCP: company reports, statements, indicators, valuation, risk, MSiG and KRZ. 100 credits free, 1000 for 9.99 PLN.",
};

export async function renderLanding(lang: WebLang, origin: string, fetchAsset: FetchAsset): Promise<Response> {
  const shell = await fetchAsset("/base/shell.html");
  if (shell === null) {
    return new Response("shell asset missing", { status: 500 });
  }
  const sections: string[] = [];
  for (const section of SECTIONS) {
    const html = await fetchAsset(section.html(lang));
    if (html !== null) {
      sections.push(html);
    }
  }
  const cssLinks = SECTIONS.map((section) => `<link rel="stylesheet" href="${section.css}">`).join("\n  ");
  const scripts = SECTIONS.map((section) => `<script src="${section.js}" defer></script>`).join("\n  ");
  const html = shell
    .replaceAll("{{LANG}}", lang)
    .replaceAll("{{TITLE}}", TITLES[lang])
    .replaceAll("{{DESC}}", DESCRIPTIONS[lang])
    .replaceAll("{{CSS_LINKS}}", cssLinks)
    .replaceAll("{{SCRIPTS}}", scripts)
    .replaceAll("{{LANG_NAV}}", langNav(lang))
    .replaceAll("{{SECTIONS}}", sections.join("\n\n  "))
    .replaceAll("{{BASE}}", origin);
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
}

function langNav(current: WebLang): string {
  return [
    `<a href="/"${current === "pl" ? ' class="active"' : ""} hreflang="pl">PL</a>`,
    `<a href="/en"${current === "en" ? ' class="active"' : ""} hreflang="en">EN</a>`,
  ].join("\n      ");
}
