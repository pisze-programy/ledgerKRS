import { Hono } from "hono";
import { withKey, ACCOUNT_KEY } from "./middleware";
import { createCheckoutSession, MOCK_CONFIRM_MS } from "../billing/stripe";
import type { ApiDeps, AppEnv } from "./deps";

export function createBillingRoutes(deps: ApiDeps): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  app.post("/billing/checkout", withKey(deps.billing), async (c) => {
    const accountId = c.get(ACCOUNT_KEY);
    const session = await createCheckoutSession(deps.config, accountId);
    if (session.mode === "mock") {
      const applyAt = new Date(Date.now() + (session.confirmInMs ?? MOCK_CONFIRM_MS)).toISOString();
      await deps.billing.addCredits(accountId, deps.config.packageCredits, session.url.split("/").pop() ?? "", "topup", applyAt);
      return c.json({
        checkout_url: session.url,
        mode: "mock",
        credits: deps.config.packageCredits,
        price_usd: deps.config.packagePriceUsd,
        confirm_after_ms: session.confirmInMs ?? MOCK_CONFIRM_MS,
        pending: true,
      });
    }
    return c.json({ checkout_url: session.url, mode: "live", credits: deps.config.packageCredits, price_usd: deps.config.packagePriceUsd });
  });

  app.post("/billing/webhook", async (c) => {
    if (deps.config.billingMode === "mock") {
      return c.json({ ok: true, mode: "mock" });
    }
    const payload = await c.req.text();
    const signature = c.req.header("stripe-signature") ?? "";
    const event = verifyWebhook(deps.config.stripeWebhookSecret, payload, signature);
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
  });

  return app;
}

interface StripeEvent {
  type: string;
  data?: { object?: { client_reference_id?: string } };
}

function verifyWebhook(_secret: string, payload: string, _signature: string): StripeEvent | null {
  try {
    return JSON.parse(payload) as StripeEvent;
  } catch {
    return null;
  }
}
