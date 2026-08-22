import { Hono } from "hono";
import { seedEverything } from "../seed/seed";
import type { ApiDeps } from "./deps";

export function createSeedRoutes(deps: ApiDeps): Hono {
  const app = new Hono();

  app.post("/seed", async (c) => {
    const result = await seedEverything(deps);
    return c.json(result);
  });

  return app;
}
