import { buildSearchQuery } from "../search/fulltext";
import { CONNECTION } from "../domain/vocab";
import type { CompanyReport } from "../domain/types";
import type { ReportContext } from "./context";
import { wspolneOsoby, type WspolnaOsoba } from "./osoby";

export interface DerivedConnections {
  identyczny_nip: { krs: string; name: string | null }[];
  identyczny_regon: { krs: string; name: string | null }[];
  zwrotne: { krs: string; name: string | null; typ: string }[];
  wspolne_osoby: WspolnaOsoba[];
}

export function connections(ctx: ReportContext): CompanyReport["connections"] {
  return ctx.report.connections;
}

export async function derivedConnections(ctx: ReportContext): Promise<DerivedConnections> {
  const company = ctx.report.company;
  const sameNip = company.nip ? await findByValue(ctx, company.nip) : [];
  const sameRegon = company.regon ? await findByValue(ctx, company.regon) : [];
  const zwrotne = await findZwrotne(ctx);
  const osoby = await wspolneOsoby(ctx);
  return { identyczny_nip: sameNip, identyczny_regon: sameRegon, zwrotne, wspolne_osoby: osoby };
}

async function findByValue(ctx: ReportContext, value: string): Promise<{ krs: string; name: string | null }[]> {
  const query = buildSearchQuery(value, 20);
  const result = await ctx.deps.catalog.searchFulltext(query);
  return result.rows
    .filter((row) => row.krs !== ctx.krs)
    .map((row) => ({ krs: row.krs, name: row.name }));
}

async function findZwrotne(ctx: ReportContext): Promise<{ krs: string; name: string | null; typ: string }[]> {
  const orgOwners = ctx.report.ownership.filter((share) => share.idPodmiotu && share.idPodmiotu !== ctx.krs);
  const result: { krs: string; name: string | null; typ: string }[] = [];
  for (const share of orgOwners.slice(0, 5)) {
    const ownerKrs = share.idPodmiotu!;
    const ownerReport = await ctx.deps.repository.getReport(ownerKrs);
    if (!ownerReport) {
      continue;
    }
    const backLink = ownerReport.connections.some((conn) => conn.idPodmiotu === ctx.krs);
    if (backLink) {
      result.push({ krs: ownerKrs, name: share.nazwa ?? null, typ: CONNECTION.PowiazanieZwrotne });
    }
  }
  return result;
}
