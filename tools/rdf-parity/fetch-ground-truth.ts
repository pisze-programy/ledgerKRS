import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { loadCreds } from "./creds";
import { fetchBizraportDane } from "./bizraport";

/** Source list: corpus.json keys (default) or a JSON array of KRS via LIST. */
async function krsList(): Promise<string[]> {
  const listSource = process.env.LIST;
  if (listSource) {
    const parsed = JSON.parse(readFileSync(listSource, "utf8")) as { sample: { krs: string }[] } | string[];
    return (Array.isArray(parsed) ? parsed : parsed.sample.map((s) => s.krs)).sort();
  }
  const corpus = JSON.parse(readFileSync(join(process.cwd(), "tools", "rdf-parity", "corpus.json"), "utf8")) as Record<string, unknown>;
  return Object.keys(corpus).sort();
}

async function main() {
  const destRoot = process.env.DEST ?? join(process.cwd(), "test", "fixtures", "rdf-corpus");
  const list = await krsList();
  let used = 0;
  for (const krs of list) {
    const dir = join(destRoot, krs);
    mkdirSync(dir, { recursive: true });
    const path = join(dir, "bizraport.json");
    if (existsSync(path) && readFileSync(path, "utf8").trim() !== "null" && readFileSync(path, "utf8").includes('"nazwa"')) {
      continue;
    }
    const creds = loadCreds();
    const biz = await fetchBizraportDane(creds, krs);
    writeFileSync(path, JSON.stringify(biz ?? null, null, 1));
    used += 1;
    const ok = biz ? "y" : "n";
    console.log(`${krs}: biz=${ok}`);
    await new Promise((r) => setTimeout(r, 250));
  }
  console.log(`DONE ground truth: ${used} credits used`);
}

main().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
