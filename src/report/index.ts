import type { ApiDeps } from "../api/deps";
import type { EnrichedReport } from "./context";
import { kodPkd, opisPkd, summary } from "./base";
import { financials } from "./financials";
import { terminowosc } from "./terminowosc";
import { derivedConnections } from "./connections";
import { similarOrganizations } from "./podobne";

export type { EnrichedReport } from "./context";

export async function buildCompanyReport(deps: ApiDeps, krs: string): Promise<EnrichedReport | null> {
  const report = await deps.repository.getReport(krs);
  if (!report) {
    return null;
  }
  const ctx = { deps, krs, report };
  const [podobne, derived] = await Promise.all([similarOrganizations(ctx), derivedConnections(ctx)]);
  return {
    krs: report.company.krs,
    nip: report.company.nip ?? null,
    regon: report.company.regon ?? null,
    kod_pkd: kodPkd(ctx),
    opis_pkd: opisPkd(ctx),
    informacje_o_firmie: report.company,
    summary: summary(ctx),
    finansowe: financials(ctx),
    monitor: report.monitor,
    krz: report.krz,
    historia_sprawozdan: report.history,
    terminowosc: terminowosc(ctx),
    pozycja_na_tle_branzy: report.benchmarks,
    opisy_firmy: report.descriptions,
    powiazania: report.connections,
    powiazania_pochodne: derived,
    udzialowcy: report.ownership,
    podobne_organizacje: podobne,
  };
}
