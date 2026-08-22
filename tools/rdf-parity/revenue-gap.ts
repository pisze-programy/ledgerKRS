import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const p2 = JSON.parse(readFileSync(join(process.cwd(), "tools", "rdf-parity", "dump", "pass2-parity.json"), "utf8"));
const near = (a: number, b: number) => Math.abs(a - b) < Math.max(1, Math.abs(b) * 1e-4);
type Row = { krs: string; year: string; ours: number; theirs: number; diff: number; mode: string; letters: string };
const rows: Row[] = [];
let simplifiedOk = 0, simplifiedBad = 0;
for (const [krs, info] of Object.entries(p2.per_company as Record<string, any>)) {
  const rzis = info.rzis ?? {};
  const theirs = info.theirs ?? {};
  for (const [year, L] of Object.entries(rzis)) {
    const t = theirs[year];
    if (!t || typeof t.przychody !== "number") continue;
    const A = L.A ?? null;
    if (A === null) continue;
    const D = L.D ?? 0, F = L.F ?? 0, G = L.G ?? 0;
    let mode: string;
    let rev: number;
    if (L.L == null && typeof L.H === "number" && typeof L.I === "number" && typeof L.J === "number" && near(L.H - L.I, L.J)) {
      rev = A + D + F;
      mode = "simplified";
      if (near(rev, t.przychody)) simplifiedOk++; else simplifiedBad++;
    } else {
      rev = A + D + G;
      mode = "income-letters";
    }
    const letters = Object.keys(L).filter((k) => /^[A-Z]$/.test(k)).join("");
    rows.push({ krs, year, ours: rev, theirs: t.przychody, diff: +(rev - t.przychody).toFixed(2), mode, letters });
  }
}
const bad = rows.filter((r) => !near(r.ours, r.theirs));
const summary = {
  generated_at: new Date().toISOString(),
  total_rows: rows.length,
  match: rows.length - bad.length,
  mismatch: bad.length,
  simplified_match: simplifiedOk,
  simplified_bad: simplifiedBad,
  mismatch_rows: bad,
};
writeFileSync(join(process.cwd(), "tools", "rdf-parity", "dump", "revenue-gap-map.json"), JSON.stringify(summary, null, 1));
console.log(`rows=${summary.total_rows} match=${summary.match} (${Math.round((summary.match / summary.total_rows) * 100)}%) mismatch=${summary.mismatch} | simplified: ok=${simplifiedOk} bad=${simplifiedBad}`);
// bucket by letters shape for mismatch
const buckets: Record<string, number> = {};
for (const r of bad) buckets[r.mode + "|" + r.letters] = (buckets[r.mode + "|" + r.letters] ?? 0) + 1;
console.log("mismatch buckets:");
for (const [k, v] of Object.entries(buckets).sort((a, b) => b[1] - a[1])) console.log(`  ${k}: ${v}`);
