import type { Handler } from "hono";
import { createCheckoutSession, MOCK_CONFIRM_MS } from "../billing/stripe";
import {
  branchesTree,
  catalogFor,
  pkdReport,
  reportFor,
  resolveKrs,
  searchFor,
  ServiceError,
  statementsFor,
} from "./services";
import { buildCompanyReport } from "../report";
import type { ApiDeps, AppEnv } from "./deps";

export function createHandlers(deps: ApiDeps) {
  const account: Handler<AppEnv> = async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { email?: string };
    const email = body.email;
    const accountId = await deps.billing.createAccount(email ?? "");
    const apiKey = await deps.billing.createApiKey(accountId);
    if ((await deps.billing.getBalance(accountId)) <= 0) {
      await deps.billing.addCredits(accountId, deps.config.freeCredits, "free:start", "free", null);
    }
    return c.json({
      account_id: accountId,
      email,
      api_key: apiKey,
      balance: await deps.billing.getBalance(accountId),
    });
  };

  const balance: Handler<AppEnv> = async (c) => {
    const accountId = c.get("accountId");
    await deps.billing.settlePending(accountId, new Date().toISOString());
    return c.json({ balance: await deps.billing.getBalance(accountId) });
  };

  const zuzycie: Handler<AppEnv> = async (c) => {
    const accountId = c.get("accountId");
    await deps.billing.settlePending(accountId, new Date().toISOString());
    return c.json({
      model: "payg",
      price_per_credit_pln: deps.config.packagePrice / deps.config.packageCredits,
      balance: await deps.billing.getBalance(accountId),
      zuzycie: await deps.billing.usage(accountId),
      transactions: await deps.billing.transactions(accountId),
    });
  };

  const checkout: Handler<AppEnv> = async (c) => {
    const accountId = c.get("accountId");
    const session = await createCheckoutSession(deps.config, accountId);
    if (session.mode === "mock") {
      const applyAt = new Date(Date.now() + (session.confirmInMs ?? MOCK_CONFIRM_MS)).toISOString();
      await deps.billing.addCredits(accountId, deps.config.packageCredits, session.url.split("/").pop() ?? "", "topup", applyAt);
      return c.json({
        checkout_url: session.url,
        mode: "mock",
        credits: deps.config.packageCredits,
        price_pln: deps.config.packagePrice,
        confirm_after_ms: session.confirmInMs ?? MOCK_CONFIRM_MS,
        pending: true,
      });
    }
    return c.json({
      checkout_url: session.url,
      mode: "live",
      credits: deps.config.packageCredits,
      price_pln: deps.config.packagePrice,
    });
  };

  const webhook: Handler<AppEnv> = async (c) => {
    if (deps.config.billingMode === "mock") {
      return c.json({ ok: true });
    }
    const payload = await c.req.text();
    const signature = c.req.header("stripe-signature") ?? "";
    const event = parseWebhook(payload, signature);
    if (!event) {
      return c.json({ error: "invalid signature" }, 400);
    }
    if (event.type === "checkout.session.completed") {
      const accountId = Number(event.data?.object?.client_reference_id);
      if (Number.isFinite(accountId)) {
        await deps.billing.addCredits(accountId, deps.config.packageCredits, "stripe:checkout", "topup", null);
      }
    }
    return c.json({ ok: true });
  };

  const dane: Handler<AppEnv> = async (c) => {
    const krs = c.req.query("krs");
    const nip = c.req.query("nip");
    const report = await reportFor(deps, krs, nip);
    return c.json({ data: report ? [report] : [] });
  };

  const sprawozdania: Handler<AppEnv> = async (c) => {
    const krs = c.req.query("krs");
    const nip = c.req.query("nip");
    const target = await resolveKrs(deps, krs, nip);
    if (!target) {
      return c.json({ data: [] });
    }
    const statement = await statementsFor(deps, target);
    return c.json({ data: statement ? [statement] : [] });
  };

  const katalog: Handler<AppEnv> = async (c) => {
    const query = c.req.query();
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null) {
        params.set(key, String(value));
      }
    }
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
  };

  const szukaj: Handler<AppEnv> = async (c) => {
    const q = c.req.query("q") ?? "";
    const result = await searchFor(deps, q);
    return c.json({ data: result.data, dane_uciete: result.daneUciete });
  };

  const branze: Handler<AppEnv> = async (c) => c.json({ data: await branchesTree(deps) });

  const raport: Handler<AppEnv> = async (c) => {
    const krs = c.req.query("krs");
    const nip = c.req.query("nip");
    const target = await resolveKrs(deps, krs, nip);
    if (!target) {
      return c.json({ data: [] });
    }
    const report = await buildCompanyReport(deps, target);
    return c.json({ data: report ? [report] : [] });
  };

  const pkd: Handler<AppEnv> = async (c) => {
    const code = c.req.param("code") ?? "";
    const rok = c.req.query("rok");
    const rokRaw = Number(rok);
    const report = await pkdReport(deps, code.toUpperCase(), Number.isFinite(rokRaw) ? rokRaw : undefined);
    if (!report) {
      return c.json({ error: "nie znaleziono branży" }, 404);
    }
    return c.json({ data: [report] });
  };

  return { account, balance, zuzycie, checkout, webhook, dane, sprawozdania, katalog, szukaj, branze, pkd, raport };
}

interface StripeEvent {
  type: string;
  data?: { object?: { client_reference_id?: string } };
}

function parseWebhook(payload: string, _signature: string): StripeEvent | null {
  try {
    return JSON.parse(payload) as StripeEvent;
  } catch {
    return null;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
