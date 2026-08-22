import { Hono } from "hono";
import { withKey, chargeOne, refForPath } from "./middleware";
import { branchesTree, pkdReport } from "./services";
import type { ApiDeps, AppEnv } from "./deps";

export function createBranchRoutes(deps: ApiDeps): Hono<AppEnv> {
  const paid = new Hono<AppEnv>();
  paid.use(withKey(deps.billing));
  paid.use(chargeOne(deps.billing, refForPath));

  paid.get("/branze", async (c) => {
    return c.json({ data: await branchesTree(deps) });
  });

  paid.get("/pkd/:code", async (c) => {
    const code = c.req.param("code").toUpperCase();
    const rokRaw = Number(c.req.query("rok"));
    const rok = Number.isFinite(rokRaw) ? rokRaw : undefined;
    const report = await pkdReport(deps, code, rok);
    if (!report) {
      return c.json({ error: "nie znaleziono branży" }, 404);
    }
    return c.json({ data: [report] });
  });

  return paid;
}
