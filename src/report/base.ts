import { INDICATOR } from "../domain/vocab";
import type { ReportContext, Summary } from "./context";

export function kodPkd(ctx: ReportContext): string | null {
  return ctx.report.pkdCodes[0]?.code ?? null;
}

export function opisPkd(ctx: ReportContext): string | null {
  return ctx.report.pkdCodes[0]?.description ?? null;
}

export function summary(ctx: ReportContext): Summary {
  const latest = latestYear(ctx);
  const value = (name: string): number | null => latest?.indicators.find((item) => item.nazwa_wskaznika === name)?.kwota ?? null;
  const mainPkd = ctx.report.pkdCodes[0];
  return {
    aktywa: value(INDICATOR.SumaBilansowa),
    przychody: value(INDICATOR.Przychody),
    zysk_netto: value(INDICATOR.ZyskNetto),
    wartosc_firmy: value(INDICATOR.WartoscFirmySrednia),
    zatrudnienie: value(INDICATOR.Zatrudnienie) ?? value(INDICATOR.ZatrudnienieEstymowane),
    branza_glowna: { kod: mainPkd?.code ?? null, opis: mainPkd?.description ?? null },
    rok: latest?.rok ?? null,
  };
}

function latestYear(ctx: ReportContext): ReportContext["report"]["financials"][number] | null {
  const years = [...ctx.report.financials].sort((a, b) => (b.okresSprawozdawczy ?? "").localeCompare(a.okresSprawozdawczy ?? ""));
  return years[0] ?? null;
}
