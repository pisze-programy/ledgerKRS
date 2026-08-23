/**
 * Fiscal-year derivation from the pb.pl quarterly series. The quarterly table
 * shows cumulative values; the fourth-quarter value is the annual value.
 * Balance-sheet items are in thousands of PLN and are scaled to full PLN.
 */

import { PbplIndicator } from "./parse";

export interface AnnualValue {
  year: number;
  value: number;
}

/** Scale for an indicator name: "tys." means thousands, everything else is PLN. */
export function detectScale(indicatorName: string): number {
  return /tys/i.test(indicatorName) ? 1000 : 1;
}

/** Annual value per year: the fourth-quarter cumulative value of that year. */
export function annualValues(indicator: PbplIndicator): AnnualValue[] {
  const byYear = new Map<number, number>();
  for (const point of indicator.series) {
    if (point.quarter === 4 && point.value !== null) {
      byYear.set(point.year, point.value);
    }
  }
  return [...byYear.entries()]
    .map(([year, value]) => ({ year, value }))
    .sort((a, b) => a.year - b.year);
}

/** Scale a value by the indicator unit (e.g. thousands to full PLN). */
export function toFullValue(value: number | null, scale: number): number | null {
  return value === null ? null : value * scale;
}

/** Annual values converted to full units. */
export function annualFullValues(indicator: PbplIndicator, scale?: number): AnnualValue[] {
  const detected = scale ?? detectScale(indicator.name);
  return annualValues(indicator).map(({ year, value }) => ({ year, value: value * detected }));
}
