import { describe, expect, it } from "vitest";
import { assessRisk, reliabilityScore, insolvencyProbability, type RiskSignals } from "../../src/metrics/risk";
import type { FinancialInput } from "../../src/metrics/indicators";

const BASE: FinancialInput = {
  okresSprawozdawczy: "01-01-2024_31-12-2024",
  rok: 2024,
  revenue: 1000,
  operatingProfit: 200,
  netProfit: 150,
  totalAssets: 1000,
  currentAssets: 400,
  currentLiabilities: 100,
  equity: 600,
  liabilities: 400,
};

const NO_SIGNALS: RiskSignals = {
  krzEntries: 0,
  monitorUwaga: 0,
  bankruptcy: false,
  liquidation: false,
  restructuring: false,
};

describe("reliabilityScore", () => {
  it("scores a healthy company as most reliable", () => {
    expect(reliabilityScore(BASE, NO_SIGNALS)).toBeLessThanOrEqual(2);
  });

  it("scores a distressed company as least reliable", () => {
    const distressed: FinancialInput = {
      ...BASE,
      netProfit: -300,
      revenue: 100,
      currentAssets: 20,
      currentLiabilities: 200,
      equity: -100,
      liabilities: 1100,
    };
    const signals: RiskSignals = { ...NO_SIGNALS, krzEntries: 2, monitorUwaga: 1, bankruptcy: true };
    expect(reliabilityScore(distressed, signals)).toBe(5);
  });

  it("stays within 1..5", () => {
    for (let i = 0; i < 50; i++) {
      const score = reliabilityScore({ ...BASE, netProfit: i - 25 }, NO_SIGNALS);
      expect(score).toBeGreaterThanOrEqual(1);
      expect(score).toBeLessThanOrEqual(5);
    }
  });
});

describe("insolvencyProbability", () => {
  it("is low for a healthy company", () => {
    expect(insolvencyProbability(BASE, NO_SIGNALS)).toBeLessThan(0.3);
  });

  it("is high for a bankrupt company with KRZ entries", () => {
    const distressed: FinancialInput = {
      ...BASE,
      netProfit: -300,
      revenue: 100,
      currentAssets: 20,
      currentLiabilities: 200,
      equity: -100,
      liabilities: 1100,
    };
    const signals: RiskSignals = { ...NO_SIGNALS, krzEntries: 3, bankruptcy: true };
    expect(insolvencyProbability(distressed, signals)).toBeGreaterThan(0.7);
  });
});

describe("assessRisk", () => {
  it("returns null when there is no financial data", () => {
    const empty: FinancialInput = {
      ...BASE,
      revenue: 0,
      totalAssets: 0,
      netProfit: 0,
      equity: 0,
      liabilities: 0,
    };
    const result = assessRisk(empty, NO_SIGNALS);
    expect(result.wiarygodnosc).toBeNull();
    expect(result.niewyplacalnoscLubRestrukturyzacja24m).toBeNull();
  });

  it("returns both components for a company with data", () => {
    const result = assessRisk(BASE, NO_SIGNALS);
    expect(result.wiarygodnosc).not.toBeNull();
    expect(result.niewyplacalnoscLubRestrukturyzacja24m).not.toBeNull();
  });
});
