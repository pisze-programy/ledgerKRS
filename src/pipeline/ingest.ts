import { parseOdpis } from "../sources/krs/parser";
import { createKrsClient } from "../sources/krs/client";
import { createRdfClient, isXmlCapable } from "../sources/rdf/client";
import { parseSprawozdanie } from "../sources/rdf/parser";
import { statementMeta } from "../sources/rdf/layouts";
import { extractFinancialInput } from "../sources/rdf/indicators";
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
      // Prefer the consolidated group statement (rodzaj 22) when present for a
      // period — BizRaport reports consolidated figures for capital groups.
      const byPeriod = new Map<string, typeof annual[number]>();
      for (const hit of annual) {
        const key = hit.okresSprawozdawczyKoniec ?? hit.id;
        const current = byPeriod.get(key);
        if (!current || (hit.rodzaj === "22" && current.rodzaj !== "22")) {
          byPeriod.set(key, hit);
        }
      }
      let processed = 0;
      let failed = 0;
      for (const hit of byPeriod.values()) {
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
        const year = extractFinancialInput(statement, statementMeta(xml));
        if (!year) {
          failed += 1;
          continue;
        }
        const okres =
          year.okresSprawozdawczy ||
          (hit.okresSprawozdawczyPoczatek && hit.okresSprawozdawczyKoniec
            ? `${hit.okresSprawozdawczyPoczatek}_${hit.okresSprawozdawczyKoniec}`
            : null);
        await this.ingestFinancials(krs, { ...(year.input as FinancialInput), okresSprawozdawczy: okres ?? year.okresSprawozdawczy });
        processed += 1;
      }
      return { processed, failed };
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
