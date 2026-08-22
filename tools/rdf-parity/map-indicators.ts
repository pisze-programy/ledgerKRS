import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const DUMP = join(process.cwd(), "tools", "rdf-parity", "dump");
const dicts = JSON.parse(readFileSync(join(DUMP, "layout-dicts.json"), "utf8")) as Record<
  string,
  { label: string; names: Record<string, string> }
>;

const DIACRITICS: Record<string, string> = {
  ą: "a", ć: "c", ę: "e", ł: "l", ń: "n", ó: "o", ś: "s", ź: "z", ż: "z",
  Ą: "A", Ć: "C", Ę: "E", Ł: "L", Ń: "N", Ó: "O", Ś: "S", Ź: "Z", Ż: "Z",
};
const normalize = (s: string) =>
  s
    .split("")
    .map((c) => DIACRITICS[c] ?? c)
    .join("")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

interface Matcher {
  needle: string;
  preferExact?: boolean;
  preferRzis?: boolean;
}

const TARGETS: Record<string, Matcher[]> = {
  suma_bilansowa: [{ needle: "aktywa razem", preferExact: true }],
  aktywa_trwale: [{ needle: "aktywa trwale", preferExact: true }],
  aktywa_obrotowe: [{ needle: "aktywa obrotowe", preferExact: true }],
  kapital_wlasny: [{ needle: "kapital fundusz wlasny", preferExact: true }],
  zobowiazania_i_rezerwy: [{ needle: "zobowiazania i rezerwy na zobowiazania" }],
  przychody: [{ needle: "przychody netto ze sprzedazy", preferRzis: true }],
  koszty_sprzedanych_produktow: [{ needle: "koszty dzialalnosci operacyjnej", preferRzis: true }],
  zysk_ze_sprzedazy: [{ needle: "zysk strata ze sprzedazy", preferRzis: true }],
  zysk_operacyjny: [{ needle: "zysk strata z dzialalnosci operacyjnej", preferRzis: true }],
  zysk_brutto: [{ needle: "zysk strata brutto", preferExact: true, preferRzis: true }],
  zysk_netto: [{ needle: "zysk strata netto", preferExact: true, preferRzis: true }],
  podatek_dochodowy: [{ needle: "podatek dochodowy", preferExact: true, preferRzis: true }],
  amortyzacja: [{ needle: "amortyzacja", preferExact: true, preferRzis: true }],
};

function score(key: string, matcher: Matcher): number {
  let s = 0;
  if (matcher.preferRzis && key.startsWith("RZiS.")) s += 2;
  if (key.startsWith("Bilans.")) s += 1;
  return s;
}

function bestMatch(entries: [string, string][], matchers: Matcher[]): [string, string] | null {
  let best: [string, string] | null = null;
  let bestScore = -1;
  for (const m of matchers) {
    const needle = normalize(m.needle);
    for (const [key, doc] of entries) {
      const dn = normalize(doc);
      const ok = key.startsWith("RZiS.") ? dn.startsWith(needle) : m.preferExact ? dn === needle : dn.includes(needle);
      if (!ok) continue;
      const s = score(key, m);
      if (s > bestScore) {
        bestScore = s;
        best = [key, doc];
      }
    }
  }
  return best;
}

const out: Record<string, { label: string; map: Record<string, [string, string]> }> = {};
for (const [layout, { label, names }] of Object.entries(dicts)) {
  const entries = Object.entries(names).filter(([k]) => k.startsWith("Bilans.") || k.startsWith("RZiS."));
  const map: Record<string, [string, string]> = {};
  for (const [indicator, matchers] of Object.entries(TARGETS)) {
    const hit = bestMatch(entries, matchers);
    if (hit) map[indicator] = hit;
  }
  out[layout] = { label, map };
}
writeFileSync(join(DUMP, "layout-indicator-map.json"), JSON.stringify(out, null, 1));
for (const [layout, v] of Object.entries(out)) {
  console.log(`=== ${layout} ===`);
  for (const [ind, [code, doc]] of Object.entries(v.map)) {
    console.log(`  ${ind} -> ${code} (${doc.slice(0, 55)})`);
  }
}
