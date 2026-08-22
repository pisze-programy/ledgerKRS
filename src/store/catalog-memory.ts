import type { CatalogQuery } from "../search/catalog-build";
import type { SearchQuery } from "../search/fulltext";
import type { BranchStat, CatalogRepository, CatalogRow, SearchResult, TaxonomyEntry } from "./catalog";

export function createMemoryCatalogRepository(): CatalogRepository {
  const rows = new Map<string, CatalogRow>();
  const taxonomy = new Map<string, TaxonomyEntry>();
  const branchStats = new Map<string, BranchStat>();

  return {
    async upsertCatalogRows(entries: CatalogRow[]): Promise<void> {
      for (const entry of entries) {
        rows.set(entry.krs, entry);
      }
    },
    async searchCatalog(query: CatalogQuery): Promise<SearchResult> {
      const params = [...query.params];
      const sorted = [...rows.values()]
        .filter((row) => matchesClauses(query.where, params, row))
        .sort((a, b) => compareSort(query.orderBy, a, b));
      return { rows: sorted.slice(query.offset, query.offset + query.limit), count: sorted.length };
    },
    async searchFulltext(query: SearchQuery): Promise<SearchResult> {
      const term = String(query.params[0] ?? "").replace(/%/g, "");
      const matches = [...rows.values()].filter((row) =>
        [row.name, row.nip, row.krs, row.regon].some((value) => value?.toUpperCase().includes(term.toUpperCase())),
      );
      const sorted = matches.sort((a, b) => (a.name ?? "").length - (b.name ?? "").length);
      return { rows: sorted.slice(0, query.limit), count: sorted.length };
    },
    async listTaxonomy(level?: string, parent?: string): Promise<TaxonomyEntry[]> {
      return [...taxonomy.values()]
        .filter((entry) => (level ? entry.level === level : true))
        .filter((entry) => (parent ? entry.parent === parent : true))
        .sort((a, b) => a.code.localeCompare(b.code));
    },
    async upsertTaxonomy(entries: TaxonomyEntry[]): Promise<void> {
      for (const entry of entries) {
        taxonomy.set(entry.code, entry);
      }
    },
    async getBranchStats(pkd: string, rok: number): Promise<BranchStat | null> {
      return branchStats.get(`${pkd}:${rok}`) ?? null;
    },
    async listBranchStats(pkd: string): Promise<BranchStat[]> {
      return [...branchStats.values()]
        .filter((stat) => stat.pkd === pkd)
        .sort((a, b) => a.rok - b.rok);
    },
    async upsertBranchStats(stats: BranchStat[]): Promise<void> {
      for (const stat of stats) {
        branchStats.set(`${stat.pkd}:${stat.rok}`, stat);
      }
    },
  };
}

function matchesClauses(where: string, params: unknown[], row: CatalogRow): boolean {
  return splitWhere(where).every((clause) => evaluateClause(clause, params, row));
}

function splitWhere(where: string): string[] {
  return where
    .replace(/^\s*WHERE\s+/, "")
    .split(/\s+AND\s+/)
    .filter((clause) => clause.length > 0);
}

function evaluateClause(clause: string, params: unknown[], row: CatalogRow): boolean {
  const [column, op] = clause.trim().split(/\s+/);
  const value = params.shift();
  const cell = getValue(column!, row);
  if (op === "=") {
    return String(cell ?? "").toUpperCase() === String(value).toUpperCase();
  }
  if (op === ">=") {
    return (cell as number) >= (value as number);
  }
  if (op === "<=") {
    return (cell as number) <= (value as number);
  }
  if (op === "LIKE") {
    return likeMatch(String(value).toUpperCase(), String(cell ?? "").toUpperCase());
  }
  return true;
}

function likeMatch(pattern: string, text: string): boolean {
  if (pattern.startsWith("%") && pattern.endsWith("%")) {
    return text.includes(pattern.slice(1, -1));
  }
  return text.startsWith(pattern.slice(0, -1));
}

function compareSort(orderBy: string, a: CatalogRow, b: CatalogRow): number {
  const column = orderBy.match(/ORDER BY (\w+)/)?.[1] ?? "suma_bilansowa";
  const direction = orderBy.includes("ASC") ? 1 : -1;
  const va = toNumber(getValue(column, a));
  const vb = toNumber(getValue(column, b));
  return (va - vb) * direction;
}

function toNumber(value: unknown): number {
  return value === null || value === undefined ? -Infinity : Number(value);
}

function getValue(column: string, row: CatalogRow): unknown {
  const map: Record<string, unknown> = {
    krs: row.krs, name: row.name, nip: row.nip, regon: row.regon, legal_form: row.legalForm,
    street: row.street, city: row.city, wojewodztwo: row.voivodeship, postal_code: row.postalCode,
    pkd_sekcja: row.pkdSekcja, pkd_dzial: row.pkdDzial, pkd_podklasa: row.pkdPodklasa,
    nie_wykreslona: row.nieWykreslona ? 1 : 0, czy_status_opp: row.czyStatusOpp ? 1 : 0, cit_estonski: row.citEstonski ? 1 : 0,
    ostatni_krz: row.ostatniKrz, ostatni_monitor: row.ostatniMonitor,
    przychody: row.przychody, zysk_netto: row.zyskNetto, suma_bilansowa: row.sumaBilansowa,
    aktywa_trwale: row.aktywaTrwale, aktywa_obrotowe: row.aktywaObrotowe, gotowka: row.gotowka,
    kapital_wlasny: row.kapitalWlasny, zobowiazania_i_rezerwy: row.zobowiazaniaIRezerwy,
    podatek_dochodowy: row.podatekDochodowy, zysk_operacyjny: row.zyskOperacyjny,
    koszty_operacyjne: row.kosztyOperacyjne, ebit: row.ebit, ebitda: row.ebitda,
    wynagrodzenia: row.wynagrodzenia, amortyzacja: row.amortyzacja, zatrudnienie: row.zatrudnienie,
    roa: row.roa, roe: row.roe, marza_netto: row.marzaNetto, marza_operacyjna: row.marzaOperacyjna,
    wskaznik_zadluzenia: row.wskaznikZadluzenia, estymowana_wartosc_firmy: row.estymowanaWartoscFirmy,
    cagr_1: row.cagr1, cagr_3: row.cagr3, cagr_5: row.cagr5,
  };
  return map[column];
}
