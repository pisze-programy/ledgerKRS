import { describe, expect, it } from "vitest";
import { estimateValuation } from "../../src/metrics/valuation";
import { WIARYGODNOSC } from "../../src/metrics/risk";
import type { FinancialInput } from "../../src/metrics/indicators";

const BASE: FinancialInput = {
  okresSprawozdawczy: "01-01-2024_31-12-2024",
  rok: 2024,
  revenue: 1000,
  operatingProfit: 200,
  amortization: 50,
  netProfit: 150,
  totalAssets: 1000,
  equity: 600,
  liabilities: 400,
};

describe("estimateValuation", () => {
  it("values a company from EBITDA", () => {
    const result = estimateValuation(BASE, WIARYGODNOSC.Srednia);
    expect(result.wartoscFirmy!.srednia).toBeCloseTo(1500);
    expect(result.wartoscFirmy!.minimalna).toBeCloseTo(900);
    expect(result.wartoscFirmy!.maksymalna).toBeCloseTo(2400);
  });

  it("keeps credit below valuation and ordered", () => {
    const result = estimateValuation(BASE, WIARYGODNOSC.Srednia);
    const credit = result.kredytKupiecki!;
    expect(credit.minimalny).toBeLessThan(credit.sredni);
    expect(credit.sredni).toBeLessThan(credit.maksymalny);
    expect(credit.maksymalny).toBeLessThan(result.wartoscFirmy!.minimalna);
  });

  it("scales credit with reliability", () => {
    const good = estimateValuation(BASE, WIARYGODNOSC.Najwyzsza).kredytKupiecki!.sredni;
    const bad = estimateValuation(BASE, WIARYGODNOSC.Najnizsza).kredytKupiecki!.sredni;
    expect(good).toBeGreaterThan(bad);
  });

  it("returns null without financial data", () => {
    const empty: FinancialInput = { ...BASE, revenue: 0, operatingProfit: 0, amortization: 0, equity: 0 };
    expect(estimateValuation(empty, null)).toEqual({ wartoscFirmy: null, kredytKupiecki: null });
  });
});
