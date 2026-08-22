import type { CatalogFilters } from "./catalog-parse";

export interface CatalogQuery {
  where: string;
  params: unknown[];
  orderBy: string;
  limit: number;
  offset: number;
}

export const SORTABLE_COLUMNS = {
  aktywa: "suma_bilansowa",
  przychod: "przychody",
  przychody: "przychody",
  zysk: "zysk_netto",
  zysk_netto: "zysk_netto",
  cagr: "cagr_3",
  zadluzenie: "wskaznik_zadluzenia",
  marza_operacyjna: "marza_operacyjna",
  marza_netto: "marza_netto",
  aktywa_obrotowe: "aktywa_obrotowe",
  kapital_wlasny: "kapital_wlasny",
  roa: "roa",
  roe: "roe",
  podatek: "podatek_dochodowy",
  wartosc: "estymowana_wartosc_firmy",
} as const;

export function buildCatalogQuery(
  filters: CatalogFilters,
  sort: string,
  order: string,
  limit: number,
  offset: number,
): CatalogQuery {
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (countActiveFilters(filters) === 0) {
    throw new CatalogFilterError("co najmniej jeden filtr");
  }
  addRange(clauses, params, "przychody", filters.przychodyOd, filters.przychodyDo);
  addRange(clauses, params, "zysk_netto", filters.zyskNettoOd, filters.zyskNettoDo);
  addEqual(clauses, params, "pkd_sekcja", filters.pkdSekcja);
  addEqual(clauses, params, "pkd_dzial", filters.pkdDzial);
  addEqual(clauses, params, "pkd_podklasa", filters.pkdPodklasa);
  addEqual(clauses, params, "voivodeship", filters.wojewodztwo);
  addLike(clauses, params, "city", filters.miasto);
  addLike(clauses, params, "street", filters.adres);
  addLike(clauses, params, "postal_code", filters.kodPocztowyPoczatek, true);
  addLike(clauses, params, "postal_code", filters.kodPocztowyKoncowka, true);
  addRange(clauses, params, "zatrudnienie", filters.zatrudnienieOd, filters.zatrudnienieDo);
  addRange(clauses, params, "roa", filters.roaOd, filters.roaDo);
  addRange(clauses, params, "roe", filters.roeOd, filters.roeDo);
  addRange(clauses, params, "marza_netto", filters.marzaNettoOd, filters.marzaNettoDo);
  addRange(clauses, params, "marza_operacyjna", filters.marzaOperacyjnaOd, filters.marzaOperacyjnaDo);
  addRange(clauses, params, "wskaznik_zadluzenia", filters.wskaznikZadluzeniaOd, filters.wskaznikZadluzeniaDo);
  addRange(clauses, params, "ebit", filters.ebitOd, filters.ebitDo);
  addRange(clauses, params, "ebitda", filters.ebitdaOd, filters.ebitdaDo);
  addRange(clauses, params, "aktywa_trwale", filters.aktywaTrwaleOd, filters.aktywaTrwaleDo);
  addRange(clauses, params, "aktywa_obrotowe", filters.aktywaObrotoweOd, filters.aktywaObrotoweDo);
  addRange(clauses, params, "suma_bilansowa", filters.sumaBilansowaOd, filters.sumaBilansowaDo);
  addRange(clauses, params, "gotowka", filters.gotowkaOd, filters.gotowkaDo);
  addRange(clauses, params, "kapital_wlasny", filters.kapitalWlasnyOd, filters.kapitalWlasnyDo);
  addRange(clauses, params, "zobowiazania_i_rezerwy", filters.zobowiazaniaOd, filters.zobowiazaniaDo);
  addRange(clauses, params, "podatek_dochodowy", filters.podatekDochodowyOd, filters.podatekDochodowyDo);
  addRange(clauses, params, "wynagrodzenia", filters.wynagrodzeniaOd, filters.wynagrodzeniaDo);
  addRange(clauses, params, "amortyzacja", filters.amortyzacjaOd, filters.amortyzacjaDo);
  addRange(clauses, params, "estymowana_wartosc_firmy", filters.wartoscFirmyOd, filters.wartoscFirmyDo);
  addRange(clauses, params, "cagr_1", filters.cagr1Od, filters.cagr1Do);
  addRange(clauses, params, "cagr_3", filters.cagr3Od, filters.cagr3Do);
  addRange(clauses, params, "cagr_5", filters.cagr5Od, filters.cagr5Do);
  addBool(clauses, "nie_wykreslona", filters.nieWykreslona);
  addBool(clauses, "czy_status_opp", filters.czyStatusOpp);
  addBool(clauses, "cit_estonski", filters.citEstonski);
  addRecent(clauses, params, "ostatni_krz", filters.ostatniKrz);
  addRecent(clauses, params, "ostatni_monitor", filters.ostatniMonitor);
  const column = SORTABLE_COLUMNS[sort as keyof typeof SORTABLE_COLUMNS] ?? "suma_bilansowa";
  const direction = order === "asc" ? "ASC" : "DESC";
  return {
    where: clauses.length > 0 ? ` WHERE ${clauses.join(" AND ")}` : "",
    params,
    orderBy: ` ORDER BY ${column} IS NULL, ${column} ${direction}`,
    limit,
    offset,
  };
}

export class CatalogFilterError extends Error {}

function countActiveFilters(filters: CatalogFilters): number {
  return Object.values(filters).filter((value) => value !== undefined && value !== false).length;
}

function addRange(clauses: string[], params: unknown[], column: string, from: number | undefined, to: number | undefined): void {
  if (from !== undefined) {
    clauses.push(`${column} >= ?`);
    params.push(from);
  }
  if (to !== undefined) {
    clauses.push(`${column} <= ?`);
    params.push(to);
  }
}

function addEqual(clauses: string[], params: unknown[], column: string, value: string | undefined): void {
  if (value !== undefined) {
    clauses.push(`${column} = ?`);
    params.push(value.toUpperCase());
  }
}

function addLike(clauses: string[], params: unknown[], column: string, value: string | undefined, prefixOnly = false): void {
  if (value !== undefined) {
    clauses.push(`${column} LIKE ?`);
    params.push(prefixOnly ? `${value.toUpperCase()}%` : `%${value.toUpperCase()}%`);
  }
}

function addBool(clauses: string[], column: string, value: boolean | undefined): void {
  if (value) {
    clauses.push(`${column} = 1`);
  }
}

function addRecent(clauses: string[], params: unknown[], column: string, days: number | undefined): void {
  if (days !== undefined) {
    clauses.push(`${column} > 0 AND ${column} <= ?`);
    params.push(days);
  }
}
