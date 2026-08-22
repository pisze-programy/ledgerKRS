import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const DUMP = join(process.cwd(), "tools", "rdf-parity", "dump");
const p2 = JSON.parse(readFileSync(join(DUMP, "pass2-parity.json"), "utf8")) as {
  per_company: Record<string, any>;
};
const p1 = JSON.parse(readFileSync(join(DUMP, "pass1-structural.json"), "utf8")) as {
  results: { krs: string; layout: string | null }[];
};
const layoutOf = new Map(p1.results.map((r) => [r.krs, r.layout ?? "Bilans"]));

const PNL = ["przychody", "koszty_sprzedanych_produktow", "zysk_ze_sprzedazy", "zysk_operacyjny", "zysk_brutto", "podatek_dochodowy", "zysk_netto"] as const;

function near(a: number | null, b: number | null): boolean {
  if (a === null || b === null) return false;
  return Math.abs(a - b) < Math.max(1, Math.abs(b) * 1e-4);
}

// votes[layout][code][indicator] = count
const votes = new Map<string, Map<string, Map<string, number>>>();

for (const [krs, info] of Object.entries(p2.per_company)) {
  const layout = layoutOf.get(krs) ?? "Bilans";
  const rzis = info.rzis as Record<string, Record<string, number | null>>;
  const theirs = info.theirs as Record<string, Record<string, number | null>>;
  if (!rzis || !theirs) continue;
  for (const [yearStr, codes] of Object.entries(rzis)) {
    const their = theirs[yearStr];
    if (!their) continue;
    for (const indicator of PNL) {
      const target = their[indicator] ?? null;
      if (target === null || target === 0) continue;
      for (const [code, value] of Object.entries(codes)) {
        if (value !== null && near(value, target)) {
          const codeMap = votes.get(layout) ?? new Map<string, Map<string, number>>();
          const indMap = codeMap.get(code) ?? new Map<string, number>();
          indMap.set(indicator, (indMap.get(indicator) ?? 0) + 1);
          codeMap.set(code, indMap);
          votes.set(layout, codeMap);
        }
      }
    }
  }
}

const out: Record<string, unknown> = {};
for (const [layout, codeMap] of votes) {
  const mapping: Record<string, { indicator: string; votes: number }> = {};
  for (const [code, indMap] of codeMap) {
    const [bestInd, bestVotes] = [...indMap.entries()].sort((a, b) => b[1] - a[1])[0]!;
    mapping[code] = { indicator: bestInd, votes: bestVotes };
  }
  out[layout] = mapping;
}
writeFileSync(join(DUMP, "layout-rzis-mapping.json"), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
