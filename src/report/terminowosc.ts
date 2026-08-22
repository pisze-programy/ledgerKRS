import type { ReportContext, Terminowosc } from "./context";

export function terminowosc(ctx: ReportContext): Terminowosc {
  const entries = ctx.report.history;
  if (entries.length === 0) {
    return { razem: 0, w_terminie: 0, po_terminie: 0, srednie_opoznienie_dni: null };
  }
  let wTerminie = 0;
  let poTerminie = 0;
  let sumaOpoznien = 0;
  let liczone = 0;
  for (const entry of entries) {
    const termin = parseDate(entry.terminZlozenia);
    const dodane = parseDate(entry.dataDodaniaDoKrs);
    if (termin === null || dodane === null) {
      continue;
    }
    const opoznienie = daysBetween(termin, dodane);
    if (opoznienie <= 0) {
      wTerminie += 1;
    } else {
      poTerminie += 1;
    }
    sumaOpoznien += opoznienie;
    liczone += 1;
  }
  return {
    razem: entries.length,
    w_terminie: wTerminie,
    po_terminie: poTerminie,
    srednie_opoznienie_dni: liczone > 0 ? Math.round(sumaOpoznien / liczone) : null,
  };
}

function parseDate(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const ddmmyyyy = value.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!iso && !ddmmyyyy) {
    return null;
  }
  if (iso) {
    const timestamp = Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    return Number.isNaN(timestamp) ? null : timestamp;
  }
  const timestamp = Date.UTC(Number(ddmmyyyy![3]), Number(ddmmyyyy![2]) - 1, Number(ddmmyyyy![1]));
  return Number.isNaN(timestamp) ? null : timestamp;
}

function daysBetween(from: number, to: number): number {
  return Math.round((to - from) / 86400000);
}
