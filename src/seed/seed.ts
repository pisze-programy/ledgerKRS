import seedFinancials from "./seed-financials.json";
import { SEED_KRS, applyFinancials, type SeedFinancials } from "./companies";
import { PKD_TAXONOMY, sectionLetterOf, divisionOf } from "../sources/pkd/taxonomy";
import { computeBranchStats } from "../metrics/branch";
import type { Repository } from "../store/repository";
import type { CatalogRepository, CatalogRow, TaxonomyEntry } from "../store/catalog";
import type { IngestService } from "../pipeline/ingest";

export interface SeedDeps {
  ingest: IngestService;
  repository: Repository;
  catalog: CatalogRepository;
}

export async function seedEverything(deps: SeedDeps): Promise<SeedResult> {
  const taxonomyCount = await seedTaxonomy(deps.catalog);
  const rows: CatalogRow[] = [];
  let ingested = 0;
  for (const krs of SEED_KRS) {
    try {
      await deps.ingest.ingestCompany(krs);
      ingested += 1;
    } catch {
      continue;
    }
    const report = await deps.repository.getReport(krs);
    if (!report) {
      continue;
    }
    rows.push(rowFromReport(report, krs));
  }
  await deps.catalog.upsertCatalogRows(rows);
  const branchCount = await seedBranchStats(deps.catalog, rows);
  return { taxonomyCount, ingested, catalogRows: rows.length, branchStats: branchCount };
}

export interface SeedResult {
  taxonomyCount: number;
  ingested: number;
  catalogRows: number;
  branchStats: number;
}

export async function seedTaxonomy(catalog: CatalogRepository): Promise<number> {
  const entries: TaxonomyEntry[] = PKD_TAXONOMY.map((entry) => ({
    code: entry.code,
    level: entry.level,
    name: entry.name,
    parent: entry.parent,
    section: entry.section,
  }));
  await catalog.upsertTaxonomy(entries);
  return entries.length;
}

export async function seedBranchStats(catalog: CatalogRepository, rows: CatalogRow[]): Promise<number> {
  const groups = new Map<string, CatalogRow[]>();
  for (const row of rows) {
    const key = row.pkdPodklasa ?? "00.00.Z";
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }
  let count = 0;
  for (const [pkd, groupRows] of groups) {
    const { stat } = computeBranchStats(pkd, latestYear(groupRows), groupRows);
    await catalog.upsertBranchStats([stat]);
    count += 1;
  }
  return count;
}

function latestYear(rows: CatalogRow[]): number {
  return Math.max(...rows.map((row) => row.rok ?? 0), 2024);
}

function rowFromReport(report: import("../domain/types").CompanyReport, krs: string): CatalogRow {
  const company = report.company;
  const pkd = report.pkdCodes[0]?.code ?? null;
  const financials = (seedFinancials as Record<string, SeedFinancials>)[krs];
  const row: CatalogRow = {
    krs,
    name: company.name ?? null,
    nip: company.nip ?? null,
    regon: company.regon ?? null,
    legalForm: company.legalForm ?? null,
    street: company.address?.street ?? null,
    city: company.address?.city ?? null,
    voivodeship: company.address?.voivodeship ?? null,
    postalCode: company.address?.postalCode ?? null,
    website: company.website ?? null,
    email: company.email ?? null,
    pkdSekcja: pkd ? sectionLetterOf(pkd) ?? null : null,
    pkdDzial: pkd ? divisionOf(pkd) : null,
    pkdPodklasa: pkd,
    pkdOpis: report.pkdCodes[0]?.description ?? null,
    nieWykreslona: true,
    czyStatusOpp: company.statusOpp ?? false,
    citEstonski: false,
    ostatniKrz: report.krz.length > 0 ? 1 : 0,
    ostatniMonitor: report.monitor.length > 0 ? 1 : 0,
    rok: null,
  };
  if (financials) {
    applyFinancials(row, financials);
  }
  return row;
}
