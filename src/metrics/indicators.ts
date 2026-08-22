import { INDICATOR, type IndicatorName } from "../domain/vocab";
import type { Indicator } from "../domain/types";

export interface FinancialInput {
  okresSprawozdawczy: string;
  rok: number | null;
  revenue: number;
  operatingRevenue?: number | null;
  salesRevenue?: number | null;
  operatingCosts?: number | null;
  costOfGoodsSold?: number | null;
  salesAndAdminCosts?: number | null;
  wages?: number | null;
  incomeTax?: number | null;
  amortization?: number | null;
  grossProfitOnSales?: number | null;
  profitOnSales?: number | null;
  operatingProfit?: number | null;
  grossProfit?: number | null;
  netProfit: number;
  totalAssets: number;
  fixedAssets?: number | null;
  currentAssets?: number | null;
  currentLiabilities?: number | null;
  equity: number;
  liabilities: number;
  employees?: number | null;
  estimatedEmployees?: number | null;
}

export function computeIndicators(input: FinancialInput): Indicator[] {
  const result: Indicator[] = [];
  add(result, INDICATOR.Przychody, input.revenue);
  add(result, INDICATOR.PrzychodyOperacyjne, input.operatingRevenue);
  add(result, INDICATOR.PrzychodyZeSprzedazy, input.salesRevenue);
  add(result, INDICATOR.KosztyOperacyjne, input.operatingCosts);
  add(result, INDICATOR.KosztySprzedanychProduktow, input.costOfGoodsSold);
  add(result, INDICATOR.KosztySprzedazyIZarzadu, input.salesAndAdminCosts);
  add(result, INDICATOR.Wynagrodzenia, input.wages);
  add(result, INDICATOR.PodatekDochodowy, input.incomeTax);
  add(result, INDICATOR.Amortyzacja, input.amortization);
  add(result, INDICATOR.ZyskBruttoZeSprzedazy, input.grossProfitOnSales);
  add(result, INDICATOR.ZyskZeSprzedazy, input.profitOnSales);
  add(result, INDICATOR.ZyskOperacyjny, input.operatingProfit);
  add(result, INDICATOR.ZyskBrutto, input.grossProfit);
  add(result, INDICATOR.ZyskNetto, input.netProfit);
  add(result, INDICATOR.SumaBilansowa, input.totalAssets);
  add(result, INDICATOR.AktywaTrwale, input.fixedAssets);
  add(result, INDICATOR.AktywaObrotowe, input.currentAssets);
  add(result, INDICATOR.KapitalWlasny, input.equity);
  add(result, INDICATOR.ZobowiazaniaIRezerwy, input.liabilities);
  add(result, INDICATOR.Zatrudnienie, input.employees);
  add(result, INDICATOR.ZatrudnienieEstymowane, input.estimatedEmployees);
  add(result, INDICATOR.Ebit, input.operatingProfit);
  if (input.operatingProfit != null && input.amortization != null) {
    add(result, INDICATOR.Ebitda, input.operatingProfit + input.amortization);
  }
  add(result, INDICATOR.MarzaOperacyjna, ratio(input.operatingProfit, input.revenue));
  add(result, INDICATOR.MarzaNetto, ratio(input.netProfit, input.revenue));
  add(result, INDICATOR.Roe, ratio(input.netProfit, input.equity));
  add(result, INDICATOR.Roa, ratio(input.netProfit, input.totalAssets));
  add(result, INDICATOR.WskaznikZadluzenia, ratio(input.liabilities, input.totalAssets));
  return result;
}

export function ratio(numerator: number | null | undefined, denominator: number): number | null {
  if (denominator === 0 || numerator === null || numerator === undefined) {
    return null;
  }
  return numerator / denominator;
}

export function currentLiquidity(input: FinancialInput): number | null {
  return ratio(input.currentAssets, input.currentLiabilities ?? 0);
}

function add(target: Indicator[], nazwaWskaznika: IndicatorName, kwota: number | null | undefined): void {
  if (kwota === null || kwota === undefined || !Number.isFinite(kwota)) {
    return;
  }
  target.push({ nazwa_wskaznika: nazwaWskaznika, kwota });
}
