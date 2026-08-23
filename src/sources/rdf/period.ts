const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export interface PeriodBounds {
  from: Date | null;
  to: Date | null;
}

/** Split a "FROM_TO" okres string into ISO date parts. */
export function parsePeriod(okres: string | null | undefined): PeriodBounds {
  if (!okres) {
    return { from: null, to: null };
  }
  const [fromRaw, toRaw] = okres.split("_");
  return { from: parseIsoDate(fromRaw), to: parseIsoDate(toRaw) };
}

function parseIsoDate(raw: string | undefined): Date | null {
  if (!raw) {
    return null;
  }
  const match = raw.trim().match(ISO_DATE);
  if (!match) {
    return null;
  }
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

export function periodDays(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

/**
 * The calendar year a period belongs to. BizRaport labels a statement by the
 * year containing the bulk of its period — not the end date: a 12-month
 * Oct-Sep fiscal year (2017-10-01..2018-09-30) is reported as 2018, while a
 * 16-month transitional period (2020-01-01..2021-04-30) is reported as 2020.
 * The midpoint rule reproduces both (verified against BizRaport on
 * non-calendar and transitional periods). When only the end date parses we
 * fall back to its year (the previous behaviour).
 */
export function fiscalYearOf(okres: string | null | undefined): number | null {
  const { from, to } = parsePeriod(okres);
  if (from && to) {
    const mid = new Date(from.getTime() + (to.getTime() - from.getTime()) / 2);
    return mid.getUTCFullYear();
  }
  if (to) {
    return to.getUTCFullYear();
  }
  return null;
}

export type PeriodClass = "annual" | "transitional" | "partial";

/**
 * What kind of reporting period a statement covers. Used to pick the primary
 * annual statement when several candidates map to the same fiscal year.
 *  - annual:      a full ~12-month reporting period (345..385 days)
 *  - transitional: clearly longer than a year (fiscal-year change, e.g. 16m)
 *  - partial:     clearly shorter than a year (first/short year of a change)
 */
export function periodClassOf(okres: string | null | undefined): PeriodClass | null {
  const { from, to } = parsePeriod(okres);
  if (!from || !to) {
    return null;
  }
  const days = periodDays(from, to);
  if (days >= 345 && days <= 385) {
    return "annual";
  }
  return days > 385 ? "transitional" : "partial";
}
