import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { loadCreds } from "./creds";
import { makeRdfClient, annualStatementHits } from "./rdf";
import { parseSprawozdanie } from "../../src/sources/rdf/parser";
import type { RdfSearchHit } from "../../src/sources/rdf/client";

const DUMP = join(process.cwd(), "tools", "rdf-parity", "dump");
const SAMPLE = JSON.parse(readFileSync(join(DUMP, "sample-biuletyn.json"), "utf8")) as {
  sample: { krs: string; first_seen: string }[];
};
const DUMP_PATH = join(DUMP, "pass1-structural.json");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const creds = loadCreds();
  if (!creds.rdfCookie) throw new Error("RDF_COOKIE required");
  const client = makeRdfClient(creds.rdfCookie);

  const existing = existsSync(DUMP_PATH)
    ? (JSON.parse(readFileSync(DUMP_PATH, "utf8")) as { results: Record<string, unknown>[] })
    : { results: [] as Record<string, unknown>[] };
  const done = new Set(existing.results.map((r) => r.krs as string));
  const results = existing.results;
  const limit = Number(process.env.LIMIT ?? 200);

  let consecutiveChallenges = 0;
  let challenges = 0;
  const backoffMs = Number(process.env.BACKOFF_MS ?? 40000);

  async function searchRobust(krs: string): Promise<RdfSearchHit[] | null> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await client.searchDocuments(krs);
      } catch {
        consecutiveChallenges += 1;
        challenges += 1;
        await sleep(backoffMs);
      }
    }
    return null;
  }

  async function downloadRobust(id: string): Promise<string | null> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await client.downloadXml(id);
      } catch {
        consecutiveChallenges += 1;
        challenges += 1;
        await sleep(backoffMs);
      }
    }
    return null;
  }

  for (const item of SAMPLE.sample) {
    if (results.length >= limit) break;
    const krs = item.krs;
    if (done.has(krs)) continue;
    if (consecutiveChallenges >= 3) {
      console.log(`[stop] ${consecutiveChallenges} consecutive challenges at ${krs}`);
      break;
    }
    const hits = await searchRobust(krs);
    if (hits === null) {
      results.push({ krs, status: "CHALLENGE" });
      continue;
    }
    consecutiveChallenges = 0;
    if (hits.length === 0) {
      results.push({ krs, status: "NO_DOCS" });
      await sleep(1200);
      continue;
    }
    const annual = annualStatementHits(hits);
    if (annual.length === 0) {
      results.push({ krs, status: "PDF_ONLY", docs: hits.length });
      await sleep(1200);
      continue;
    }
    const latest = annual[0]!;
    const xml = await downloadRobust(latest.id);
    let layout: string | null = null;
    let ok = false;
    if (xml) {
      const statement = parseSprawozdanie(xml);
      if (statement) {
        const sectionMatch = xml.match(/<(?:[A-Za-z0-9]+:)?(Bilans[A-Za-z]*)[\s>]/);
        const raw = sectionMatch ? sectionMatch[1]! : null;
        layout = raw && raw !== "Bilans" ? raw.replace(/^Bilans/, "") : "Bilans";
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
    await sleep(Number(process.env.PACE_MS ?? 1500));
  }

  const counts: Record<string, number> = {};
  for (const r of results) {
    const s = r.status as string;
    counts[s] = (counts[s] ?? 0) + 1;
  }
  const report = {
    generated_at: new Date().toISOString(),
    challenges,
    results_count: results.length,
    counts,
    layouts: [...new Set(results.map((r) => r.layout).filter(Boolean))],
    results,
  };
  mkdirSync(DUMP, { recursive: true });
  writeFileSync(DUMP_PATH, JSON.stringify(report, null, 2));
  console.log("challenges:", challenges, "| counts:", counts);
}

main().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
