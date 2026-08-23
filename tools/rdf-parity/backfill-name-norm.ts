import { execFileSync } from "node:child_process";
import { writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { personKey } from "../../src/domain/person";

/**
 * One-time backfill for the `connections.name_norm` column on an existing D1
 * database (schema.sql already has the column for fresh installs). Uses the
 * same normalizePersonName as the production upsert so keys are consistent.
 * Usage: npx tsx tools/rdf-parity/backfill-name-norm.ts [--remote]
 */
const remote = process.argv.includes("--remote");
const base = ["wrangler", "d1", "execute", "raporty-firmowe"];
if (remote) {
  base.push("--remote");
}

function run(command: string[]): string {
  return execFileSync("npx", [...base, "--command", command, "--json"], { encoding: "utf8" });
}

const raw = JSON.parse(run(`SELECT id, name FROM connections WHERE name IS NOT NULL`)) as {
  results: { id: number; name: string | null }[];
}[];
const rows = raw.flatMap((block) => block.results ?? []);

const updates = rows
  .map((r) => {
    const norm = personKey(r.name);
    if (!norm) {
      return null;
    }
    return `UPDATE connections SET name_norm = '${norm.replace(/'/g, "''")}' WHERE id = ${r.id};`;
  })
  .filter((s): s is string => s !== null);

const sqlPath = join(process.cwd(), "tools", "rdf-parity", "backfill-name-norm.generated.sql");
writeFileSync(sqlPath, updates.join("\n"));
execFileSync("npx", [...base, "--file", sqlPath], { stdio: "inherit" });
console.log(`backfilled ${updates.length} connection rows -> ${sqlPath}`);
