import { INDICATOR, type IndicatorName } from "../domain/vocab";
import type { Indicator } from "../domain/types";
import { computeIndicators, type FinancialInput } from "./indicators";
import { assessRisk, type RiskSignals } from "./risk";
import { estimateValuation } from "./valuation";

export const NO_SIGNALS: RiskSignals = {
  krzEntries: 0,
  monitorUwaga: 0,
  bankruptcy: false,
  liquidation: false,
  restructuring: false,
};

export function buildFullIndicators(input: FinancialInput, signals: RiskSignals = NO_SIGNALS): Indicator[] {
  const result = computeIndicators(input);
  const risk = assessRisk(input, signals);
  const valuation = estimateValuation(input, risk.wiarygodnosc);
  add(result, INDICATOR.Wiarygodnosc, risk.wiarygodnosc);
  add(result, INDICATOR.Niewyplacalnosc24m, risk.niewyplacalnoscLubRestrukturyzacja24m);
  if (valuation.wartoscFirmy) {
    add(result, INDICATOR.WartoscFirmyMinimalna, valuation.wartoscFirmy.minimalna);
    add(result, INDICATOR.WartoscFirmySrednia, valuation.wartoscFirmy.srednia);
    add(result, INDICATOR.WartoscFirmyMaksymalna, valuation.wartoscFirmy.maksymalna);
  }
  if (valuation.kredytKupiecki) {
    add(result, INDICATOR.KredytKupieckiMinimalny, valuation.kredytKupiecki.minimalny);
    add(result, INDICATOR.KredytKupieckiSredni, valuation.kredytKupiecki.sredni);
    add(result, INDICATOR.KredytKupieckiMaksymalny, valuation.kredytKupiecki.maksymalny);
  }
  return result;
}

function add(target: Indicator[], nazwaWskaznika: IndicatorName, kwota: number | null): void {
  if (kwota === null || !Number.isFinite(kwota)) {
    return;
  }
  target.push({ nazwa_wskaznika: nazwaWskaznika, kwota });
}
