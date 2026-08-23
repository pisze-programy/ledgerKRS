import type { ApiDeps } from "../api/deps";
import type { CompanyReport } from "../domain/types";
import type { WspolnaOsoba } from "./osoby";

export interface ReportContext {
  deps: ApiDeps;
  krs: string;
  report: CompanyReport;
}

export interface EnrichedReport {
  krs: string;
  nip: string | null;
  regon: string | null;
  kod_pkd: string | null;
  opis_pkd: string | null;
  informacje_o_firmie: CompanyReport["company"];
  summary: Summary;
  finansowe: FinancialSeries[];
  monitor: CompanyReport["monitor"];
  krz: CompanyReport["krz"];
  historia_sprawozdan: CompanyReport["history"];
  terminowosc: Terminowosc;
  pozycja_na_tle_branzy: CompanyReport["benchmarks"];
  opisy_firmy: CompanyReport["descriptions"];
  powiazania: CompanyReport["connections"];
  powiazania_pochodne: DerivedConnections;
  udzialowcy: CompanyReport["ownership"];
  podobne_organizacje: SimilarOrganization[];
}

export interface Summary {
  aktywa: number | null;
  przychody: number | null;
  zysk_netto: number | null;
  wartosc_firmy: number | null;
  zatrudnienie: number | null;
  branza_glowna: { kod: string | null; opis: string | null };
  rok: number | null;
}

export interface FinancialSeries {
  okres_sprawozdawczy: string;
  rok: number | null;
  wskazniki: Record<string, number>;
  wycena: { minimalna: number | null; srednia: number | null; maksymalna: number | null };
  kredyt_kupiecki: { minimalny: number | null; sredni: number | null; maksymalny: number | null };
  ryzyko: { prawdopodobienstwo_24m: number | null; wiarygodnosc: number | null };
}

export interface Terminowosc {
  razem: number;
  w_terminie: number;
  po_terminie: number;
  srednie_opoznienie_dni: number | null;
}

export interface SimilarOrganization {
  krs: string;
  name: string | null;
  pkd_podklasa: string | null;
  przychody: number | null;
  zysk_netto: number | null;
}

export interface DerivedConnections {
  identyczny_nip: { krs: string; name: string | null }[];
  identyczny_regon: { krs: string; name: string | null }[];
  zwrotne: { krs: string; name: string | null; typ: string }[];
  wspolne_osoby: WspolnaOsoba[];
}
