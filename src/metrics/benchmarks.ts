import type { IndustryBenchmarkRow } from "../domain/types";
import { BENCHMARK_INDICATORS, type BenchmarkIndicator } from "../domain/vocab";

export interface BenchmarkFirm {
  krs: string;
  pkd: string;
  okres: string | null;
  rok: number;
  values: Partial<Record<BenchmarkIndicator, number>>;
}

/** Fraction of the sorted distribution that is <= value (0..1). */
export function percentileOf(sortedAsc: number[], value: number): number {
  if (sortedAsc.length === 0) {
    return 0;
  }
  let below = 0;
  for (const v of sortedAsc) {
    if (v <= value) {
      below += 1;
    }
  }
  return below / sortedAsc.length;
}

/**
 * Compute each firm's percentile per benchmark indicator within its PKD+year
 * peer group (BizRaport's "pozycja na tle branży"). Returns rows grouped by
 * firm KRS.
 */
export function computeCompanyPercentiles(firms: BenchmarkFirm[]): Map<string, IndustryBenchmarkRow[]> {
  const byFirm = new Map<string, IndustryBenchmarkRow[]>();
  const groups = new Map<string, BenchmarkFirm[]>();
  for (const firm of firms) {
    const key = `${firm.pkd}|${firm.rok}`;
    const list = groups.get(key) ?? [];
    list.push(firm);
    groups.set(key, list);
  }
  for (const group of groups.values()) {
    const count = group.length;
    for (const indicator of BENCHMARK_INDICATORS) {
      const peers = group
        .map((f) => f.values[indicator])
        .filter((v): v is number => typeof v === "number");
      if (peers.length === 0) {
        continue;
      }
      const sorted = [...peers].sort((a, b) => a - b);
      for (const firm of group) {
        const value = firm.values[indicator];
        if (typeof value !== "number") {
          continue;
        }
        const row: IndustryBenchmarkRow = {
          okresSprawozdawczy: firm.okres,
          rok: firm.rok,
          nazwaWskaznika: indicator,
          percentylWPkd: percentileOf(sorted, value),
          liczbaFirmWBranzy: count,
        };
        const list = byFirm.get(firm.krs) ?? [];
        list.push(row);
        byFirm.set(firm.krs, list);
      }
    }
  }
  return byFirm;
}
