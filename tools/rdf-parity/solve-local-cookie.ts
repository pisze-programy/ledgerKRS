/**
 * Solve a fresh reese84 cookie on the LOCAL IP (no proxy) and write it to
 * .dev.vars so a local `wrangler dev` can fetch RDF (tresc is IP-bound to the
 * solving IP, so both solve and fetch must run on the local IP).
 *
 * Run:   npx tsx tools/rdf-parity/solve-local-cookie.ts
 * Env:   OUT=...   (default: update .dev.vars RDF_COOKIE)
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { solveReese84 } from "./pw-solver";
import { createLogger } from "../../src/lib/logger";

const log = createLogger("solve-local-cookie");

async function main(): Promise<void> {
  const t0 = Date.now();
  const sol = await solveReese84(undefined as never);
  if (!sol) {
    log.error("local cookie solve FAILED");
    process.exit(1);
  }
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  log.info("cookie solved on local IP", { seconds: Number(elapsed), cookies: sol.cookies.map((c) => c.name).join(",") });

  const devVarsPath = join(process.cwd(), ".dev.vars");
  if (process.env.OUT) {
    writeFileSync(process.env.OUT, sol.cookieString);
    log.info("cookie written to OUT", { path: process.env.OUT });
    return;
  }
  let vars = "";
  try {
    vars = readFileSync(devVarsPath, "utf8");
  } catch {
    vars = "";
  }
  const lines = vars.split("\n").filter((l) => !l.startsWith("RDF_COOKIE="));
  lines.push(`RDF_COOKIE=${sol.cookieString}`);
  writeFileSync(devVarsPath, lines.join("\n") + "\n");
  log.info(".dev.vars updated with a fresh local-IP RDF cookie", { path: devVarsPath });
}

main().catch((error) => {
  log.error("failed", { error: String(error) });
  process.exit(1);
});
