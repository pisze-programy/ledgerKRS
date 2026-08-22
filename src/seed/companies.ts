import type { CatalogRow } from "../store/catalog";

export const SEED_KRS = [
  "0000222483",
  "0000795513",
  "0000597711",
  "0000005714",
  "0000003409",
  "0000670940",
  "0000018550",
  "0000060888",
  "0001023457",
  "0000781241",
  "0000166742",
  "0001207691",
  "0000498819",
  "0000059307",
  "0000028860",
  "0000009831",
  "0000023302",
  "0000271562",
  "0000408273",
  "0000010681",
  "0000001764",
  "0000010078",
  "0000033391",
  "0000048967",
  "0000074309",
];

export interface SeedFinancials {
  rok: number;
  indicators: Record<string, number>;
}

const FINANCIAL_COLUMNS: Record<string, keyof CatalogRow> = {
  przychody: "przychody",
  zysk_netto: "zyskNetto",
  suma_bilansowa: "sumaBilansowa",
  aktywa_trwale: "aktywaTrwale",
  aktywa_obrotowe: "aktywaObrotowe",
  gotowka: "gotowka",
  kapital_wlasny: "kapitalWlasny",
  zobowiazania_i_rezerwy: "zobowiazaniaIRezerwy",
  kapital_zakladowy: "kapitalZakladowy",
  podatek_dochodowy: "podatekDochodowy",
  zysk_operacyjny: "zyskOperacyjny",
  koszty_operacyjne: "kosztyOperacyjne",
  ebit: "ebit",
  ebitda: "ebitda",
  wynagrodzenia: "wynagrodzenia",
  amortyzacja: "amortyzacja",
  zatrudnienie: "zatrudnienie",
  roa: "roa",
  roe: "roe",
  marza_netto: "marzaNetto",
  marza_operacyjna: "marzaOperacyjna",
  wskaznik_zadluzenia: "wskaznikZadluzenia",
  wartosc_firmy_srednia: "estymowanaWartoscFirmy",
};

export function applyFinancials(row: CatalogRow, financials: SeedFinancials): void {
  row.rok = financials.rok;
  const target = row as unknown as Record<string, unknown>;
  for (const [name, column] of Object.entries(FINANCIAL_COLUMNS)) {
    const value = financials.indicators[name];
    if (typeof value === "number" && Number.isFinite(value)) {
      target[column] = value;
    }
  }
}
