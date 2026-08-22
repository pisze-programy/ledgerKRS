import { describe, expect, it } from "vitest";
import { computeIndicators, currentLiquidity, type FinancialInput } from "../../src/metrics/indicators";
import { INDICATOR } from "../../src/domain/vocab";

const BASE: FinancialInput = {
  okresSprawozdawczy: "01-01-2024_31-12-2024",
  rok: 2024,
  revenue: 1000,
  operatingCosts: 800,
  operatingProfit: 200,
  netProfit: 150,
  totalAssets: 1000,
  equity: 500,
  liabilities: 500,
  currentAssets: 200,
  currentLiabilities: 100,
  amortization: 50,
};

function byName(indicators: { nazwa_wskaznika: string; kwota: number }[]): Record<string, number> {
  return Object.fromEntries(indicators.map((item) => [item.nazwa_wskaznika, item.kwota]));
}

describe("computeIndicators", () => {
  it("passes statement positions straight through", () => {
    const values = byName(computeIndicators(BASE));
    expect(values[INDICATOR.Przychody]).toBe(1000);
    expect(values[INDICATOR.KosztyOperacyjne]).toBe(800);
    expect(values[INDICATOR.ZyskOperacyjny]).toBe(200);
    expect(values[INDICATOR.ZyskNetto]).toBe(150);
    expect(values[INDICATOR.SumaBilansowa]).toBe(1000);
    expect(values[INDICATOR.KapitalWlasny]).toBe(500);
    expect(values[INDICATOR.ZobowiazaniaIRezerwy]).toBe(500);
  });

  it("computes ebit, ebitda, margins and ratios", () => {
    const values = byName(computeIndicators(BASE));
    expect(values[INDICATOR.Ebit]).toBe(200);
    expect(values[INDICATOR.Ebitda]).toBe(250);
    expect(values[INDICATOR.MarzaOperacyjna]).toBeCloseTo(0.2);
    expect(values[INDICATOR.MarzaNetto]).toBeCloseTo(0.15);
    expect(values[INDICATOR.Roe]).toBeCloseTo(0.3);
    expect(values[INDICATOR.Roa]).toBeCloseTo(0.15);
    expect(values[INDICATOR.WskaznikZadluzenia]).toBeCloseTo(0.5);
  });

  it("omits indicators with zero or missing denominators", () => {
    const values = byName(
      computeIndicators({ ...BASE, revenue: 0, equity: 0, totalAssets: 0, operatingProfit: null }),
    );
    expect(values[INDICATOR.MarzaNetto]).toBeUndefined();
    expect(values[INDICATOR.Roe]).toBeUndefined();
    expect(values[INDICATOR.Roa]).toBeUndefined();
    expect(values[INDICATOR.Ebit]).toBeUndefined();
    expect(values[INDICATOR.MarzaOperacyjna]).toBeUndefined();
    expect(values[INDICATOR.Przychody]).toBe(0);
  });

  it("emits only the vocabulary names", () => {
    const names = new Set(Object.values(INDICATOR));
    for (const item of computeIndicators(BASE)) {
      expect(names.has(item.nazwa_wskaznika)).toBe(true);
    }
  });

  it("computes current liquidity separately", () => {
    expect(currentLiquidity(BASE)).toBeCloseTo(2);
  });
});
