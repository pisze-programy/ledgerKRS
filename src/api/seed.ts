import { Hono } from "hono";
import { seedEverything } from "../seed/seed";
import { seedBizraport } from "../seed/bizraport";
import type { ApiDeps } from "./deps";

export function createSeedRoutes(deps: ApiDeps): Hono {
  const app = new Hono();

  app.post("/seed", async (c) => {
    const result = await seedEverything(deps);
    return c.json(result);
  });

  app.post("/seed/bizraport", async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { offset?: number; limit?: number; withSprawozdania?: number; sprawozdaniaFirst?: string[] };
    const result = await seedBizraport(deps, {
      offset: body.offset,
      limit: body.limit,
      withSprawozdania: body.withSprawozdania,
      sprawozdaniaFirst: body.sprawozdaniaFirst,
    });
    return c.json(result);
  });

  return app;
}
