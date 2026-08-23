/**
 * Cost model for the RDF seed. Pure math over the probe metrics.
 *
 * Architecture: Webshare is used ONLY to solve the reese84 cookie (small,
 * a few hundred KB per solve). The searches are cross-IP and run from the
 * local IP, so search traffic is free and never consumes Webshare bandwidth.
 * The only Webshare cost is the cookie solves.
 */

export interface SeedMetrics {
  search_requests: number;
  search_bytes: number;
  cookie_solves: number;
  solve_bytes: number;
  wall_ms: number;
}

export interface SeedOptions {
  /** Firms to seed (one search request each). */
  totalFirms: number;
  /** Empirical requests served by one cookie before Incapsula re-challenges. */
  requestsPerCookie: number;
  /** Webshare residential price per GB (USD). */
  pricePerGB: number;
  /** Optional 2captcha price per 1000 solves (USD); 0 disables the line. */
  twoCaptchaUsdPer1000?: number;
}

export interface SeedExtrapolation {
  totalFirms: number;
  requests: number;
  requestsPerCookie: number;
  cookieSolves: number;
  /** Webshare transfer: only the cookie solves (the paid part). */
  webshareTransferGB: number;
  webshareCostUsd: number;
  /** Cross-IP search traffic on the local IP — free, informational only. */
  localSearchGB: number;
  solveCostUsd: number;
  sequentialHours: number;
}

const GB = 1024 * 1024 * 1024;

export function extrapolateSeed(metrics: SeedMetrics, options: SeedOptions): SeedExtrapolation {
  if (options.totalFirms <= 0) {
    throw new Error("totalFirms must be positive");
  }
  const avgSolve = metrics.cookie_solves > 0 ? metrics.solve_bytes / metrics.cookie_solves : 0;
  const avgSearch = metrics.search_requests > 0 ? metrics.search_bytes / metrics.search_requests : 0;
  const wallMs = metrics.wall_ms ?? 0;
  const avgSecondsPerFirm = metrics.search_requests > 0 ? wallMs / metrics.search_requests / 1000 : 0;

  const requests = options.totalFirms;
  const cookieSolves = Math.ceil(requests / options.requestsPerCookie);
  const webshareTransferGB = (cookieSolves * avgSolve) / GB;
  const localSearchGB = (requests * avgSearch) / GB;
  const webshareCostUsd = webshareTransferGB * options.pricePerGB;
  const solveCostUsd =
    options.twoCaptchaUsdPer1000 && options.twoCaptchaUsdPer1000 > 0
      ? (cookieSolves / 1000) * options.twoCaptchaUsdPer1000
      : 0;

  return {
    totalFirms: options.totalFirms,
    requests,
    requestsPerCookie: options.requestsPerCookie,
    cookieSolves,
    webshareTransferGB: round3(webshareTransferGB),
    webshareCostUsd: round2(webshareCostUsd),
    localSearchGB: round3(localSearchGB),
    solveCostUsd: round2(solveCostUsd),
    sequentialHours: round1((requests * avgSecondsPerFirm) / 3600),
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}
function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
