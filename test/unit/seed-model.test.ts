import { describe, expect, it } from "vitest";
import { extrapolateSeed, type SeedMetrics } from "../../tools/rdf-parity/seed-model";

const MEASURED: SeedMetrics = {
  search_requests: 219,
  search_bytes: 1406937,
  cookie_solves: 2,
  solve_bytes: 1210152,
  wall_ms: 180000,
};

describe("extrapolateSeed", () => {
  it("meters Webshare only for cookie solves; search is cross-IP and free", () => {
    const result = extrapolateSeed(MEASURED, { totalFirms: 1000, requestsPerCookie: 58, pricePerGB: 3.5 });
    // 1000/58 ≈ 17.24 -> 18 solves * (1210152/2=605076 B) ≈ 10.9 MB webshare
    expect(result.cookieSolves).toBe(18);
    expect(result.webshareTransferGB).toBeCloseTo(0.0101, 3);
    // local search stays informational
    expect(result.localSearchGB).toBeCloseTo((1000 * (1406937 / 219)) / (1024 ** 3), 3);
    expect(result.webshareCostUsd).toBeGreaterThan(0);
  });

  it("scales webshare cost with the population", () => {
    const a = extrapolateSeed(MEASURED, { totalFirms: 1_000_000, requestsPerCookie: 58, pricePerGB: 3.5 });
    const b = extrapolateSeed(MEASURED, { totalFirms: 2_000_000, requestsPerCookie: 58, pricePerGB: 3.5 });
    expect(b.webshareCostUsd / a.webshareCostUsd).toBeCloseTo(2, 1);
  });

  it("charges fewer cookie solves when a cookie lives longer", () => {
    const shortLife = extrapolateSeed(MEASURED, { totalFirms: 30000, requestsPerCookie: 58, pricePerGB: 3.5 });
    const longLife = extrapolateSeed(MEASURED, { totalFirms: 30000, requestsPerCookie: 300, pricePerGB: 3.5 });
    expect(longLife.cookieSolves).toBeLessThan(shortLife.cookieSolves);
    expect(longLife.webshareCostUsd).toBeLessThan(shortLife.webshareCostUsd);
  });

  it("adds the 2captcha cost when enabled", () => {
    const without = extrapolateSeed(MEASURED, { totalFirms: 58000, requestsPerCookie: 58, pricePerGB: 3.5 });
    const withCaptcha = extrapolateSeed(MEASURED, {
      totalFirms: 58000,
      requestsPerCookie: 58,
      pricePerGB: 3.5,
      twoCaptchaUsdPer1000: 2,
    });
    // 58000/58 = 1000 solves -> 1000/1000 * 2 = 2 USD
    expect(withCaptcha.solveCostUsd).toBe(2);
    expect(without.solveCostUsd).toBe(0);
  });

  it("computes sequential hours from the measured wall time", () => {
    const result = extrapolateSeed(MEASURED, { totalFirms: 3600, requestsPerCookie: 58, pricePerGB: 3.5 });
    // 180000ms/219 ≈ 822ms per firm * 3600 ≈ 0.82 h
    expect(result.sequentialHours).toBeCloseTo(0.82, 1);
  });

  it("throws for a non-positive population", () => {
    expect(() => extrapolateSeed(MEASURED, { totalFirms: 0, requestsPerCookie: 58, pricePerGB: 3.5 })).toThrow();
  });

  it("handles an empty metric sample without dividing by zero", () => {
    const empty: SeedMetrics = { search_requests: 0, search_bytes: 0, cookie_solves: 0, solve_bytes: 0, wall_ms: 0 };
    const result = extrapolateSeed(empty, { totalFirms: 10, requestsPerCookie: 58, pricePerGB: 3.5 });
    expect(result.webshareTransferGB).toBe(0);
    expect(result.webshareCostUsd).toBe(0);
  });
});
