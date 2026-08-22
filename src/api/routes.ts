import { Hono } from "hono";
import { createAccountRoutes } from "./account";
import { createBillingRoutes } from "./billing";
import { createDataRoutes } from "./data";
import { createBranchRoutes } from "./branches";
import { createIngestRoutes } from "./ingest";
import { createSeedRoutes } from "./seed";
import { createWebRoutes } from "../web/routes";
import { handleMcpGet, handleMcpPost } from "../mcp/server";
import type { ApiDeps } from "./deps";

export function createApp(deps: ApiDeps): Hono {
  const app = new Hono();

  app.get("/health", (c) => c.json({ status: "ok" }));
  app.get("/mcp", () => handleMcpGet());
  app.post("/mcp", async (c) => {
    const key = c.req.header("x-api-key");
    const accountId = key ? await deps.billing.findAccountByApiKey(key) : null;
    if (!accountId) {
      return c.json({ error: "nieprawidłowy klucz API" }, 401);
    }
    return handleMcpPost(c.req.raw, deps, accountId);
  });

  app.route("/", createWebRoutes(deps.fetchAsset));
  app.route("/api", createAccountRoutes(deps));
  app.route("/api", createBillingRoutes(deps));
  app.route("/api", createDataRoutes(deps));
  app.route("/api", createBranchRoutes(deps));
  app.route("/", createIngestRoutes(deps));
  app.route("/", createSeedRoutes(deps));

  return app;
}
