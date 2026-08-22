import type { BranchStat } from "../store/catalog";
import type { CatalogRow } from "../store/catalog";

export function quantile(values: number[], q: number): number | null {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * q;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) {
    return sorted[lower]!;
  }
  const weight = index - lower;
  return sorted[lower]! * (1 - weight) + sorted[upper]! * weight;
}

export function cagr(start: number, end: number, years: number): number | null {
  if (start <= 0 || end <= 0 || years <= 0) {
    return null;
  }
  return Math.pow(end / start, 1 / years) - 1;
}

export interface BranchComputeResult {
  stat: BranchStat;
  top: CatalogRow[];
  geo: Record<string, number>;
}

export function computeBranchStats(pkd: string, rok: number, rows: CatalogRow[]): BranchComputeResult {
  const withRevenue = rows.filter((row) => row.przychody !== null && row.przychody !== undefined);
  const revenues = withRevenue.map((row) => row.przychody as number);
  const profits = rows.map((row) => row.zyskNetto).filter((value): value is number => value !== null && value !== undefined);
  const valuations = rows
    .map((row) => row.estymowanaWartoscFirmy)
    .filter((value): value is number => value !== null && value !== undefined);
  const total = revenues.reduce((sum, value) => sum + value, 0);
  const top = [...withRevenue].sort((a, b) => (b.przychody ?? 0) - (a.przychody ?? 0)).slice(0, 50);
  const geo: Record<string, number> = {};
  for (const row of rows) {
    const voivodeship = row.voivodeship ?? "INNE";
    geo[voivodeship] = (geo[voivodeship] ?? 0) + 1;
  }
  const stat: BranchStat = {
    pkd,
    rok,
    count: rows.length,
    totalPrzychody: total || null,
    avgPrzychod: revenues.length > 0 ? total / revenues.length : null,
    avgZysk: profits.length > 0 ? profits.reduce((sum, value) => sum + value, 0) / profits.length : null,
    p10Przychody: quantile(revenues, 0.9),
    p20Przychody: quantile(revenues, 0.8),
    p50Przychody: quantile(revenues, 0.5),
    p90Przychody: quantile(revenues, 0.1),
    p10Zysk: quantile(profits, 0.9),
    p20Zysk: quantile(profits, 0.8),
    p50Zysk: quantile(profits, 0.5),
    p90Zysk: quantile(profits, 0.1),
    p10Wartosc: quantile(valuations, 0.9),
    p20Wartosc: quantile(valuations, 0.8),
    p50Wartosc: quantile(valuations, 0.5),
    p90Wartosc: quantile(valuations, 0.1),
  };
  return { stat, top, geo };
}

export interface BranchGrowth {
  countGrowthPerYear: number | null;
  revenueGrowthPerYear: number | null;
  cagr: number | null;
}

export function computeGrowth(stats: BranchStat[]): BranchGrowth {
  if (stats.length < 2) {
    return { countGrowthPerYear: null, revenueGrowthPerYear: null, cagr: null };
  }
  const sorted = [...stats].sort((a, b) => a.rok - b.rok);
  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;
  const years = last.rok - first.rok;
  const countGrowth = years > 0 ? (last.count - first.count) / years : null;
  const revenueGrowth =
    first.totalPrzychody !== null && last.totalPrzychody !== null && years > 0
      ? (last.totalPrzychody - first.totalPrzychody) / years
      : null;
  return {
    countGrowthPerYear: countGrowth,
    revenueGrowthPerYear: revenueGrowth,
    cagr: cagr(first.totalPrzychody ?? 0, last.totalPrzychody ?? 0, years),
  };
}
