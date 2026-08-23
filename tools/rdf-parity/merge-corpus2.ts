import { readdirSync, readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { parseSprawozdanie } from "../../src/sources/rdf/parser";

/**
 * Merge the second corpus batch (/tmp/rdf-sample2) into test/fixtures/rdf-corpus/.
 * Only firms that contribute to the comparison are copied:
 *   - at least one parseable statement XML, and
 *   - a ground-truth bizraport.json with dane_finansowe.
 * Non-parseable docs (XHTML/PDF wrappers saved as .xml) are dropped.
 * Filenames are converted to the corpus convention: 2018-01-01_2018-12-31.xml
 * -> 20180101_20181231.xml.
 */
const SRC = process.env.SRC ?? "/tmp/rdf-sample2";
const DEST = join(process.cwd(), "test", "fixtures", "rdf-corpus");
const SKIP = new Set((process.env.SKIP ?? "0000085314").split(",").filter(Boolean));

function corpusName(file: string): string | null {
  const base = file.replace(/\.xml$/, "");
  const m = base.match(/^(\d{4})-(\d{2})-(\d{2})_(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) {
    return null;
  }
  const [, y1, m1, d1, y2, m2, d2] = m;
  return `${y1}${m1}${d1}_${y2}${m2}${d2}.xml`;
}

function main(): void {
  const firms = readdirSync(SRC, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .filter((krs) => !SKIP.has(krs));

  let merged = 0;
  let skipped = 0;
  for (const krs of firms) {
    const srcDir = join(SRC, krs);
    const destDir = join(DEST, krs);

    const bizPath = join(srcDir, "bizraport.json");
    let hasData = false;
    if (existsSync(bizPath)) {
      const raw = readFileSync(bizPath, "utf8").trim();
      if (raw !== "null" && raw !== "") {
        const parsed = JSON.parse(raw);
        hasData = Boolean(parsed?.dane_finansowe?.length);
      }
    }
    if (!hasData) {
      skipped += 1;
      continue;
    }

    const statementFiles: string[] = [];
    for (const file of readdirSync(srcDir)) {
      if (!file.endsWith(".xml")) {
        continue;
      }
      const xml = readFileSync(join(srcDir, file), "utf8");
      if (!parseSprawozdanie(xml)) {
        continue;
      }
      statementFiles.push(file);
    }
    if (statementFiles.length === 0) {
      skipped += 1;
      continue;
    }

    mkdirSync(destDir, { recursive: true });
    let copied = 0;
    for (const file of statementFiles) {
      const name = corpusName(file) ?? file;
      copyFileSync(join(srcDir, file), join(destDir, name));
      copied += 1;
    }
    copyFileSync(bizPath, join(destDir, "bizraport.json"));
    merged += 1;
    console.log(`${krs}: ${copied} statements`);
  }
  console.log(`merged=${merged} skipped=${skipped}`);
}

main();
