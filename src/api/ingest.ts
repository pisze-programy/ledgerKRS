import { Hono } from "hono";
import type { ApiDeps } from "./deps";
import { catalogRowFromReport } from "../seed/bizraport";
import { computeBranchStats } from "../metrics/branch";
import { sectionLetterOf, divisionOf } from "../sources/pkd/taxonomy";
import type { BranchStat, CatalogRow } from "../store/catalog";

/** The three PKD levels a branch report can be requested at. */
function pkdKeys(podklasa: string): string[] {
  const keys = [podklasa];
  const dzial = divisionOf(podklasa);
  const sekcja = sectionLetterOf(podklasa);
  if (dzial) {
    keys.push(dzial);
  }
  if (sekcja) {
    keys.push(sekcja);
  }
  return keys;
}

export function createIngestRoutes(deps: ApiDeps): Hono {
  const app = new Hono();

  // Recompute per-(pkd, year) branch statistics from company financials so the
  // /api/pkd report has multi-year series and growth (CAGR). Stats are stored
  // for every PKD level (sekcja / dział / podklasa). Idempotent.
  app.post("/ingest/branch-stats", async (c) => {
    const byBranch = new Map<string, Map<number, CatalogRow[]>>();
    let companies = 0;
    for (let offset = 0; offset < 10000; offset += 1000) {
      const list = await deps.repository.listCompanies(1000, offset);
      if (list.length === 0) {
        break;
      }
      for (const company of list) {
        const report = await deps.repository.getReport(company.krs);
        if (!report) {
          continue;
        }
        const podklasa = report.pkdCodes[0]?.code;
        if (!podklasa) {
          continue;
        }
        const keys = pkdKeys(podklasa);
        for (const year of report.financials ?? []) {
          const rok = year.rok ?? 0;
          if (rok <= 0) {
            continue;
          }
          const byName = new Map(year.indicators?.map((i) => [i.nazwa_wskaznika, i.kwota]));
          const base: CatalogRow = {
            krs: company.krs,
            name: company.name ?? null,
            nip: company.nip ?? null,
            regon: company.regon ?? null,
            legalForm: company.legalForm ?? null,
            street: null,
            city: company.address?.city ?? null,
            voivodeship: company.address?.voivodeship ?? null,
            postalCode: null,
            website: null,
            email: null,
            pkdSekcja: null,
            pkdDzial: null,
            pkdPodklasa: podklasa,
            pkdOpis: null,
            nieWykreslona: true,
            czyStatusOpp: false,
            citEstonski: false,
            ostatniKrz: 0,
            ostatniMonitor: 0,
            rok,
            przychody: byName.get("przychody") ?? null,
            zyskNetto: byName.get("zysk_netto") ?? null,
            sumaBilansowa: byName.get("suma_bilansowa") ?? null,
            estymowanaWartoscFirmy: byName.get("wartosc_firmy_srednia") ?? null,
          };
          for (const key of keys) {
            const years = byBranch.get(key) ?? new Map<number, CatalogRow[]>();
            const rows = years.get(rok) ?? [];
            rows.push(base);
            years.set(rok, rows);
            byBranch.set(key, years);
          }
        }
      }
      companies += list.length;
      if (list.length < 1000) {
        break;
      }
    }
    let processed = 0;
    for (const [pkd, years] of byBranch) {
      for (const [rok, rows] of years) {
        const { stat } = computeBranchStats(pkd, rok, rows);
        await deps.catalog.upsertBranchStats([stat]);
        processed += 1;
      }
    }
    return c.json({ companies, branchYears: processed });
  });

  // Rebuild the search catalog (catalog_rows) from the companies + financials
  // already in the database. Idempotent (upsert by krs).
  app.post("/ingest/catalog", async (c) => {
    let processed = 0;
    let failed = 0;
    const limit = 10000;
    for (let offset = 0; offset < limit; offset += 1000) {
      const companies = await deps.repository.listCompanies(1000, offset);
      if (companies.length === 0) {
        break;
      }
      for (const company of companies) {
        const report = await deps.repository.getReport(company.krs);
        if (!report) {
          failed += 1;
          continue;
        }
        await deps.catalog.upsertCatalogRows([catalogRowFromReport(report)]);
        processed += 1;
      }
      if (companies.length < 1000) {
        break;
      }
    }
    return c.json({ processed, failed });
  });

  app.get("/companies", async (c) => {
    const limit = Number(c.req.query("limit") ?? 100);
    const offset = Number(c.req.query("offset") ?? 0);
    return c.json({ companies: await deps.repository.listCompanies(limit, offset) });
  });

  app.get("/companies/:krs", async (c) => {
    const company = await deps.repository.getCompany(c.req.param("krs"));
    if (!company) {
      return c.json({ error: "not found" }, 404);
    }
    return c.json({ company });
  });

  app.get("/companies/:krs/financials", async (c) => {
    const krs = c.req.param("krs");
    return c.json({ indicators: await deps.repository.readIndicators(krs) });
  });

  app.post("/ingest/krs/:krs", async (c) => {
    return c.json(await deps.ingest.ingestCompany(c.req.param("krs")));
  });

  app.post("/ingest/krs/:krs/financials", async (c) => {
    const financials = await c.req.json();
    await deps.ingest.ingestFinancials(c.req.param("krs"), financials);
    return c.json({ ok: true });
  });

  app.post("/ingest/krs/:krs/rdf", async (c) => {
    return c.json(await deps.ingest.ingestRdfFinancials(c.req.param("krs")));
  });

  app.post("/ingest/krs/:krs/history", async (c) => {
    const body = await c.req.json();
    await deps.repository.upsertHistory(c.req.param("krs"), body);
    return c.json({ ok: true });
  });

  app.post("/ingest/krs/:krs/positions", async (c) => {
    const { okres, positions } = (await c.req.json()) as { okres?: string; positions: unknown[] };
    const statementId = await deps.repository.upsertStatement(c.req.param("krs"), {
      periodFrom: okres?.split("_")[0] || undefined,
      periodTo: okres?.split("_")[1] || undefined,
      filedAt: null,
    });
    if (statementId) {
      await deps.repository.upsertPositions(statementId, positions);
    }
    return c.json({ ok: true, statementId });
  });

  app.post("/ingest/krs/:krs/monitor", async (c) => {
    return c.json(await deps.ingest.ingestMonitor(c.req.param("krs")));
  });

  app.post("/ingest/krs/:krs/persons", async (c) => {
    return c.json(await deps.ingest.ingestPersons(c.req.param("krs")));
  });

  app.post("/ingest/krs/:krs/derived", async (c) => {
    return c.json(await deps.ingest.ingestDerived(c.req.param("krs")));
  });

  app.post("/ingest/benchmarks", async (c) => {
    return c.json(await deps.ingest.computeBenchmarks());
  });

  app.post("/ingest/krs/:krs/benchmarks", async (c) => {
    const body = await c.req.json();
    await deps.ingest.ingestBenchmarks(body.pkd, body.rows);
    return c.json({ ok: true });
  });

  app.post("/ingest/krs/:krs/announcements", async (c) => {
    const report = await c.req.json();
    await deps.ingest.ingestAnnouncements(c.req.param("krs"), report);
    return c.json({ ok: true });
  });

  app.post("/ingest/bulletin/:day", async (c) => {
    return c.json(await deps.ingest.ingestBulletin(c.req.param("day")));
  });

  return app;
}
