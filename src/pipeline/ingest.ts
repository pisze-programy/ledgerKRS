import { parseOdpis } from "../sources/krs/parser";
import { createKrsClient } from "../sources/krs/client";
import { createRdfClient, isXmlCapable } from "../sources/rdf/client";
import { parseSprawozdanie, type ParsedStatement } from "../sources/rdf/parser";
import { statementMeta } from "../sources/rdf/layouts";
import { extractFinancialInput, type YearFinancials } from "../sources/rdf/indicators";
import { fiscalYearOf } from "../sources/rdf/period";
import { selectAnnualYears, type AnnualCandidate } from "../sources/rdf/selection";
import { historyEntryFromMeta } from "../sources/rdf/history";
import { fetchMonitorForKrs } from "../sources/msig/client";
import { buildCompanyDescription } from "../metrics/description";
import { computeCompanyPercentiles, type BenchmarkFirm } from "../metrics/benchmarks";
import { BENCHMARK_INDICATORS, type BenchmarkIndicator } from "../domain/vocab";
import type { FinancialInput } from "../metrics/indicators";
import { buildFullIndicators, NO_SIGNALS } from "../metrics/report";
import type { RiskSignals } from "../metrics/risk";
import type { IndustryBenchmarkRow, CompanyReport } from "../domain/types";
import type { Repository, Benchmark } from "../store/repository";

export interface IngestDeps {
  krsClient: ReturnType<typeof createKrsClient>;
  rdfClient?: ReturnType<typeof createRdfClient>;
  repository: Repository;
}

export interface IngestService {
  ingestCompany(krs: string): Promise<IngestResult>;
  ingestBulletin(day: string): Promise<IngestResult>;
  listBulletin(day: string, limit?: number): Promise<string[]>;
  ingestFinancials(krs: string, financials: FinancialInput, signals?: RiskSignals): Promise<void>;
  ingestRdfFinancials(krs: string): Promise<IngestResult>;
  ingestMonitor(krs: string): Promise<IngestResult>;
  ingestDerived(krs: string): Promise<IngestResult>;
  computeBenchmarks(): Promise<IngestResult>;
  persistStatement(krs: string, statement: ParsedStatement, okres: string | null): Promise<void>;
  ingestBenchmarks(pkd: string, rows: IndustryBenchmarkRow[]): Promise<void>;
  ingestAnnouncements(krs: string, report: CompanyReport): Promise<void>;
}

export interface IngestResult {
  processed: number;
  failed: number;
}

export function createIngest(deps: IngestDeps): IngestService {
  return {
    async ingestCompany(krs: string): Promise<IngestResult> {
      const raw = await deps.krsClient.getOdpisAktualny(krs);
      const report = parseOdpis(raw);
      if (!report) {
        return { processed: 0, failed: 1 };
      }
      await deps.repository.upsertCompany(report);
      return { processed: 1, failed: 0 };
    },
    async ingestBulletin(day: string): Promise<IngestResult> {
      const krsList = await this.listBulletin(day);
      let processed = 0;
      let failed = 0;
      for (const krs of krsList) {
        try {
          const result = await this.ingestCompany(krs);
          processed += result.processed;
          failed += result.failed;
        } catch {
          failed += 1;
        }
      }
      await deps.repository.setIngestState(day);
      return { processed, failed };
    },
    async listBulletin(day: string, limit?: number): Promise<string[]> {
      const krsList = await deps.krsClient.getBiuletyn(day);
      return limit !== undefined ? krsList.slice(0, limit) : krsList;
    },
    async ingestFinancials(krs: string, financials: FinancialInput, signals: RiskSignals = NO_SIGNALS): Promise<void> {
      const indicators = buildFullIndicators(financials, signals);
      await deps.repository.upsertIndicators(krs, financials.okresSprawozdawczy, indicators);
    },
    async ingestRdfFinancials(krs: string): Promise<IngestResult> {
      if (!deps.rdfClient) {
        return { processed: 0, failed: 0 };
      }
      const hits = await deps.rdfClient.searchDocuments(krs);
      const annual = hits.filter((h) => h.rodzaj === "18" || h.rodzaj === "22");
      const gathered: {
        candidate: AnnualCandidate;
        statement: ParsedStatement;
        meta: Record<string, unknown> | null;
        year: YearFinancials | null;
      }[] = [];
      let failed = 0;
      for (const hit of annual) {
        const meta = await deps.rdfClient.documentMeta(hit.id);
        if (!meta || !isXmlCapable(meta)) {
          continue;
        }
        const xml = await deps.rdfClient.downloadXml(hit.id);
        if (!xml) {
          failed += 1;
          continue;
        }
        const statement = parseSprawozdanie(xml);
        if (!statement) {
          failed += 1;
          continue;
        }
        const okres =
          statement.okres_sprawozdawczy ||
          (hit.okresSprawozdawczyPoczatek && hit.okresSprawozdawczyKoniec
            ? `${hit.okresSprawozdawczyPoczatek}_${hit.okresSprawozdawczyKoniec}`
            : null);
        gathered.push({
          candidate: {
            id: hit.id,
            rodzaj: hit.rodzaj,
            okres,
            dataDodania: typeof meta.dataDodania === "string" ? meta.dataDodania : null,
          },
          statement,
          meta,
          year: extractFinancialInput(statement, statementMeta(xml)),
        });
      }
      // One primary statement per fiscal year (BizRaport reports a single row
      // per year; consolidated statements win, transitional/partial periods
      // lose to a genuine annual one, the latest filing supersedes earlier).
      const selected = new Set(selectAnnualYears(gathered.map((g) => g.candidate)).map((s) => s.candidate.id));
      let processed = 0;
      for (const item of gathered) {
        if (!selected.has(item.candidate.id)) {
          continue;
        }
        const year = item.year;
        if (!year) {
          failed += 1;
          continue;
        }
        const okres = item.candidate.okres ?? year.okresSprawozdawczy;
        await this.persistStatement(krs, item.statement, okres);
        if (item.meta) {
          await deps.repository.upsertHistory(krs, [historyEntryFromMeta(item.meta, okres, fiscalYearOf(okres))]);
        }
        await this.ingestFinancials(krs, { ...(year.input as FinancialInput), okresSprawozdawczy: okres ?? year.okresSprawozdawczy });
        processed += 1;
      }
      return { processed, failed };
    },
    async ingestMonitor(krs: string): Promise<IngestResult> {
      const entries = await fetchMonitorForKrs(krs);
      if (entries.length > 0) {
        await deps.repository.upsertMonitor(krs, entries);
      }
      return { processed: entries.length, failed: 0 };
    },
    async ingestDerived(krs: string): Promise<IngestResult> {
      const report = await deps.repository.getReport(krs);
      if (!report) {
        return { processed: 0, failed: 0 };
      }
      const company = report.company;
      const financials = (report.financials ?? []).map((year) => {
        const byName = new Map((year.indicators ?? []).map((i) => [i.nazwa_wskaznika, i.kwota]));
        return {
          rok: year.rok ?? 0,
          przychody: byName.get("przychody") ?? null,
          zyskNetto: byName.get("zysk_netto") ?? null,
          sumaBilansowa: byName.get("suma_bilansowa") ?? null,
          roe: byName.get("roe") ?? null,
          marzaNetto: byName.get("marza_netto") ?? null,
        };
      });
      const description = buildCompanyDescription({
        name: company?.name ?? "",
        legalForm: company?.legalForm ?? null,
        city: company?.address?.city ?? null,
        pkdDescription: report.pkdCodes?.[0]?.description ?? null,
        financials,
      });
      await deps.repository.upsertDescriptions(krs, [description]);
      return { processed: 1, failed: 0 };
    },
    async computeBenchmarks(): Promise<IngestResult> {
      const companies = await deps.repository.listCompanies(10000, 0);
      const firms: BenchmarkFirm[] = [];
      for (const company of companies) {
        const report = await deps.repository.getReport(company.krs);
        if (!report) {
          continue;
        }
        const pkd = report.pkdCodes?.[0]?.code ?? null;
        if (!pkd) {
          continue;
        }
        for (const year of report.financials ?? []) {
          const values: Partial<Record<BenchmarkIndicator, number>> = {};
          for (const indicator of year.indicators ?? []) {
            if (BENCHMARK_INDICATORS.includes(indicator.nazwa_wskaznika as BenchmarkIndicator)) {
              values[indicator.nazwa_wskaznika as BenchmarkIndicator] = indicator.kwota;
            }
          }
          firms.push({ krs: company.krs, pkd, okres: year.okresSprawozdawczy, rok: year.rok ?? 0, values });
        }
      }
      const byFirm = computeCompanyPercentiles(firms);
      let processed = 0;
      for (const [krs, list] of byFirm) {
        await deps.repository.upsertCompanyBenchmarks(krs, list);
        processed += list.length;
      }
      return { processed, failed: 0 };
    },
    async persistStatement(krs: string, statement: ParsedStatement, okres: string | null): Promise<void> {
      const [periodFrom, periodTo] = (okres ?? "").split("_");
      const statementId = await deps.repository.upsertStatement(krs, { periodFrom: periodFrom || undefined, periodTo: periodTo || undefined, filedAt: null });
      if (statementId === 0) {
        return;
      }
      const positions: {
        sekcja: string;
        kod_pozycji: string | null;
        poziom_zaglebienia: number | null;
        nazwa_pozycji: string | null;
        kwota: number | null;
      }[] = [];
      for (const section of statement.sekcje) {
        for (const position of section.pozycje) {
          positions.push({
            sekcja: section.sekcja,
            kod_pozycji: position.kod_pozycji,
            poziom_zaglebienia: position.poziom_zaglebienia,
            nazwa_pozycji: position.nazwa_pozycji,
            kwota: position.kwota,
          });
        }
      }
      if (positions.length > 0) {
        await deps.repository.upsertPositions(statementId, positions);
      }
    },
    async ingestBenchmarks(pkd: string, rows: IndustryBenchmarkRow[]): Promise<void> {
      const byYear = new Map<number, Benchmark[]>();
      for (const row of rows) {
        const year = row.rok ?? 0;
        const list = byYear.get(year) ?? [];
        list.push({
          pkd,
          rok: year,
          nazwa_wskaznika: row.nazwaWskaznika,
          percentyl: row.percentylWPkd,
          liczba_firm: row.liczbaFirmWBranzy ?? 0,
          udzial_w_rynku: row.udzialWRynku,
          przychody_branzy: row.przychodyCalejBranzy,
        });
        byYear.set(year, list);
      }
      for (const [year, benchmarks] of byYear) {
        await deps.repository.upsertBenchmarks(pkd, year, benchmarks);
      }
    },
    async ingestAnnouncements(krs: string, report: CompanyReport): Promise<void> {
      await deps.repository.upsertMonitor(krs, report.monitor);
      await deps.repository.upsertKrz(krs, report.krz);
      await deps.repository.upsertHistory(krs, report.history);
    },
  };
}
