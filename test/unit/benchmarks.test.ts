import { describe, expect, it } from "vitest";
import { percentileOf, computeCompanyPercentiles } from "../../src/metrics/benchmarks";

describe("percentileOf", () => {
  it("returns the fraction of values at or below the value", () => {
    expect(percentileOf([1, 2, 3, 4], 2)).toBe(0.5);
    expect(percentileOf([1, 2, 3, 4], 4)).toBe(1);
    expect(percentileOf([1, 2, 3, 4], 0)).toBe(0);
  });

  it("returns 0 for an empty distribution", () => {
    expect(percentileOf([], 5)).toBe(0);
  });
});

describe("computeCompanyPercentiles — industry position per PKD+year", () => {
  it("ranks firms within the same PKD and year", () => {
    const firms = [
      { krs: "A", pkd: "49.41.Z", okres: "2024_1", rok: 2024, values: { przychody: 100 } },
      { krs: "B", pkd: "49.41.Z", okres: "2024_2", rok: 2024, values: { przychody: 300 } },
      { krs: "C", pkd: "49.41.Z", okres: "2024_3", rok: 2024, values: { przychody: 200 } },
    ];
    const byFirm = computeCompanyPercentiles(firms);
    const rows = [...byFirm.values()].flat();
    expect(byFirm.get("A")?.[0]?.percentylWPkd).toBeCloseTo(1 / 3, 5);
    expect(byFirm.get("C")?.[0]?.percentylWPkd).toBeCloseTo(2 / 3, 5);
    expect(byFirm.get("B")?.[0]?.percentylWPkd).toBeCloseTo(1, 5);
    expect(rows[0]!.liczbaFirmWBranzy).toBe(3);
  });

  it("does not mix different PKD groups or years", () => {
    const firms = [
      { krs: "A", pkd: "49.41.Z", okres: "2024", rok: 2024, values: { przychody: 100 } },
      { krs: "B", pkd: "49.41.Z", okres: "2023", rok: 2023, values: { przychody: 900 } },
      { krs: "C", pkd: "55.10.Z", okres: "2024", rok: 2024, values: { przychody: 50 } },
    ];
    const rows = [...computeCompanyPercentiles(firms).values()].flat();
    const by = rows.map((r) => `${r.okresSprawozdawczy}:${r.percentylWPkd}`);
    expect(by.includes("2024:1")).toBe(true); // A is the only 2024/49.41.Z firm
    expect(by.includes("2023:1")).toBe(true); // B is the only 2023/49.41.Z firm
    expect(by.includes("2024:1")).toBe(true); // C is the only 2024/55.10.Z firm
  });

  it("skips indicators without values", () => {
    const firms = [
      { krs: "A", pkd: "49.41.Z", okres: "2024", rok: 2024, values: {} },
      { krs: "B", pkd: "49.41.Z", okres: "2024", rok: 2024, values: { przychody: 5 } },
    ];
    const rows = [...computeCompanyPercentiles(firms).values()].flat();
    expect(rows.length).toBe(1); // only B has przychody
  });
});
