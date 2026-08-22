import type { Context, Next } from "hono";
import type { BillingRepository } from "../store/billing";
import type { AppEnv } from "./deps";

export const ACCOUNT_KEY = "accountId";

export function withKey(billing: BillingRepository) {
  return async (c: Context<AppEnv>, next: Next): Promise<Response | void> => {
    const key = c.req.header("x-api-key");
    if (!key) {
      return c.json({ error: "brak klucza API" }, 401);
    }
    const accountId = await billing.findAccountByApiKey(key);
    if (!accountId) {
      return c.json({ error: "nieprawidłowy klucz API" }, 401);
    }
    c.set(ACCOUNT_KEY, accountId);
    await next();
  };
}

export function chargeOne(billing: BillingRepository, refFor: (path: string) => string) {
  return async (c: Context<AppEnv>, next: Next): Promise<Response | void> => {
    await next();
    const accountId = c.get(ACCOUNT_KEY);
    const response = c.res;
    if (!response || response.status !== 200) {
      return;
    }
    const json = await response.json().catch(() => null);
    if (!json || typeof json !== "object") {
      return;
    }
    const body = json as Record<string, unknown>;
    c.res = c.json(body);
    if (c.get(CHARGED_KEY) || !hasData(body)) {
      return;
    }
    const ok = await billing.spendCredit(accountId, refFor(c.req.path));
    if (!ok) {
      c.res = c.json({ error: "brak wystarczających kredytów" }, 402);
      return;
    }
    c.set(CHARGED_KEY, true);
    const balance = await billing.getBalance(accountId);
    c.res = c.json({ ...body, credits_spent: 1, credits_remaining: balance });
  };
}

const CHARGED_KEY = "charged";

export function hasData(body: Record<string, unknown>): boolean {
  const data = body.data;
  if (Array.isArray(data) && data.length > 0) {
    return true;
  }
  return typeof body.count === "number" && body.count > 0;
}

export function refForPath(path: string): string {
  const segments = path.split("/").filter(Boolean);
  if (segments[0] === "api") {
    return `/${segments[1] ?? "dane"}`;
  }
  return `/${segments[0] ?? "mcp"}`;
}
