import { Hono } from "hono";
import type { ApiDeps } from "./deps";

export function createIngestRoutes(deps: ApiDeps): Hono {
  const app = new Hono();

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
