/**
 * Render a `/api/dane` response into a standalone HTML report for viewing in
 * a browser. Fetches the live API (localhost dev by default) for a KRS and
 * writes a readable HTML file.
 *
 * Run:
 *   DANE_KEY=<api key> npx tsx tools/rdf-parity/render-dane.ts --krs 0000951852
 * Env:
 *   DANE_BASE (default http://127.0.0.1:8787), DANE_KEY
 * Output: /tmp/dane-<krs>.html
 */

import { writeFileSync } from "node:fs";
import { createLogger } from "../../src/lib/logger";

const log = createLogger("render-dane");

interface Report {
  krs?: string;
  nip?: string | null;
  regon?: string | null;
  kod_pkd?: string | null;
  opis_pkd?: string | null;
  informacje_o_firmie?: Record<string, unknown> | null;
  summary?: Record<string, unknown> | null;
  finansowe?: { okres_sprawozdawczy: string; rok: number | null; wskazniki: Record<string, number | null> }[];
  monitor?: { numerOgloszenia?: string; nrMonitora?: string; rozdzial?: string; trescOgloszenia?: string; dataPublikacji?: string }[];
  krz?: unknown[];
  historia_sprawozdan?: { okresSprawozdawczy?: string; rok?: number | null; terminZlozenia?: string; dataDodaniaDoKrs?: string }[];
  terminowosc?: Record<string, number>;
  pozycja_na_tle_branzy?: unknown[];
  opisy_firmy?: { opis?: string; punktKluczowy1?: string }[];
  powiazania?: { typPodmiotu?: string; nazwa?: string; typPowiazania?: string; funkcja?: string | null }[];
  udzialowcy?: { typPodmiotu?: string; nazwa?: string }[];
  podobne_organizacje?: unknown[];
}

function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function infoRows(info: Record<string, unknown> | null | undefined): string {
  if (!info) {
    return "<tr><td colspan=2>brak</td></tr>";
  }
  return Object.entries(info)
    .map(([k, v]) => `<tr><td class="k">${esc(k)}</td><td>${esc(v)}</td></tr>`)
    .join("\n");
}

function fmt(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "<span class=muted>null</span>";
  }
  return new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 2 }).format(value);
}

function finansoweRows(finansowe: Report["finansowe"]): string {
  if (!finansowe || finansowe.length === 0) {
    return "<tr><td>brak danych finansowych</td></tr>";
  }
  return finansowe
    .flatMap((f) =>
      Object.entries(f.wskazniki ?? {}).map(
        ([name, v]) => `<tr><td class="k">${esc(name)}</td><td>${fmt(v)}</td></tr>`,
      ),
    )
    .join("\n");
}

function main(): void {
  const args = process.argv.slice(2);
  const krs = args[args.indexOf("--krs") + 1];
  const base = process.env.DANE_BASE ?? "http://127.0.0.1:8787";
  const key = process.env.DANE_KEY ?? "";
  if (!krs) {
    log.error("usage: --krs <number>");
    process.exit(1);
  }
  const url = `${base}/api/dane?krs=${encodeURIComponent(krs)}`;
  fetch(url, { headers: key ? { "X-API-Key": key } : {} })
    .then((r) => r.json() as Promise<{ data: Report[] }>)
    .then((body) => {
      const report = body.data?.[0];
      const html = `<!doctype html>
<html lang="pl"><head><meta charset="utf-8"><title>Raport ${esc(krs)}</title>
<style>
body{font-family:system-ui,Segoe UI,Roboto,sans-serif;margin:0;background:#f4f5f7;color:#1f2937}
.wrap{max-width:960px;margin:0 auto;padding:24px}
h1{font-size:22px;margin:0 0 4px}h2{font-size:15px;margin:28px 0 8px;border-bottom:1px solid #d1d5db;padding-bottom:6px;text-transform:uppercase;letter-spacing:.04em;color:#374151}
table{width:100%;border-collapse:collapse;background:#fff;font-size:13px}
td{border:1px solid #e5e7eb;padding:6px 8px;vertical-align:top}
td.k{background:#f9fafb;font-weight:600;width:220px;color:#4b5563}
.card{background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin-top:8px}
.badge{display:inline-block;background:#eef2ff;color:#4338ca;border-radius:999px;padding:2px 10px;font-size:12px;margin-right:6px}
.muted{color:#9ca3af}
.neg{color:#dc2626}.pos{color:#059669}
.mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px}
</style></head><body><div class="wrap">
<h1>${esc(report?.informacje_o_firmie?.name ?? report?.krs ?? krs)}</h1>
<div class="badge">${esc(report?.informacje_o_firmie?.legalForm ?? "—")}</div>
<div class="badge">KRS ${esc(report?.krs ?? "")}</div>
<div class="badge">NIP ${esc(report?.nip ?? "—")}</div>
<div class="badge">PKD ${esc(report?.kod_pkd ?? "—")} ${esc(report?.opis_pkd ?? "")}</div>

<h2>Informacje o firmie</h2>
<div class="card"><table>${infoRows(report?.informacje_o_firmie ?? null)}</table></div>

<h2>Podsumowanie</h2>
<div class="card"><table>${infoRows(report?.summary ?? null)}</table></div>

<h2>Finanse (wskazniki)</h2>
<div class="card"><table>${finansoweRows(report?.finansowe)}</table></div>

<h2>Terminowość</h2>
<div class="card"><table>${infoRows(report?.terminowosc ?? null)}</table></div>

<h2>Monitor Sądowy</h2>
<div class="card">${(report?.monitor ?? []).map((m) => `<div style="margin-bottom:12px"><div class="badge">${esc(m.nrMonitora ?? "")}</div><div class="badge">${esc(m.dataPublikacji ?? "")}</div><div class="muted">${esc(m.rozdzial ?? "")}</div><div class="mono">${esc(m.trescOgloszenia ?? "")}</div></div>`).join("")}</div>

<h2>Powiązania</h2>
<div class="card"><table><tr><th>Typ</th><th>Nazwa</th><th>Rodzaj</th><th>Funkcja</th></tr>${(report?.powiazania ?? []).map((p) => `<tr><td>${esc(p.typPodmiotu)}</td><td>${esc(p.nazwa)}</td><td>${esc(p.typPowiazania)}</td><td>${esc(p.funkcja)}</td></tr>`).join("")}</table></div>

<h2>Opis firmy</h2>
<div class="card">${esc(report?.opisy_firmy?.[0]?.opis ?? "—")}</div>
</div></body></html>`;
      const out = `/tmp/dane-${krs}.html`;
      writeFileSync(out, html);
      log.info("report written", { path: out, bytes: html.length });
    })
    .catch((error) => {
      log.error("failed", { error: String(error) });
      process.exit(1);
    });
}

main();
