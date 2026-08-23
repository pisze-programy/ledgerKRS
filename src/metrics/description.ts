import type { CompanyDescription } from "../domain/types";

export interface DescriptionFinancial {
  rok: number;
  przychody?: number | null;
  zyskNetto?: number | null;
  sumaBilansowa?: number | null;
  roe?: number | null;
  roa?: number | null;
  marzaNetto?: number | null;
}

export interface DescriptionInput {
  name: string;
  legalForm?: string | null;
  city?: string | null;
  pkdDescription?: string | null;
  financials: DescriptionFinancial[];
}

function money(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "brak danych";
  }
  const mln = Math.abs(value) / 1_000_000;
  const formatted = (mln >= 1000 ? mln / 1000 : mln).toFixed(2).replace(".", ",");
  return mln >= 1000 ? `${formatted} mld zł` : `${formatted} mln zł`;
}

function pct(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "brak danych";
  }
  return `${(value * 100).toFixed(1).replace(".", ",")}%`;
}

function trend(values: (number | null | undefined)[]): "rosnące" | "malejące" | "stabilne" {
  const clean = values.filter((v): v is number => typeof v === "number");
  if (clean.length < 2) {
    return "stabilne";
  }
  const first = clean[0]!;
  const last = clean[clean.length - 1]!;
  if (last > first * 1.05) {
    return "rosnące";
  }
  if (last < first * 0.95) {
    return "malejące";
  }
  return "stabilne";
}

/** Generate a template-based company description + key facts from data. */
export function buildCompanyDescription(input: DescriptionInput): CompanyDescription {
  const latest = input.financials.at(-1);
  const revenueTrend = trend(input.financials.map((f) => f.przychody));
  const profitTrend = trend(input.financials.map((f) => f.zyskNetto));

  const location = input.city ? ` z siedzibą w ${input.city}` : "";
  const sector = input.pkdDescription ? ` działająca w sektorze „${input.pkdDescription.toLowerCase()}”` : "";
  const form = input.legalForm ? input.legalForm.toLowerCase() : "";

  const opis = [
    `${input.name} (${form})${location}${sector}.`,
    `W ostatnim dostępnym roku sprawozdawczym (${latest?.rok ?? "b.d."}) przychody wyniosły ${money(latest?.przychody)},`,
    `a zysk netto ${money(latest?.zyskNetto)} przy sumie bilansowej ${money(latest?.sumaBilansowa)}.`,
    `Przychody w analizowanym okresie są ${revenueTrend}, a wyniki finansowe ${profitTrend}.`,
  ].join(" ");

  return {
    opis,
    punktKluczowy1: `Przychody: ${money(latest?.przychody)}`,
    punktKluczowy2: `Zysk netto: ${money(latest?.zyskNetto)}`,
    punktKluczowy3: `Aktywa: ${money(latest?.sumaBilansowa)}`,
    punktKluczowy4: `ROE: ${pct(latest?.roe)}`,
    punktKluczowy5: `Marża netto: ${pct(latest?.marzaNetto)}`,
  };
}
