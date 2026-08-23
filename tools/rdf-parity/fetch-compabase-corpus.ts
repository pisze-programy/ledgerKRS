import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { compabaseClient } from "./compabase";

/**
 * Fetch Compabase financial statements for every corpus firm that has
 * Bizraport ground truth, caching to tools/rdf-parity/compabase-cache/
 * (gitignored). Resume-safe: firms already cached are skipped. Tracks the
 * API quota as it goes (GET /usage does not consume quota).
 */
const CORPUS = join(process.cwd(), "test", "fixtures", "rdf-corpus");
const CACHE = join(process.cwd(), "tools", "rdf-parity", "compabase-cache");

async function main(): Promise<void> {
  const client = compabaseClient();
  if (!client) {
    throw new Error("brak COMPABASE_KEY w creds.local.json");
  }
  mkdirSync(CACHE, { recursive: true });

  const usage = await client.usage();
  const remaining = usage?.remaining ?? 0;
  console.log(`Compabase quota: ${usage?.used}/${usage?.limit} used, ${remaining} remaining`);

  const firms = readdirSync(CORPUS, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .filter((krs) => {
      try {
        const b = JSON.parse(readFileSync(join(CORPUS, krs, "bizraport.json"), "utf8"));
        return Boolean(b?.dane_finansowe?.length);
      } catch {
        return false;
      }
    })
    .sort();

  const limit = Number(process.env.LIMIT ?? 0);
  const list = limit > 0 ? firms.slice(0, limit) : firms;

  let fetched = 0;
  let skipped = 0;
  let exhausted = false;
  for (const krs of list) {
    if (exhausted) {
      break;
    }
    const cachePath = join(CACHE, `${krs}.json`);
    if (existsSync(cachePath)) {
      skipped += 1;
      continue;
    }
    const data = await client.financials(krs);
    if (data === null) {
      // treat as consumed but no data (404 also consumes a credit)
      writeFileSync(cachePath, "null");
      fetched += 1;
      console.log(`${krs}: null`);
      continue;
    }
    writeFileSync(cachePath, JSON.stringify(data, null, 1));
    fetched += 1;
    const years = data.financials?.years?.length ?? 0;
    console.log(`${krs}: ${years} years (fetched=${fetched} skipped=${skipped})`);
    if (fetched >= remaining) {
      exhausted = true;
      console.log("quota exhausted");
    }
  }
  console.log(`done. fetched=${fetched} skipped=${skipped}`);
}

main().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
