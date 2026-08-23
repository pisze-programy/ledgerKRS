import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseSprawozdanie } from "../../src/sources/rdf/parser";
import { statementMeta } from "../../src/sources/rdf/layouts";
import { extractFinancialInput } from "../../src/sources/rdf/indicators";
import { computeIndicators } from "../../src/metrics/indicators";
import { selectAnnualYears } from "../../src/sources/rdf/selection";
import { compareYear } from "../../tools/rdf-parity/compare";
import { isKnownIssue } from "../../test/unit/known-issues";

const CORPUS = join(process.cwd(), "test", "fixtures", "rdf-corpus");

/**
 * Coverage report for the XML corpus: per-layout firm/year counts, the
 * aggregate match rate against BizRaport ground truth (with documented
 * residuals), and firms that are PDF-only / no-annual in the draw sample.
 */
function main(): void {
  const firms = readdirSync(CORPUS, { withFileTypes: true }).filter((e) => e.isDirectory());
  const layoutFirms = new Map<string, Set<string>>();
  const layoutYears = new Map<string, number>();
  let companies = 0;
  let years = 0;
  let rows = 0;
  let match = 0;
  let documented = 0;
  let onlyTheirs = 0;
  let onlyOurs = 0;
  let totalMatched = 0;

  for (const firm of firms) {
    const krs = firm.name;
    const files = readdirSync(join(CORPUS, krs)).filter((f) => f.endsWith(".xml"));
    const bizPath = join(CORPUS, krs, "bizraport.json");
    let biz;
    try {
      biz = JSON.parse(readFileSync(bizPath, "utf8"));
    } catch {
      continue;
    }
    const theirs = new Map<number, Map<string, number>>();
    for (const r of biz?.dane_finansowe ?? []) {
      let m = theirs.get(r.rok);
      if (!m) {
        m = new Map();
        theirs.set(r.rok, m);
      }
      m.set(r.nazwa_wskaznika, r.kwota);
    }
    const cands: { id: string; rodzaj: string; okres: string | null; dataDodania: null }[] = [];
    const parsed: { file: string; xml: string; statement: ReturnType<typeof parseSprawozdanie> }[] = [];
    for (const file of files) {
      const xml = readFileSync(join(CORPUS, krs, file), "utf8");
      const statement = parseSprawozdanie(xml);
      if (!statement) {
        continue;
      }
      parsed.push({ file, xml, statement });
      cands.push({ id: file, rodzaj: "18", okres: statement.okres_sprawozdawczy, dataDodania: null });
    }
    const winners = new Set(selectAnnualYears(cands).map((s) => s.candidate.id));
    let companyHasMatch = false;
    for (const { file, xml, statement } of parsed) {
      if (!winners.has(file)) {
        continue;
      }
      const meta = statementMeta(xml);
      layoutFirms.set(meta.layout, (layoutFirms.get(meta.layout) ?? new Set()).add(krs));
      const year = extractFinancialInput(statement, meta);
      if (!year) {
        continue;
      }
      const rok = year.rok ?? Number(file.slice(0, 4));
      layoutYears.set(meta.layout, (layoutYears.get(meta.layout) ?? 0) + 1);
      const tm = theirs.get(rok);
      if (!tm) {
        continue;
      }
      const ours = new Map(computeIndicators(year.input as never).map((i) => [i.nazwa_wskaznika, i.kwota]));
      let compared = 0;
      for (const r of compareYear(rok, ours, tm).filter((r) => r.theirs !== null)) {
        compared += 1;
        if (r.match) {
          match += 1;
        } else if (isKnownIssue(krs, rok, r.indicator)) {
          documented += 1;
        } else if (r.ours === null) {
          onlyTheirs += 1;
        } else {
          onlyOurs += 1;
        }
      }
      rows += compared;
      totalMatched += 1;
      companyHasMatch ||= compared > 0;
    }
    if (companyHasMatch) {
      companies += 1;
      years += winners.size;
    }
  }

  console.log("== rdf-corpus coverage ==");
  console.log(`firms with matched data: ${companies}`);
  console.log(`fiscal years compared: ${years}`);
  console.log(`indicator cells: ${rows} (match=${match}, documented=${documented}, only_theirs=${onlyTheirs}, only_ours=${onlyOurs})`);
  const pct = rows ? Math.round(((match + documented) / rows) * 100) : 0;
  console.log(`match rate incl. documented residuals: ${pct}% (undocumented: ${onlyTheirs + onlyOurs})`);
  console.log("\nper-layout (firms / statement-years):");
  for (const [layout, firmSet] of [...layoutFirms.entries()].sort((a, b) => b[1].size - a[1].size)) {
    console.log(`  ${layout}: ${firmSet.size} firms / ${layoutYears.get(layout)} statement-years`);
  }
  console.log("\nnotes:");
  console.log("  SFBNKZ (banks): file XHTML/PDF in RDF -> PDF stage (not XML).");
  console.log("  SFZURZ (insurers): insurance-technical layout, deferred (PARITY.md).");
}

main();
