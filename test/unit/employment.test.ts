import { describe, expect, it } from "vitest";
import { estimateEmployment, DEFAULT_AVG_GROSS_SALARY } from "../../src/metrics/employment";

describe("estimateEmployment — headcount from wages", () => {
  it("estimates headcount = wages / (average salary * 12)", () => {
    // 3 000 000 zł wages / (8 000 * 12 = 96 000) ≈ 31
    const e = estimateEmployment(3_000_000)!;
    expect(e.estymowane).toBe(31);
    expect(e.podstawa).toBe("wynagrodzenia");
  });

  it("returns null when wages are missing or non-positive", () => {
    expect(estimateEmployment(null)).toBeNull();
    expect(estimateEmployment(0)).toBeNull();
    expect(estimateEmployment(-5)).toBeNull();
  });

  it("returns null when the average salary is non-positive", () => {
    expect(estimateEmployment(1000, 0)).toBeNull();
  });

  it("never estimates below 1 head", () => {
    expect(estimateEmployment(100)! .estymowane).toBeGreaterThanOrEqual(1);
  });

  it("exposes a sensible default salary constant", () => {
    expect(DEFAULT_AVG_GROSS_SALARY).toBeGreaterThan(0);
  });
});
