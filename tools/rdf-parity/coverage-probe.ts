import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Coverage probe for a directory of downloaded RDF samples (/tmp/rdf-sample2).
 * Reports how many firms are XML-capable vs PDF-only vs have no annual
 * statements at all, plus the per-layout distribution of firms and statements.
 * Also flags companies with fiscal years that are not 12-month calendar years
 * (period-length extremes worth a dedicated fixture).
 */
const DIR = process.env.DIR ?? "/tmp/rdf-sample2";

interface FirmMeta {
  krs: string;
  hits_total: number;
  hits_annual: number;
  xml_files: string[];
  layouts: string[];
  layout_distinct: string[];
  pdf_only: boolean;
  no_annual: boolean;
}

function main(): void {
  const firms: FirmMeta[] = [];
  for (const name of readdirSync(DIR, { withFileTypes: true })) {
    if (!name.isDirectory()) {
      continue;
    }
    const metaPath = join(DIR, name.name, "meta.json");
    if (!existsSync(metaPath)) {
      continue;
    }
    firms.push(JSON.parse(readFileSync(metaPath, "utf8")) as FirmMeta);
  }

  const withXml = firms.filter((f) => f.xml_files.length > 0);
  const pdfOnly = firms.filter((f) => f.pdf_only);
  const noAnnual = firms.filter((f) => f.no_annual);

  const layoutFirms = new Map<string, Set<string>>();
  const layoutFiles = new Map<string, number>();
  for (const firm of withXml) {
    for (const layout of firm.layout_distinct) {
      layoutFirms.set(layout, (layoutFirms.get(layout) ?? new Set()).add(firm.krs));
    }
    for (const layout of firm.layouts) {
      layoutFiles.set(layout, (layoutFiles.get(layout) ?? 0) + 1);
    }
  }

  console.log(`SAMPLE: ${firms.length} firms, ${withXml.length} XML-capable, ${pdfOnly.length} PDF-only, ${noAnnual.length} no annual statements`);
  console.log(`  XML files total: ${withXml.reduce((s, f) => s + f.xml_files.length, 0)}`);
  console.log(`  XML-capable rate: ${(withXml.length / Math.max(1, firms.length) * 100).toFixed(1)}% of drawn firms`);

  console.log("\nLAYOUT DISTRIBUTION (XML-capable firms):");
  for (const [layout, firmSet] of [...layoutFirms.entries()].sort((a, b) => b[1].size - a[1].size)) {
    console.log(`  ${layout}: ${firmSet.size} firms, ${layoutFiles.get(layout)} statements`);
  }

  // Period-length extremes: fiscal years that are clearly not ~365 days.
  console.log("\nFISCAL-YEAR EXTREMES (non-calendar / transitional / partial):");
  const extremes: { krs: string; periods: string[] }[] = [];
  for (const firm of withXml) {
    const periods: string[] = [];
    for (const file of firm.xml_files) {
      const base = file.replace(/\.xml$/, "");
      if (base.startsWith("doc-")) {
        continue;
      }
      const [from, to] = base.split("_");
      if (from && to) {
        periods.push(`${from}..${to}`);
      }
    }
    if (periods.some((p) => {
      const [f, t] = p.split("..");
      const a = new Date(f).getTime();
      const b = new Date(t).getTime();
      const days = (b - a) / 86_400_000;
      return Math.abs(days - 365) > 45 && days > 0;
    })) {
      extremes.push({ krs: firm.krs, periods });
    }
  }
  for (const e of extremes) {
    console.log(`  ${e.krs}: ${e.periods.join(", ")}`);
  }
}

main();
