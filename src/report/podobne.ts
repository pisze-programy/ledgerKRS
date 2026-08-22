import { buildCatalogQuery } from "../search/catalog-build";
import type { ReportContext, SimilarOrganization } from "./context";

export async function similarOrganizations(ctx: ReportContext): Promise<SimilarOrganization[]> {
  const mainPkd = ctx.report.pkdCodes[0];
  if (!mainPkd) {
    return [];
  }
  const pkd = mainPkd.code;
  const filter = /^\d{2}\.\d{2}\.[A-Z]$/.test(pkd) ? { pkdPodklasa: pkd } : /^\d{2}\.\d$/.test(pkd) ? { pkdDzial: pkd } : { pkdSekcja: pkd };
  const query = buildCatalogQuery(filter, "przychody", "desc", 12, 0);
  const result = await ctx.deps.catalog.searchCatalog(query);
  return result.rows
    .filter((row) => row.krs !== ctx.krs)
    .slice(0, 10)
    .map((row) => ({
      krs: row.krs,
      name: row.name,
      pkd_podklasa: row.pkdPodklasa,
      przychody: row.przychody ?? null,
      zysk_netto: row.zyskNetto ?? null,
    }));
}
