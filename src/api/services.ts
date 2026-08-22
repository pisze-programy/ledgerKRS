import { parseCatalogFilters } from "../search/catalog-parse";
import { buildCatalogQuery, CatalogFilterError } from "../search/catalog-build";
import { buildSearchQuery, SEARCH_CAP } from "../search/fulltext";
import { findByCode, slugify, taxonomyByParent } from "../sources/pkd/taxonomy";
import { computeBranchStats, computeGrowth } from "../metrics/branch";
import type { CompanyReport } from "../domain/types";
import type { CatalogRow } from "../store/catalog";
import type { ApiDeps } from "./deps";

export class ServiceError extends Error {}

export async function resolveKrs(deps: ApiDeps, krs?: string, nip?: string): Promise<string | null> {
  if (krs) {
    return krs;
  }
  return nip ? krsFromNip(deps, nip) : null;
}

export async function reportFor(deps: ApiDeps, krs?: string, nip?: string): Promise<CompanyReport | null> {
  const target = await resolveKrs(deps, krs, nip);
  if (!target) {
    return null;
  }
  return deps.repository.getReport(target);
}

export async function statementsFor(deps: ApiDeps, krs: string): Promise<unknown | null> {
  const positions = await deps.repository.getStatementPositions(krs);
  if (positions.length === 0) {
    return null;
  }
  return { krs, okresy: groupByOkres(positions) };
}

export interface CatalogResult {
  data: Record<string, unknown>[];
  count: number;
  fetchedCount: number;
}

export async function catalogFor(
  deps: ApiDeps,
  params: URLSearchParams,
  sort: string,
  order: string,
  limit: number,
  offset: number,
): Promise<CatalogResult> {
  const filters = parseCatalogFilters(params);
  let query;
  try {
    query = buildCatalogQuery(filters, sort, order, limit, offset);
  } catch (error) {
    if (error instanceof CatalogFilterError) {
      throw new ServiceError(error.message);
    }
    throw error;
  }
  const result = await deps.catalog.searchCatalog(query);
  return {
    data: result.rows.map(toCatalogDto),
    count: result.count,
    fetchedCount: result.rows.length,
  };
}

export interface SearchResult {
  data: { krs: string }[];
  daneUciete: boolean;
}

export async function searchFor(deps: ApiDeps, q: string): Promise<SearchResult> {
  const query = buildSearchQuery(q, 1000);
  const result = await deps.catalog.searchFulltext(query);
  return {
    data: result.rows.map((row) => ({ krs: row.krs })),
    daneUciete: result.count > SEARCH_CAP,
  };
}

export interface BranchesTree {
  code: string;
  name: string;
  level: string;
  divisions: { code: string; name: string; level: string }[];
}

export async function branchesTree(deps: ApiDeps): Promise<BranchesTree[]> {
  return taxonomyByParent(null, "section").map((section) => ({
    code: section.code,
    name: section.name,
    level: section.level,
    divisions: taxonomyByParent(section.code, "division").map((division) => ({
      code: division.code,
      name: division.name,
      level: division.level,
    })),
  }));
}

export async function pkdReport(deps: ApiDeps, code: string, requestedRok?: number): Promise<unknown | null> {
  const entry = findByCode(code);
  if (!entry) {
    return null;
  }
  const stats = await deps.catalog.listBranchStats(code);
  const years = stats.map((stat) => stat.rok).sort((a, b) => b - a);
  const year = requestedRok !== undefined && Number.isFinite(requestedRok) ? requestedRok : years[0] ?? currentYear();
  const rows = await rowsForPkd(deps, code, entry.level);
  const live = computeBranchStats(code, year, rows);
  const stat = stats.find((item) => item.rok === year) ?? live.stat;
  return {
    code: entry.code,
    name: entry.name,
    level: entry.level,
    parent: entry.parent,
    section: entry.section,
    slug: slugify(entry.name),
    year,
    years,
    summary: {
      count: stat.count,
      total_przychody: stat.totalPrzychody,
      avg_przychod: stat.avgPrzychod,
      avg_zysk: stat.avgZysk,
    },
    size: {
      count: stat.count,
      total_przychody: stat.totalPrzychody,
      growth: computeGrowth(stats),
    },
    top: live.top.slice(0, 10).map((row) => ({ krs: row.krs, name: row.name, przychody: row.przychody })),
    geo: live.geo,
    percentiles: {
      przychody: percentiles(stat.p10Przychody, stat.p20Przychody, stat.p50Przychody, stat.p90Przychody),
      zysk: percentiles(stat.p10Zysk, stat.p20Zysk, stat.p50Zysk, stat.p90Zysk),
      wartosc: percentiles(stat.p10Wartosc, stat.p20Wartosc, stat.p50Wartosc, stat.p90Wartosc),
    },
  };
}

async function krsFromNip(deps: ApiDeps, nip: string): Promise<string | null> {
  const query = buildSearchQuery(nip, 5);
  const result = await deps.catalog.searchFulltext(query);
  return result.rows[0]?.krs ?? null;
}

async function rowsForPkd(deps: ApiDeps, code: string, level: string): Promise<CatalogRow[]> {
  const filters =
    level === "section"
      ? { pkdSekcja: code }
      : level === "division"
        ? { pkdDzial: code }
        : { pkdPodklasa: code };
  const query = buildCatalogQuery(filters, "przychody", "desc", 1000, 0);
  const result = await deps.catalog.searchCatalog(query);
  return result.rows;
}

function toCatalogDto(row: CatalogRow): Record<string, unknown> {
  return {
    krs: row.krs,
    name: row.name,
    nip: row.nip,
    regon: row.regon,
    legal_form: row.legalForm,
    miasto: row.city,
    wojewodztwo: row.voivodeship,
    pkd_podklasa: row.pkdPodklasa,
    aktywa: row.sumaBilansowa,
    przychody: row.przychody,
    zysk_netto: row.zyskNetto,
    wartosc_firmy: row.estymowanaWartoscFirmy,
  };
}

function groupByOkres(positions: { okresSprawozdawczy: string; sekcja: string; kod_pozycji: string; poziom_zaglebienia: number | null; nazwa_pozycji: string | null; kwota: number | null }[]): unknown[] {
  const byOkres = new Map<string, Map<string, unknown[]>>();
  for (const position of positions) {
    const sections = byOkres.get(position.okresSprawozdawczy) ?? new Map();
    const pozycje = sections.get(position.sekcja) ?? [];
    pozycje.push({
      pozycja_szczegolowa: null,
      kod_pozycji: position.kod_pozycji,
      poziom_zaglebienia: position.poziom_zaglebienia,
      nazwa_pozycji: position.nazwa_pozycji,
      kwota: position.kwota,
    });
    sections.set(position.sekcja, pozycje);
    byOkres.set(position.okresSprawozdawczy, sections);
  }
  return [...byOkres.entries()].map(([okres, sections]) => ({
    okres_sprawozdawczy: okres,
    sekcje: [...sections.entries()].map(([sekcja, pozycje]) => ({ sekcja, pozycje })),
  }));
}

function percentiles(p10: number | null, p20: number | null, p50: number | null, p90: number | null): Record<string, number | null> {
  return { "10": p10, "20": p20, "50": p50, "90": p90 };
}

function currentYear(): number {
  return new Date().getFullYear() - 1;
}
