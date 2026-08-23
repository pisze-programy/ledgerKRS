import { readFileSync, existsSync } from "node:fs";
import { fiscalYearOf } from "../../src/sources/rdf/period";
const SAMPLE: string[] = JSON.parse(readFileSync("/tmp/sample50-v2.json", "utf8"));
const CANONICAL = ["suma_bilansowa","aktywa_trwale","aktywa_obrotowe","kapital_wlasny","zobowiazania_i_rezerwy","przychody","przychody_ze_sprzedazy","koszty_sprzedanych_produktow","zysk_ze_sprzedazy","zysk_operacyjny","zysk_brutto","zysk_netto","podatek_dochodowy","amortyzacja"];
const near = (a: number, b: number) => Math.abs(a - b) < Math.max(1, Math.abs(b) * 1e-4);

/**
 * Residuals documented as BizRaport quirks / drift — our extraction is
 * correct per the current RDF documents (see analysis in PARITY.md). Each
 * entry is { year: ["indicator"] } or "*" (all canonical indicators).
 */
const KNOWN_ISSUES: Record<string, Record<number, "*" | string[]> | "*"> = {
  // BizRaport reports 2021 from a full-period filing no longer present in RDF
  // (the current filing is dormant: A=0, suma 2.19M). Our data reflects RDF.
  "0000005989": { 2021: "*" },
  // Degenerate no-revenue year (A=222.23, B=0, C=H=J=-6743.39): BizRaport
  // reports op=brutto=netto=C; we derive op from the chain.
  "0000260788": { 2022: ["zysk_ze_sprzedazy", "zysk_operacyjny"] },
  "0001014687": { 2023: ["zysk_ze_sprzedazy", "zysk_operacyjny"] },
  // Old simplified mikro: BizRaport derives op=A−B and przychody=A only, and
  // reports podatek/amortyzacja as 0 where the statement omits the line.
  "0000581370": { 2018: ["amortyzacja"], 2019: ["podatek_dochodowy"], 2020: ["przychody", "zysk_operacyjny", "podatek_dochodowy"] },
  // BizRaport's financial-income letter flips between F and G across years
  // (2018: A+D+G, 2019-2020: A+D+F); we sum income letters from the dict.
  "0000666310": { 2018: ["przychody"], 2019: ["przychody"], 2020: ["przychody"] },
  "0000846396": { 2020: ["przychody"], 2021: ["przychody"], 2023: ["amortyzacja"] },
  // BizRaport's revenue sum differs from our dict income letters by one line.
  "0000404155": { 2018: ["przychody"] },
  "0000418211": { 2018: ["przychody"] },
  // Statement has no amortyzacja line; BizRaport reports 0 where we leave null.
  "0000834318": { 2022: ["amortyzacja"] },
  // Statement files B as its revenue value (A=B=50000); BizRaport reports koszty=0.
  "0000893560": { 2023: ["koszty_sprzedanych_produktow"] },
};

function isKnown(krs: string, rok: number, ind: string): boolean {
  const entry = KNOWN_ISSUES[krs];
  if (!entry) {
    return false;
  }
  if (entry === "*") {
    return true;
  }
  const year = entry[rok];
  return year === "*" || (Array.isArray(year) && year.includes(ind));
}

function ourIndicators(krs: string): Map<number, Map<string, number>> {
  const f = `/tmp/our/${krs}.json`;
  if (!existsSync(f)) return new Map();
  const data = JSON.parse(readFileSync(f, "utf8"));
  const report = data?.data?.[0];
  const byYear = new Map<number, Map<string, number>>();
  for (const year of report?.financials ?? []) {
    const rok = year.rok ?? fiscalYearOf(year.okresSprawozdawczy);
    if (!rok) continue;
    const m = new Map<string, number>();
    for (const i of year.indicators ?? []) m.set(i.nazwa_wskaznika, i.kwota);
    if (!byYear.has(rok)) byYear.set(rok, m);
  }
  return byYear;
}

function bizIndicators(krs: string): Map<number, Map<string, number>> {
  const f = `/tmp/biz/${krs}.json`;
  if (!existsSync(f)) return new Map();
  const data = JSON.parse(readFileSync(f, "utf8"));
  const company = data?.data?.[0];
  const byYear = new Map<number, Map<string, number>>();
  for (const row of company?.dane_finansowe ?? []) {
    const rok = row.rok;
    let m = byYear.get(rok);
    if (!m) { m = new Map(); byYear.set(rok, m); }
    m.set(row.nazwa_wskaznika, row.kwota);
  }
  return byYear;
}

const counts = { total: 0, match: 0, mismatch: 0, onlyTheirs: 0, documented: 0 };
const perCompany: Record<string, { years: number; match: number; total: number; mismatchPct: number; documented: number; monitorOurs: number; monitorBiz: number; histOurs: number; histBiz: number; krzBiz: number }> = {};

for (const krs of SAMPLE) {
  const our = ourIndicators(krs);
  const biz = bizIndicators(krs);
  if (our.size === 0 || biz.size === 0) {
    perCompany[krs] = { years: our.size, match: 0, total: 0, mismatchPct: 100, documented: 0, monitorOurs: 0, monitorBiz: 0, histOurs: 0, histBiz: 0, krzBiz: 0 };
    continue;
  }
  let cmp = 0, matched = 0, documented = 0;
  for (const [rok, om] of our) {
    const bm = biz.get(rok);
    if (!bm) continue;
    for (const ind of CANONICAL) {
      const ov = om.get(ind), bv = bm.get(ind);
      if (bv === undefined) continue;
      counts.total++;
      cmp++;
      if (ov === undefined) {
        if (isKnown(krs, rok, ind)) { counts.documented++; documented++; }
        else { counts.onlyTheirs++; }
        continue;
      }
      if (near(ov, bv)) { counts.match++; matched++; continue; }
      if (isKnown(krs, rok, ind)) { counts.documented++; documented++; continue; }
      counts.mismatch++;
    }
  }
  const ourReport = JSON.parse(readFileSync(`/tmp/our/${krs}.json`, "utf8"))?.data?.[0];
  const bizReport = JSON.parse(readFileSync(`/tmp/biz/${krs}.json`, "utf8"))?.data?.[0];
  const unexplained = cmp - matched - documented;
  perCompany[krs] = {
    years: our.size,
    match: matched, total: cmp,
    documented,
    mismatchPct: cmp ? Math.round((unexplained / cmp) * 100) : 100,
    monitorOurs: (ourReport?.monitor ?? []).length,
    monitorBiz: (bizReport?.monitor_sadowy ?? []).length,
    histOurs: (ourReport?.history ?? []).length,
    histBiz: (bizReport?.historia_sprawozdan ?? []).length,
    krzBiz: Array.isArray(bizReport?.krz) ? bizReport.krz.length : 0,
  };
}

console.log("== per company (mismatch% = niewyjaśnione reszty) ==");
for (const krs of SAMPLE) {
  const p = perCompany[krs]!;
  console.log(`${krs}: years=${p.years} match=${p.match}/${p.total} (mismatch ${p.mismatchPct}%${p.documented ? `, doc=${p.documented}` : ""}) | monitor ${p.monitorOurs}/${p.monitorBiz} | hist ${p.histOurs}/${p.histBiz}${p.krzBiz ? ` | KRZ ${p.krzBiz}` : ""}`);
}
const aggPct = counts.total ? Math.round(((counts.match + counts.documented) / counts.total) * 100) : 0;
console.log(`\nAGGREGATE: match=${counts.match}/${counts.total} (${aggPct}% z udokumentowanymi) mismatch(bezwzględny)=${counts.mismatch} documented=${counts.documented} onlyTheirs=${counts.onlyTheirs}`);
