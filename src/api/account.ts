import { Hono } from "hono";
import { withKey, ACCOUNT_KEY } from "./middleware";
import type { ApiDeps, AppEnv } from "./deps";

export function createAccountRoutes(deps: ApiDeps): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  app.post("/account", async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { email?: string };
    const email = normalizeEmail(body.email);
    if (!email) {
      return c.json({ error: "podaj email" }, 400);
    }
    const accountId = await deps.billing.createAccount(email);
    const apiKey = await deps.billing.createApiKey(accountId);
    const hasCredits = await deps.billing.getBalance(accountId) > 0;
    if (!hasCredits) {
      await deps.billing.addCredits(accountId, deps.config.freeCredits, "free:start", "free", null);
    }
    return c.json({
      account_id: accountId,
      email,
      api_key: apiKey,
      balance: await deps.billing.getBalance(accountId),
    });
  });

  app.get("/balance", withKey(deps.billing), async (c) => {
    const accountId = c.get(ACCOUNT_KEY);
    await deps.billing.settlePending(accountId, new Date().toISOString());
    return c.json({ balance: await deps.billing.getBalance(accountId) });
  });

  app.get("/zuzycie", withKey(deps.billing), async (c) => {
    const accountId = c.get(ACCOUNT_KEY);
    await deps.billing.settlePending(accountId, new Date().toISOString());
    const usage = await deps.billing.usage(accountId);
    const balance = await deps.billing.getBalance(accountId);
    return c.json({
      model: "payg",
      price_per_credit_pln: (deps.config.packagePrice / deps.config.packageCredits),
      balance,
      zuzycie: usage,
      transactions: await deps.billing.transactions(accountId),
    });
  });

  return app;
}


function normalizeEmail(email: string | undefined): string | null {
  const value = email?.trim().toLowerCase();
  return value && value.includes("@") ? value : null;
}
