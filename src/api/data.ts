import { Hono } from "hono";
import { withKey, chargeOne, refForPath } from "./middleware";
import { catalogFor, reportFor, searchFor, ServiceError, statementsFor } from "./services";
import type { ApiDeps, AppEnv } from "./deps";

export function createDataRoutes(deps: ApiDeps): Hono<AppEnv> {
  const paid = new Hono<AppEnv>();
  paid.use(withKey(deps.billing));
  paid.use(chargeOne(deps.billing, refForPath));

  paid.get("/dane", async (c) => {
    const krs = c.req.query("krs");
    const nip = c.req.query("nip");
    if (!krs && !nip) {
      return c.json({ error: "podaj krs albo nip" }, 400);
    }
    const report = await reportFor(deps, krs, nip);
    return c.json({ data: report ? [report] : [] });
  });

  paid.get("/sprawozdania", async (c) => {
    const krs = c.req.query("krs");
    if (!krs) {
      return c.json({ error: "podaj krs" }, 400);
    }
    const statement = await statementsFor(deps, krs);
    return c.json({ data: statement ? [statement] : [] });
  });

  paid.get("/katalog", async (c) => {
    const params = new URLSearchParams(c.req.query());
    const limit = clamp(Number(params.get("limit") ?? 100), 1, 1000);
    const offset = Math.max(0, Number(params.get("offset") ?? 0));
    try {
      const result = await catalogFor(deps, params, params.get("sort") ?? "aktywa", params.get("order") ?? "desc", limit, offset);
      return c.json({ ...result });
    } catch (error) {
      if (error instanceof ServiceError) {
        return c.json({ error: error.message }, 400);
      }
      throw error;
    }
  });

  paid.get("/szukaj", async (c) => {
    const q = c.req.query("q");
    if (!q || q.trim().length === 0) {
      return c.json({ error: "podaj q" }, 400);
    }
    const result = await searchFor(deps, q);
    return c.json({ data: result.data, dane_uciete: result.daneUciete });
  });

  return paid;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
