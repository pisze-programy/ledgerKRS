import { Hono } from "hono";
import { seedEverything } from "../seed/seed";
import { seedBizraport } from "../seed/bizraport";
import { seedBulletin } from "../seed/bulletin";
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

  app.post("/seed/bulletin", async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { day?: string; limit?: number };
    const limit = Math.min(Math.max(Math.trunc(body.limit ?? 20), 1), 200);
    try {
      const result = await seedBulletin(deps, body.day || null, limit);
      return c.json(result);
    } catch (error) {
      return c.json({ error: error instanceof Error ? error.message : String(error) }, 500);
    }
  });

  return app;
}
