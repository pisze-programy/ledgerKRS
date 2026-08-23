import type { FinancialInput } from "./indicators";
import { WIARYGODNOSC } from "./risk";

export interface ValuationRange {
  minimalna: number;
  srednia: number;
  maksymalna: number;
}

export interface CreditRange {
  minimalny: number;
  sredni: number;
  maksymalny: number;
}

export interface ValuationResult {
  wartoscFirmy: ValuationRange | null;
  kredytKupiecki: CreditRange | null;
}

export const VALUATION = {
  MultipleEbitda: 6,
  MultipleRevenue: 0.5,
  MinFactor: 0.6,
  MaxFactor: 1.6,
  CreditMinFactor: 0.5,
  CreditMaxFactor: 1.5,
} as const;

export function estimateValuation(input: FinancialInput, reliability: number | null): ValuationResult {
  const base = valuationBase(input);
  if (base === null) {
    return { wartoscFirmy: null, kredytKupiecki: null };
  }
  const srednia = base;
  const minimalna = base * VALUATION.MinFactor;
  const maksymalna = base * VALUATION.MaxFactor;
  const sredni = srednia * creditFactor(reliability);
  return {
    wartoscFirmy: { minimalna, srednia, maksymalna },
    kredytKupiecki: {
      minimalny: sredni * VALUATION.CreditMinFactor,
      sredni,
      maksymalny: sredni * VALUATION.CreditMaxFactor,
    },
  };
}

function valuationBase(input: FinancialInput): number | null {
  const ebitda = (input.operatingProfit ?? 0) + (input.amortization ?? 0);
  if (ebitda > 0) {
    return ebitda * VALUATION.MultipleEbitda;
  }
  if ((input.revenue ?? 0) > 0) {
    return (input.revenue ?? 0) * VALUATION.MultipleRevenue;
  }
  if (input.equity > 0) {
    return input.equity;
  }
  return null;
}

function creditFactor(reliability: number | null): number {
  switch (reliability) {
    case WIARYGODNOSC.Najwyzsza:
      return 0.12;
    case WIARYGODNOSC.Wysoka:
      return 0.09;
    case WIARYGODNOSC.Niska:
      return 0.03;
    case WIARYGODNOSC.Najnizsza:
      return 0.01;
    default:
      return 0.06;
  }
}
