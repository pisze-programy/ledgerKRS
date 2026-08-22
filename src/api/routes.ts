import { OpenAPIHono } from "@hono/zod-openapi";
import { createIngestRoutes } from "./ingest";
import { createSeedRoutes } from "./seed";
import { createWebRoutes } from "../web/routes";
import { handleMcpGet, handleMcpPost } from "../mcp/server";
import { chargeOne, refForPath, withKey } from "./middleware";
import { createHandlers } from "./handlers";
import {
  accountRoute,
  balanceRoute,
  branzeRoute,
  checkoutRoute,
  daneRoute,
  katalogRoute,
  pkdRoute,
  raportRoute,
  sprawozdaniaRoute,
  szukajRoute,
  webhookRoute,
  zuzycieRoute,
} from "./contract";
import type { ApiDeps, AppEnv } from "./deps";

export function createApp(deps: ApiDeps): OpenAPIHono<AppEnv> {
  const app = new OpenAPIHono<AppEnv>();
  const h = createHandlers(deps);
  const auth = withKey(deps.billing);
  const charge = chargeOne(deps.billing, refForPath);

  app.doc("/openapi.json", {
    openapi: "3.1.0",
    info: { title: "raporty-firmowe API", version: "0.1.0" },
  });

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

  app.use("/api/balance", auth);
  app.use("/api/zuzycie", auth);
  app.use("/api/billing/checkout", auth);
  app.use("/api/dane", auth, charge);
  app.use("/api/sprawozdania", auth, charge);
  app.use("/api/katalog", auth, charge);
  app.use("/api/szukaj", auth, charge);
  app.use("/api/branze", auth, charge);
  app.use("/api/pkd/:code", auth, charge);
  app.use("/api/raport", auth, charge);

  app.openapi(accountRoute, h.account as never);
  app.openapi(webhookRoute, h.webhook as never);
  app.openapi(balanceRoute, h.balance as never);
  app.openapi(zuzycieRoute, h.zuzycie as never);
  app.openapi(checkoutRoute, h.checkout as never);
  app.openapi(daneRoute, h.dane as never);
  app.openapi(sprawozdaniaRoute, h.sprawozdania as never);
  app.openapi(katalogRoute, h.katalog as never);
  app.openapi(szukajRoute, h.szukaj as never);
  app.openapi(branzeRoute, h.branze as never);
  app.openapi(pkdRoute, h.pkd as never);
  app.openapi(raportRoute, h.raport as never);

  app.route("/", createWebRoutes(deps.fetchAsset));
  app.route("/", createIngestRoutes(deps));
  app.route("/", createSeedRoutes(deps));

  return app;
}
