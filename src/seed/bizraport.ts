import bizraportKrs from "./bizraport-krs.json";
import { applyFinancials } from "./companies";
import { mapBizraportCompany, enrichReportWithBizraport, mapBizraportConnections, mapBizraportOwnership } from "../sources/bizraport/mapper";
import { createBizraportClient, type BizraportClient, type BizraportSprawozdania } from "../sources/bizraport/client";
import { sectionLetterOf, divisionOf } from "../sources/pkd/taxonomy";
import type { Repository } from "../store/repository";
import type { CatalogRepository, CatalogRow } from "../store/catalog";
import type { CompanyReport } from "../domain/types";
import type { IngestService } from "../pipeline/ingest";
import type { AppConfig } from "../config";

export interface BizraportSeedDeps {
  ingest: IngestService;
  repository: Repository;
  catalog: CatalogRepository;
  config: AppConfig;
}

export interface BizraportSeedOptions {
  offset?: number;
  limit?: number;
  withSprawozdania?: number;
  sprawozdaniaFirst?: string[];
}

export interface BizraportSeedResult {
  companies: number;
  indicatorsYears: number;
  monitor: number;
  krz: number;
  history: number;
  descriptions: number;
  benchmarks: number;
  sprawozdania: number;
  usedCredits: number;
  failed: string[];
}

export async function seedBizraport(deps: BizraportSeedDeps, options: BizraportSeedOptions = {}): Promise<BizraportSeedResult> {
  if (!deps.config.bizraportEmail || !deps.config.bizraportPassword) {
    throw new Error("BIZRAPORT_EMAIL/BIZRAPORT_PASSWORD missing");
  }
  const client = createBizraportClient({ email: deps.config.bizraportEmail, password: deps.config.bizraportPassword });
  const list = (bizraportKrs as string[]).slice(options.offset ?? 0, (options.offset ?? 0) + (options.limit ?? 48));
  const sprawozdaniaSet = new Set(options.sprawozdaniaFirst ?? list.slice(0, options.withSprawozdania ?? 0));

  const result: BizraportSeedResult = {
    companies: 0,
    indicatorsYears: 0,
    monitor: 0,
    krz: 0,
    history: 0,
    descriptions: 0,
    benchmarks: 0,
    sprawozdania: 0,
    usedCredits: 0,
    failed: [],
  };

  for (const krs of list) {
    try {
      await deps.ingest.ingestCompany(krs);
      const biz = await client.getDane(krs);
      result.usedCredits += 1;
      const report = await deps.repository.getReport(krs);
      if (!report) {
        continue;
      }
      const enriched = enrichReportWithBizraport(report, biz);
      enriched.connections = mapBizraportConnections(biz.powiazania ?? []);
      enriched.ownership = mapBizraportOwnership(biz.udzialy ?? []);
      await deps.repository.upsertCompany(enriched);

      const patch = mapBizraportCompany(krs, biz);
      for (const [okres, indicators] of Object.entries(patch.indicators)) {
        await deps.repository.upsertIndicators(krs, okres, indicators);
        result.indicatorsYears += 1;
      }
      await deps.repository.upsertMonitor(krs, patch.monitor);
      await deps.repository.upsertKrz(krs, patch.krz);
      await deps.repository.upsertHistory(krs, patch.history);
      await deps.repository.upsertDescriptions(krs, patch.descriptions);
      await deps.repository.upsertCompanyBenchmarks(krs, patch.benchmarks);
      result.monitor += patch.monitor.length;
      result.krz += patch.krz.length;
      result.history += patch.history.length;
      result.descriptions += patch.descriptions.length;
      result.benchmarks += patch.benchmarks.length;
      result.companies += 1;

      await deps.catalog.upsertCatalogRows([catalogRowFromReport(enriched)]);

      if (sprawozdaniaSet.has(krs)) {
        const sprawozdania = await client.getSprawozdania(krs);
        result.usedCredits += 1;
        const ingested = await ingestSprawozdania(deps.repository, krs, sprawozdania);
        result.sprawozdania += ingested;
      }
    } catch (error) {
      result.failed.push(`${krs}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return result;
}

async function ingestSprawozdania(
  repository: Repository,
  krs: string,
  sprawozdania: BizraportSprawozdania,
): Promise<number> {
  const company = sprawozdania.data?.[0];
  if (!company) {
    return 0;
  }
  let count = 0;
  for (const okres of company.okresy ?? []) {
    const [from, to] = splitPeriod(okres.okres_sprawozdawczy);
    const statementId = await repository.upsertStatement(krs, { periodFrom: from, periodTo: to, filedAt: null });
    const positions: { sekcja: string; kod_pozycji: string | null; poziom_zaglebienia: number | null; nazwa_pozycji: string | null; kwota: number | null }[] = [];
    for (const section of okres.sekcje) {
      for (const position of section.pozycje) {
        positions.push({ sekcja: section.sekcja, kod_pozycji: position.kod_pozycji, poziom_zaglebienia: position.poziom_zaglebienia, nazwa_pozycji: position.nazwa_pozycji, kwota: position.kwota });
      }
    }
    await repository.upsertPositions(statementId, positions);
    count += positions.length;
  }
  return count;
}

function splitPeriod(period: string): [string | null, string | null] {
  const [from, to] = period.split("_");
  return [from ?? null, to ?? null];
}

function catalogRowFromReport(report: CompanyReport): CatalogRow {
  const company = report.company;
  const pkd = report.pkdCodes[0]?.code ?? null;
  const latest = [...report.financials].sort((a, b) => b.okresSprawozdawczy.localeCompare(a.okresSprawozdawczy))[0];
  const row: CatalogRow = {
    krs: company.krs,
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
  if (latest) {
    applyFinancials(row, {
      rok: latest.rok ?? 0,
      indicators: Object.fromEntries(latest.indicators.map((item) => [item.nazwa_wskaznika, item.kwota])),
    });
  }
  return row;
}
