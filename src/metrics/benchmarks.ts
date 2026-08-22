import { BENCHMARK_INDICATORS, INDICATOR, type BenchmarkIndicator } from "../domain/vocab";
import type { IndustryBenchmarkRow } from "../domain/types";

export function percentile(values: number[], value: number): number | null {
  if (values.length === 0) {
    return null;
  }
  const below = values.filter((item) => item < value).length;
  return below / values.length;
}

export function marketShare(groupRevenue: number, companyRevenue: number): number | null {
  if (groupRevenue <= 0) {
    return null;
  }
  return companyRevenue / groupRevenue;
}

export type CompanyValues = Partial<Record<BenchmarkIndicator, number | null>>;

export function computeBenchmarkMatrix(
  company: CompanyValues,
  group: CompanyValues[],
  okres: string,
  rok: number | null,
): IndustryBenchmarkRow[] {
  const rows: IndustryBenchmarkRow[] = [];
  for (const indicator of BENCHMARK_INDICATORS) {
    const value = company[indicator];
    if (value === null || value === undefined || !Number.isFinite(value)) {
      continue;
    }
    const groupValues = group
      .map((entry) => entry[indicator])
      .filter((entry): entry is number => entry !== null && entry !== undefined && Number.isFinite(entry));
    const percentyl = percentile(groupValues, value);
    if (percentyl === null) {
      continue;
    }
    const row: IndustryBenchmarkRow = {
      okresSprawozdawczy: okres,
      rok,
      nazwaWskaznika: indicator,
      percentylWPkd: percentyl,
    };
    if (indicator === INDICATOR.Przychody) {
      const groupRevenue = groupValues.reduce((sum, entry) => sum + entry, 0);
      const firms = groupValues.length;
      const share = marketShare(groupRevenue, value);
      if (share !== null) {
        row.udzialWRynku = share;
        row.przychodyCalejBranzy = groupRevenue;
        row.liczbaFirmWBranzy = firms;
      }
    }
    rows.push(row);
  }
  return rows;
}
