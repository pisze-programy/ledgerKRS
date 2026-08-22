import { ratio, type FinancialInput } from "./indicators";

export interface RiskSignals {
  krzEntries: number;
  monitorUwaga: number;
  bankruptcy: boolean;
  liquidation: boolean;
  restructuring: boolean;
}

export interface RiskAssessment {
  wiarygodnosc: number | null;
  niewyplacalnoscLubRestrukturyzacja24m: number | null;
}

export const WIARYGODNOSC = {
  Najwyzsza: 1,
  Wysoka: 2,
  Srednia: 3,
  Niska: 4,
  Najnizsza: 5,
} as const;

export function assessRisk(input: FinancialInput, signals: RiskSignals): RiskAssessment {
  const hasData = hasFinancialData(input);
  if (!hasData) {
    return { wiarygodnosc: null, niewyplacalnoscLubRestrukturyzacja24m: null };
  }
  return {
    wiarygodnosc: reliabilityScore(input, signals),
    niewyplacalnoscLubRestrukturyzacja24m: insolvencyProbability(input, signals),
  };
}

export function reliabilityScore(input: FinancialInput, signals: RiskSignals): number {
  let score = 3;
  const roe = ratio(input.netProfit, input.equity);
  const debt = ratio(input.liabilities, input.totalAssets);
  const liquidity = ratio(input.currentAssets, input.currentLiabilities ?? 0);
  const margin = ratio(input.netProfit, input.revenue);
  if (roe !== null && roe >= 0.2) {
    score -= 1;
  }
  if (roe !== null && roe < -0.2) {
    score += 1;
  }
  if (debt !== null && debt >= 0.8) {
    score += 1;
  }
  if (debt !== null && debt <= 0.4) {
    score -= 1;
  }
  if (liquidity !== null && liquidity < 1) {
    score += 1;
  }
  if (margin !== null && margin < -0.1) {
    score += 1;
  }
  if (input.equity < 0) {
    score += 2;
  }
  score += Math.min(signals.krzEntries, 1) * 2;
  score += Math.min(signals.monitorUwaga, 1);
  if (signals.bankruptcy) {
    score += 2;
  }
  if (signals.liquidation) {
    score += 1;
  }
  if (signals.restructuring) {
    score += 1;
  }
  return clamp(Math.round(score), WIARYGODNOSC.Najwyzsza, WIARYGODNOSC.Najnizsza);
}

export function insolvencyProbability(input: FinancialInput, signals: RiskSignals): number {
  const debt = ratio(input.liabilities, input.totalAssets);
  const liquidity = ratio(input.currentAssets, input.currentLiabilities ?? 0);
  const margin = ratio(input.netProfit, input.revenue);
  let z = -2.2;
  if (debt !== null) {
    z += 1.5 * clamp((debt - 0.5) * 2, -1, 1);
  }
  if (liquidity !== null && liquidity < 1) {
    z += 1.2;
  }
  if (input.equity < 0) {
    z += 1.0;
  }
  if (margin !== null && margin < -0.1) {
    z += 0.8;
  }
  if (signals.krzEntries > 0) {
    z += 1.8;
  }
  if (signals.bankruptcy || signals.liquidation || signals.restructuring) {
    z += 1.2;
  }
  if (signals.monitorUwaga > 0) {
    z += 0.6;
  }
  return 1 / (1 + Math.exp(-z));
}

function hasFinancialData(input: FinancialInput): boolean {
  return (
    input.revenue !== 0 ||
    input.totalAssets !== 0 ||
    input.netProfit !== 0 ||
    input.equity !== 0 ||
    input.liabilities !== 0
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
