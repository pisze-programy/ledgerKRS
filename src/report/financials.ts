import { INDICATOR } from "../domain/vocab";
import type { FinancialSeries, ReportContext } from "./context";

export function financials(ctx: ReportContext): FinancialSeries[] {
  return ctx.report.financials.map((year) => {
    const map = new Map<string, number>();
    for (const item of year.indicators) {
      map.set(item.nazwa_wskaznika, item.kwota);
    }
    return {
      okres_sprawozdawczy: year.okresSprawozdawczy,
      rok: year.rok,
      wskazniki: Object.fromEntries(map),
      wycena: {
        minimalna: map.get(INDICATOR.WartoscFirmyMinimalna) ?? null,
        srednia: map.get(INDICATOR.WartoscFirmySrednia) ?? null,
        maksymalna: map.get(INDICATOR.WartoscFirmyMaksymalna) ?? null,
      },
      kredyt_kupiecki: {
        minimalny: map.get(INDICATOR.KredytKupieckiMinimalny) ?? null,
        sredni: map.get(INDICATOR.KredytKupieckiSredni) ?? null,
        maksymalny: map.get(INDICATOR.KredytKupieckiMaksymalny) ?? null,
      },
      ryzyko: {
        prawdopodobienstwo_24m: map.get(INDICATOR.Niewyplacalnosc24m) ?? null,
        wiarygodnosc: map.get(INDICATOR.Wiarygodnosc) ?? null,
      },
    };
  });
}
