import type { StatementHistoryEntry } from "../../domain/types";

/**
 * Statutory filing deadline for an annual statement: the balance-sheet date
 * plus 6 months (statement approval window) plus 15 days (KRS filing window,
 * art. 69 of the accounting act). Returns YYYY-MM-DD.
 */
export function terminZlozeniaFor(periodTo: string | null | undefined): string | null {
  if (!periodTo) {
    return null;
  }
  const match = periodTo.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month0 = Number(match[2]) - 1;
  const targetMonth0 = (month0 + 6) % 12;
  const targetYear = year + Math.floor((month0 + 6) / 12);
  const lastDay = new Date(Date.UTC(targetYear, targetMonth0 + 1, 0)).getUTCDate();
  const deadline = new Date(Date.UTC(targetYear, targetMonth0, lastDay));
  deadline.setUTCDate(deadline.getUTCDate() + 15);
  return deadline.toISOString().slice(0, 10);
}

/** Build a statement-history row from RDF document metadata + the reporting period. */
export function historyEntryFromMeta(
  meta: Record<string, unknown>,
  okres: string | null,
  rok: number | null,
): StatementHistoryEntry {
  const periodTo = okres?.split("_")[1] ?? null;
  const dataDodania = typeof meta.dataDodania === "string" ? meta.dataDodania : null;
  return {
    okresSprawozdawczy: okres,
    rok,
    terminZlozenia: terminZlozeniaFor(periodTo),
    dataDodaniaDoKrs: dataDodania,
  };
}
