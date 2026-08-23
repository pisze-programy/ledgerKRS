import type { Company, CompanyReport } from "../../src/domain/types";
import type { Indicator, Benchmark, Repository, StatementPosition, PersonConnectionRow } from "../../src/store/repository";
import { personKey } from "../../src/domain/person";

export interface MemorySnapshot {
  monitor(krs: string): CompanyReport["monitor"];
  krz(krs: string): CompanyReport["krz"];
  history(krs: string): CompanyReport["history"];
}

export function createMemoryRepository(): Repository & MemorySnapshot {
  const companies = new Map<string, Company>();
  const connections = new Map<string, CompanyReport["connections"]>();
  const ownership = new Map<string, CompanyReport["ownership"]>();
  const pkd = new Map<string, CompanyReport["pkdCodes"]>();
  const statements = new Map<string, number>();
  const positions = new Map<number, unknown[]>();
  const indicators = new Map<string, Map<string, Indicator[]>>();
  const benchmarks = new Map<string, Benchmark[]>();
  const monitor = new Map<string, CompanyReport["monitor"]>();
  const krz = new Map<string, CompanyReport["krz"]>();
  const history = new Map<string, CompanyReport["history"]>();
  const descriptions = new Map<string, CompanyReport["descriptions"]>();
  const companyBenchmarks = new Map<string, CompanyReport["benchmarks"]>();
  let ingestState: string | null = null;

  const repository: Repository = {
    async upsertCompany(report: CompanyReport): Promise<void> {
      companies.set(report.company.krs, report.company);
      connections.set(report.company.krs, report.connections);
      ownership.set(report.company.krs, report.ownership);
      pkd.set(report.company.krs, report.pkdCodes);
    },
    async upsertConnections(krs: string, value: CompanyReport["connections"]): Promise<void> {
      connections.set(krs, value);
    },
    async upsertOwnership(krs: string, value: CompanyReport["ownership"]): Promise<void> {
      ownership.set(krs, value);
    },
    async upsertPkd(krs: string, value: CompanyReport["pkdCodes"]): Promise<void> {
      pkd.set(krs, value);
    },
    async upsertStatement(krs: string, _statement: CompanyReport["statements"][number]): Promise<number> {
      const id = statements.size + 1;
      statements.set(krs, id);
      return id;
    },
    async upsertPositions(statementId: number, value: unknown[]): Promise<void> {
      positions.set(statementId, value);
    },
    async upsertIndicators(krs: string, okres: string | null, value: Indicator[]): Promise<void> {
      const byOkres = indicators.get(krs) ?? new Map<string, Indicator[]>();
      byOkres.set(okres ?? "", value);
      indicators.set(krs, byOkres);
    },
    async readIndicatorsByYear(krs: string): Promise<CompanyReport["financials"]> {
      const byOkres = indicators.get(krs) ?? new Map<string, Indicator[]>();
      return [...byOkres.entries()].map(([okresSprawozdawczy, items]) => ({
        okresSprawozdawczy,
        rok: null,
        indicators: items.map((item) => ({
          nazwa_wskaznika: item.nazwa_wskaznika as CompanyReport["financials"][number]["indicators"][number]["nazwa_wskaznika"],
          kwota: item.kwota,
        })),
      }));
    },
    async upsertBenchmarks(pkd: string, _rok: number, value: Benchmark[]): Promise<void> {
      benchmarks.set(pkd, value);
    },
    async upsertMonitor(krs: string, value: CompanyReport["monitor"]): Promise<void> {
      monitor.set(krs, value);
    },
    async upsertKrz(krs: string, value: CompanyReport["krz"]): Promise<void> {
      krz.set(krs, value);
    },
    async upsertHistory(krs: string, value: CompanyReport["history"]): Promise<void> {
      history.set(krs, value);
    },
    async upsertDescriptions(krs: string, value: CompanyReport["descriptions"]): Promise<void> {
      descriptions.set(krs, value);
    },
    async upsertCompanyBenchmarks(krs: string, value: CompanyReport["benchmarks"]): Promise<void> {
      companyBenchmarks.set(krs, value);
    },
    async getDescriptions(krs: string): Promise<CompanyReport["descriptions"]> {
      return descriptions.get(krs) ?? [];
    },
    async getCompanyBenchmarks(krs: string): Promise<CompanyReport["benchmarks"]> {
      return companyBenchmarks.get(krs) ?? [];
    },
    async readIndicators(krs: string): Promise<Indicator[]> {
      const byOkres = indicators.get(krs) ?? new Map<string, Indicator[]>();
      return [...byOkres.values()].flat();
    },
    async getCompany(krs: string): Promise<Company | null> {
      return companies.get(krs) ?? null;
    },
    async getReport(krs: string): Promise<CompanyReport | null> {
      const company = companies.get(krs);
      if (!company) {
        return null;
      }
      const indicatorList = [...(indicators.get(krs) ?? new Map<string, Indicator[]>()).values()].flat();
      const reportIndicators: CompanyReport["financials"][number]["indicators"] = indicatorList.map((item) => ({
        nazwa_wskaznika: item.nazwa_wskaznika as CompanyReport["financials"][number]["indicators"][number]["nazwa_wskaznika"],
        kwota: item.kwota,
      }));
      return {
        company,
        connections: connections.get(krs) ?? [],
        ownership: ownership.get(krs) ?? [],
        pkdCodes: pkd.get(krs) ?? [],
        statements: [],
        financials: [{ okresSprawozdawczy: "", rok: null, indicators: reportIndicators }],
        monitor: monitor.get(krs) ?? [],
        krz: krz.get(krs) ?? [],
        history: history.get(krs) ?? [],
        descriptions: descriptions.get(krs) ?? [],
        benchmarks: companyBenchmarks.get(krs) ?? [],
      };
    },
    async getStatementPositions(krs: string): Promise<StatementPosition[]> {
      const id = statements.get(krs);
      if (id === undefined) {
        return [];
      }
      const rows = positions.get(id) ?? [];
      return rows as StatementPosition[];
    },
    async findConnectionsByPerson(normName: string): Promise<PersonConnectionRow[]> {
      const rows: PersonConnectionRow[] = [];
      for (const [krs, list] of connections) {
        for (const conn of list) {
          if (personKey(conn.nazwa) === normName && conn.idPodmiotu === undefined) {
            rows.push({ krs, nazwa: conn.nazwa ?? "", funkcja: conn.funkcja ?? null, typ: conn.typPowiazania });
          }
        }
      }
      return rows;
    },
    async listCompanies(limit: number, offset: number): Promise<Company[]> {
      return [...companies.values()].sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "")).slice(offset, offset + limit);
    },
    async setIngestState(day: string): Promise<void> {
      ingestState = day;
    },
    async getIngestState(): Promise<string | null> {
      return ingestState;
    },
  };

  const snapshot: MemorySnapshot = {
    monitor: (krs: string) => monitor.get(krs) ?? [],
    krz: (krs: string) => krz.get(krs) ?? [],
    history: (krs: string) => history.get(krs) ?? [],
  };

  return Object.assign(repository, snapshot);
}
