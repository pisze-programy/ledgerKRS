import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { loadCreds } from "./creds";
import { makeRdfClient, annualStatementHits, withRetry } from "./rdf";
import { parseSprawozdanie } from "../../src/sources/rdf/parser";

const DUMP = join(process.cwd(), "tools", "rdf-parity", "dump");
const SAMPLE = JSON.parse(readFileSync(join(DUMP, "sample-biuletyn.json"), "utf8")) as {
  sample: { krs: string; first_seen: string }[];
};

async function main() {
  const creds = loadCreds();
  if (!creds.rdfCookie) {
    throw new Error("RDF_COOKIE required (env or tools/rdf-parity/creds.local.json)");
  }
  const client = makeRdfClient(creds.rdfCookie);
  const limit = Number(process.env.LIMIT ?? 200);
  const results: Record<string, unknown>[] = [];

  for (const item of SAMPLE.sample.slice(0, limit)) {
    const krs = item.krs;
    const hits = await withRetry(() => client.searchDocuments(krs));
    if (!hits || hits.length === 0) {
      results.push({ krs, status: "NO_DOCS" });
      continue;
    }
    const annual = annualStatementHits(hits);
    if (annual.length === 0) {
      results.push({ krs, status: "PDF_ONLY", docs: hits.length });
      continue;
    }
    const latest = annual[0]!;
    const xml = await withRetry(() => client.downloadXml(latest.id));
    let layout: string | null = null;
    let ok = false;
    if (xml) {
      const statement = parseSprawozdanie(xml);
      if (statement) {
        const rootMatch = xml.match(/<(\w+)[ >]/);
        layout = rootMatch ? rootMatch[1]! : null;
        ok = true;
      }
    }
    results.push({
      krs,
      status: ok ? "HAS_XML" : "XML_UNPARSEABLE",
      docs: hits.length,
      annual: annual.length,
      latest_year: latest.okresSprawozdawczyKoniec,
      layout,
    });
    await new Promise((r) => setTimeout(r, 300));
  }

  const counts: Record<string, number> = {};
  for (const r of results) {
    const s = r.status as string;
    counts[s] = (counts[s] ?? 0) + 1;
  }
  const report = {
    generated_at: new Date().toISOString(),
    sample_size: results.length,
    counts,
    layouts: [...new Set(results.map((r) => r.layout).filter(Boolean))],
    results,
  };
  mkdirSync(DUMP, { recursive: true });
  writeFileSync(join(DUMP, "pass1-structural.json"), JSON.stringify(report, null, 2));
  console.log("counts:", counts);
  console.log("layouts:", report.layouts);
}

main().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
