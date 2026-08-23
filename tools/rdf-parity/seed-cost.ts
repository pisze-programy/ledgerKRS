/**
 * Print the full-seed cost table from the measured probe metrics.
 * Run: npx tsx tools/rdf-parity/seed-cost.ts
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { extrapolateSeed, type SeedMetrics } from "./seed-model";

const METRICS_PATH = join(process.cwd(), "tools", "rdf-parity", "dump", "seed-probe.json");

const metrics = JSON.parse(readFileSync(METRICS_PATH, "utf8")) as SeedMetrics;

const PRICE_PER_GB = 3.5;

console.log(
  `measured: ${metrics.search_requests} firms, ${(metrics.search_bytes / 1024).toFixed(0)}KB local search, ${(metrics.solve_bytes / 1024).toFixed(0)}KB webshare solves, cookies=[${metrics.requests_per_cookie.join(",")}]`,
);

for (const [label, firms] of [
  ["caly-katalog", 1_201_570],
  ["z-finansami", 609_858],
  ["xml-filery", 250_000],
] as const) {
  for (const rpc of [58, 300, 720]) {
    const r = extrapolateSeed(metrics, { totalFirms: firms, requestsPerCookie: rpc, pricePerGB: PRICE_PER_GB });
    console.log(
      `${label.padEnd(12)} firms=${firms} rpc=${rpc}: cookies=${r.cookieSolves} webshare=${r.webshareTransferGB}GB=$${r.webshareCostUsd} localSearch=${r.localSearchGB}GB(free) seqHours=${r.sequentialHours}`,
    );
  }
}
