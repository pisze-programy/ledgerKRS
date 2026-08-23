import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Draw a deterministic random sample of KRS numbers for the second corpus
 * batch (100 firms). Source: the biuletyn KRS day sample (2022+ filings), with
 * the already-tested sample50 firms excluded so every drawn company is fresh.
 * Older-period coverage (2016-2021, LEGACY schemas) lives in the existing
 * rdf-corpus fixtures + the promoted extreme-case fixtures.
 *
 * Deterministic: SEED env (default 20260823) reproduces the same draw.
 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SAMPLE_BIULETYN = JSON.parse(
  readFileSync(join(process.cwd(), "tools", "rdf-parity", "dump", "sample-biuletyn.json"), "utf8"),
) as { sample: { krs: string; first_seen: string }[] };

const SAMPLE50 = JSON.parse(readFileSync("/tmp/sample50-v2.json", "utf8")) as string[];

const CORPUS_DIR = join(process.cwd(), "test", "fixtures", "rdf-corpus");
const CORPUS_FIRMS = readdirSync(CORPUS_DIR, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name);

function main(): void {
  const count = Number(process.env.COUNT ?? 100);
  const seed = Number(process.env.SEED ?? 20260823);
  const rand = mulberry32(seed);

  const used = new Set([...SAMPLE50, ...CORPUS_FIRMS]);
  const pool = SAMPLE_BIULETYN.sample.filter((s) => !used.has(s.krs));
  const drawn: { krs: string; first_seen: string | null }[] = [];
  const seen = new Set<string>();
  while (drawn.length < count && pool.length > 0) {
    const idx = Math.floor(rand() * pool.length);
    const item = pool.splice(idx, 1)[0]!;
    if (seen.has(item.krs)) {
      continue;
    }
    seen.add(item.krs);
    drawn.push({ krs: item.krs, first_seen: item.first_seen ?? null });
  }

  const out = {
    seed,
    generated_at: new Date().toISOString(),
    pool_total: pool.length + drawn.length,
    sample_size: drawn.length,
    sample: drawn,
  };
  const path = join(process.cwd(), "tools", "rdf-parity", "corpus2.json");
  writeFileSync(path, JSON.stringify(out, null, 1));
  console.log(`drawn ${drawn.length} firms (seed=${seed}) -> ${path}`);
}

main();
