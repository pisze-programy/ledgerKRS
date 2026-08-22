import type { Company, CompanyReport } from "../domain/types";

export interface Indicator {
  nazwa_wskaznika: string;
  kwota: number;
}

export interface Benchmark {
  pkd: string;
  rok: number;
  nazwa_wskaznika: string;
  percentyl: number;
  liczba_firm: number;
  udzial_w_rynku?: number | null;
  przychody_branzy?: number | null;
}

export interface Repository {
  upsertCompany(report: CompanyReport): Promise<void>;
  upsertConnections(krs: string, connections: CompanyReport["connections"]): Promise<void>;
  upsertOwnership(krs: string, ownership: CompanyReport["ownership"]): Promise<void>;
  upsertPkd(krs: string, codes: CompanyReport["pkdCodes"]): Promise<void>;
  upsertStatement(krs: string, statement: CompanyReport["statements"][number]): Promise<number>;
  upsertPositions(statementId: number, positions: unknown[]): Promise<void>;
  upsertIndicators(krs: string, okres: string | null, indicators: Indicator[]): Promise<void>;
  upsertBenchmarks(pkd: string, rok: number, benchmarks: Benchmark[]): Promise<void>;
  upsertMonitor(krs: string, entries: CompanyReport["monitor"]): Promise<void>;
  upsertKrz(krs: string, entries: CompanyReport["krz"]): Promise<void>;
  upsertHistory(krs: string, entries: CompanyReport["history"]): Promise<void>;
  upsertDescriptions(krs: string, entries: CompanyReport["descriptions"]): Promise<void>;
  upsertCompanyBenchmarks(krs: string, entries: CompanyReport["benchmarks"]): Promise<void>;
  readIndicators(krs: string): Promise<Indicator[]>;
  readIndicatorsByYear(krs: string): Promise<CompanyReport["financials"]>;
  getDescriptions(krs: string): Promise<CompanyReport["descriptions"]>;
  getCompanyBenchmarks(krs: string): Promise<CompanyReport["benchmarks"]>;
  getCompany(krs: string): Promise<Company | null>;
  getReport(krs: string): Promise<CompanyReport | null>;
  getStatementPositions(krs: string): Promise<StatementPosition[]>;
  listCompanies(limit: number, offset: number): Promise<Company[]>;
  setIngestState(lastBulletinDay: string): Promise<void>;
  getIngestState(): Promise<string | null>;
}

export interface StatementPosition {
  okresSprawozdawczy: string;
  sekcja: string;
  kod_pozycji: string;
  poziom_zaglebienia: number | null;
  nazwa_pozycji: string | null;
  kwota: number | null;
}
