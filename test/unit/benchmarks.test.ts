import { describe, expect, it } from "vitest";
import { computeBenchmarkMatrix, marketShare, percentile } from "../../src/metrics/benchmarks";
import { BENCHMARK_INDICATORS, INDICATOR } from "../../src/domain/vocab";

describe("percentile", () => {
  it("returns fraction of values below", () => {
    expect(percentile([1, 2, 3, 4], 3)).toBeCloseTo(0.5);
    expect(percentile([1, 2, 3], 4)).toBeCloseTo(1);
    expect(percentile([1, 2, 3], 0)).toBe(0);
  });

  it("returns null for empty input", () => {
    expect(percentile([], 5)).toBeNull();
  });
});

describe("marketShare", () => {
  it("computes company share of group revenue", () => {
    expect(marketShare(1000, 250)).toBeCloseTo(0.25);
  });

  it("returns null for zero group", () => {
    expect(marketShare(0, 5)).toBeNull();
  });
});

describe("computeBenchmarkMatrix", () => {
  const company = { [INDICATOR.Przychody]: 400, [INDICATOR.ZyskNetto]: 40 };
  const industry = [
    { [INDICATOR.Przychody]: 100, [INDICATOR.ZyskNetto]: 10 },
    { [INDICATOR.Przychody]: 200, [INDICATOR.ZyskNetto]: 20 },
    { [INDICATOR.Przychody]: 400, [INDICATOR.ZyskNetto]: 40 },
    { [INDICATOR.Przychody]: 400, [INDICATOR.ZyskNetto]: 40 },
  ];

  it("builds a row per benchmark indicator", () => {
    const rows = computeBenchmarkMatrix(company, industry, "01-01-2024_31-12-2024", 2024);
    expect(rows).toHaveLength(2);
    expect(rows[0]!.nazwaWskaznika).toBe(INDICATOR.Przychody);
    expect(rows[1]!.nazwaWskaznika).toBe(INDICATOR.ZyskNetto);
  });

  it("adds market fields only for przychody", () => {
    const rows = computeBenchmarkMatrix(company, industry, "01-01-2024_31-12-2024", 2024);
    const revenue = rows.find((row) => row.nazwaWskaznika === INDICATOR.Przychody)!;
    expect(revenue.udzialWRynku).toBeCloseTo(400 / 1100);
    expect(revenue.przychodyCalejBranzy).toBeCloseTo(1100);
    expect(revenue.liczbaFirmWBranzy).toBe(4);
    expect(revenue.percentylWPkd).toBeCloseTo(0.5);
    const profit = rows.find((row) => row.nazwaWskaznika === INDICATOR.ZyskNetto)!;
    expect(profit.udzialWRynku).toBeUndefined();
    expect(profit.liczbaFirmWBranzy).toBeUndefined();
  });

  it("skips missing indicator values", () => {
    const rows = computeBenchmarkMatrix(company, [{ [INDICATOR.ZyskNetto]: 5 }], "okres", null);
    expect(rows.some((row) => row.nazwaWskaznika === INDICATOR.Przychody)).toBe(false);
  });

  it("uses only the 10 vocabulary indicators", () => {
    const rows = computeBenchmarkMatrix(company, industry, "okres", 2024);
    for (const row of rows) {
      expect((BENCHMARK_INDICATORS as readonly string[]).includes(row.nazwaWskaznika)).toBe(true);
    }
  });
});
