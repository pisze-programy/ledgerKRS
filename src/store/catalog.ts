import type { CatalogQuery } from "../search/catalog-build";
import type { SearchQuery } from "../search/fulltext";

export interface CatalogRow {
  krs: string;
  name: string | null;
  nip: string | null;
  regon: string | null;
  legalForm: string | null;
  street: string | null;
  city: string | null;
  voivodeship: string | null;
  postalCode: string | null;
  website: string | null;
  email: string | null;
  pkdSekcja: string | null;
  pkdDzial: string | null;
  pkdPodklasa: string | null;
  pkdOpis: string | null;
  nieWykreslona: boolean;
  czyStatusOpp: boolean;
  citEstonski: boolean;
  ostatniKrz: number;
  ostatniMonitor: number;
  rok: number | null;
  przychody?: number | null;
  zyskNetto?: number | null;
  aktywaTrwale?: number | null;
  aktywaObrotowe?: number | null;
  sumaBilansowa?: number | null;
  gotowka?: number | null;
  kapitalWlasny?: number | null;
  zobowiazaniaIRezerwy?: number | null;
  kapitalZakladowy?: number | null;
  podatekDochodowy?: number | null;
  zyskOperacyjny?: number | null;
  kosztyOperacyjne?: number | null;
  ebit?: number | null;
  ebitda?: number | null;
  wynagrodzenia?: number | null;
  amortyzacja?: number | null;
  zatrudnienie?: number | null;
  roa?: number | null;
  roe?: number | null;
  marzaNetto?: number | null;
  marzaOperacyjna?: number | null;
  wskaznikZadluzenia?: number | null;
  estymowanaWartoscFirmy?: number | null;
  cagr1?: number | null;
  cagr3?: number | null;
  cagr5?: number | null;
}

export interface TaxonomyEntry {
  code: string;
  level: string;
  name: string;
  parent: string | null;
  section: string | null;
}

export interface BranchStat {
  pkd: string;
  rok: number;
  count: number;
  totalPrzychody: number | null;
  avgPrzychod: number | null;
  avgZysk: number | null;
  p10Przychody: number | null;
  p20Przychody: number | null;
  p50Przychody: number | null;
  p90Przychody: number | null;
  p10Zysk: number | null;
  p20Zysk: number | null;
  p50Zysk: number | null;
  p90Zysk: number | null;
  p10Wartosc: number | null;
  p20Wartosc: number | null;
  p50Wartosc: number | null;
  p90Wartosc: number | null;
}

export interface SearchResult {
  rows: CatalogRow[];
  count: number;
}

export interface CatalogRepository {
  upsertCatalogRows(rows: CatalogRow[]): Promise<void>;
  searchCatalog(query: CatalogQuery): Promise<SearchResult>;
  searchFulltext(query: SearchQuery): Promise<SearchResult>;
  listTaxonomy(level?: string, parent?: string): Promise<TaxonomyEntry[]>;
  upsertTaxonomy(entries: TaxonomyEntry[]): Promise<void>;
  getBranchStats(pkd: string, rok: number): Promise<BranchStat | null>;
  listBranchStats(pkd: string): Promise<BranchStat[]>;
  upsertBranchStats(stats: BranchStat[]): Promise<void>;
}
