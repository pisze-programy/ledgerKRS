import { parseOdpis } from "../sources/krs/parser";
import { createKrsClient } from "../sources/krs/client";
import type { FinancialInput } from "../metrics/indicators";
import { buildFullIndicators, NO_SIGNALS } from "../metrics/report";
import type { RiskSignals } from "../metrics/risk";
import type { IndustryBenchmarkRow, CompanyReport } from "../domain/types";
import type { Repository, Benchmark } from "../store/repository";

export interface IngestDeps {
  krsClient: ReturnType<typeof createKrsClient>;
  repository: Repository;
}

export interface IngestService {
  ingestCompany(krs: string): Promise<IngestResult>;
  ingestBulletin(day: string): Promise<IngestResult>;
  ingestFinancials(krs: string, financials: FinancialInput, signals?: RiskSignals): Promise<void>;
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
      const krsList = await deps.krsClient.getBiuletyn(day);
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
    async ingestFinancials(krs: string, financials: FinancialInput, signals: RiskSignals = NO_SIGNALS): Promise<void> {
      const indicators = buildFullIndicators(financials, signals);
      await deps.repository.upsertIndicators(krs, financials.okresSprawozdawczy, indicators);
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
