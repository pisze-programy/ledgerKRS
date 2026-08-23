import { fiscalYearOf, periodClassOf, parsePeriod, periodDays, type PeriodClass } from "./period";

/**
 * A single annual (rodzaj 18/22) RDF document considered for the report,
 * carrying everything needed to decide which filing wins a fiscal year.
 */
export interface AnnualCandidate {
  id: string;
  rodzaj: string;
  /** Actual reporting period "FROM_TO" (from the statement XML when present). */
  okres: string | null;
  /** RDF publication date (ISO YYYY-MM-DD) — corrections supersede earlier filings. */
  dataDodania: string | null;
}

export interface SelectedYear {
  rok: number;
  okres: string;
  candidate: AnnualCandidate;
  /** Human-readable record of why this document won its fiscal year. */
  reason: string;
}

const CLASS_PRIORITY: Record<PeriodClass, number> = {
  annual: 0,
  transitional: 1,
  partial: 2,
};

function classPriority(candidate: AnnualCandidate): number {
  const periodClass = periodClassOf(candidate.okres);
  return periodClass === null ? 99 : CLASS_PRIORITY[periodClass];
}

/** Within the same class the longer period wins — the dominant part of a
 *  split fiscal year (BizRaport reports the main period, not the short
 *  opening one, e.g. 0000802552 2021: 2021-02-26..12-31 over 01-01..02-25). */
function durationPriority(candidate: AnnualCandidate): number {
  const { from, to } = parsePeriod(candidate.okres);
  if (!from || !to) {
    return 0;
  }
  return periodDays(from, to);
}

function consolidatedPriority(rodzaj: string): number {
  // BizRaport reports the consolidated capital-group statement (rodzaj 22)
  // when a company files both standalone and consolidated figures.
  return rodzaj === "22" ? 0 : 1;
}

function filingPriority(candidate: AnnualCandidate): string {
  return candidate.dataDodania ?? "";
}

/**
 * Pick the primary annual statement per fiscal year. BizRaport reports exactly
 * one row per year, so when several documents land on the same fiscal year we
 * keep a single winner. The priority is deliberately explicit and orderable:
 *   1. consolidated (22) over standalone (18),
 *   2. a genuine ~12-month annual period over transitional/partial filings,
 *   3. the latest filing (a later statement supersedes an earlier one),
 *   4. document id as a deterministic tiebreak.
 */
export function selectAnnualYears(candidates: AnnualCandidate[]): SelectedYear[] {
  const byYear = new Map<number, AnnualCandidate[]>();
  for (const candidate of candidates) {
    const rok = fiscalYearOf(candidate.okres);
    if (rok === null) {
      continue;
    }
    const list = byYear.get(rok) ?? [];
    list.push(candidate);
    byYear.set(rok, list);
  }
  const winners: SelectedYear[] = [];
  for (const [rok, list] of [...byYear.entries()].sort((a, b) => a[0] - b[0])) {
    const sorted = [...list].sort((a, b) => {
      const byConsolidated = consolidatedPriority(a.rodzaj) - consolidatedPriority(b.rodzaj);
      if (byConsolidated !== 0) {
        return byConsolidated;
      }
      const byClass = classPriority(a) - classPriority(b);
      if (byClass !== 0) {
        return byClass;
      }
      const byDuration = durationPriority(b) - durationPriority(a);
      if (byDuration !== 0) {
        return byDuration;
      }
      const byFiling = filingPriority(b).localeCompare(filingPriority(a));
      if (byFiling !== 0) {
        return byFiling;
      }
      return a.id.localeCompare(b.id);
    });
    const winner = sorted[0]!;
    const reasons: string[] = [];
    if (sorted.length > 1) {
      if (winner.rodzaj === "22" && sorted.some((c) => c.rodzaj === "18")) {
        reasons.push("consolidated(22)>standalone(18)");
      }
      if (periodClassOf(winner.okres) !== periodClassOf(sorted[1]!.okres)) {
        reasons.push(`${periodClassOf(winner.okres) ?? "unknown"}>${periodClassOf(sorted[1]!.okres) ?? "unknown"}`);
      }
      if (durationPriority(winner) !== durationPriority(sorted[1]!)) {
        reasons.push("longer-period");
      }
      if (filingPriority(winner) !== filingPriority(sorted[1]!)) {
        reasons.push("latest-filing");
      }
    }
    winners.push({
      rok,
      okres: winner.okres ?? "",
      candidate: winner,
      reason: reasons.length > 0 ? reasons.join(" ") : "only-filing",
    });
  }
  return winners;
}
