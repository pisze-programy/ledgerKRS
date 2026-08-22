import type { AppConfig } from "../config";

export const MOCK_CONFIRM_MS = 5000;

export interface CheckoutSession {
  url: string;
  mode: "mock" | "live";
  confirmInMs: number | null;
}

export async function createCheckoutSession(config: AppConfig, accountId: number): Promise<CheckoutSession> {
  const ref = `checkout:${accountId}:${randomId()}`;
  if (config.billingMode === "live") {
    const url = await stripeCheckoutUrl(config, accountId, ref);
    return { url, mode: "live", confirmInMs: null };
  }
  return { url: `https://checkout.stripe.com/test/${ref}`, mode: "mock", confirmInMs: MOCK_CONFIRM_MS };
}

async function stripeCheckoutUrl(config: AppConfig, accountId: number, ref: string): Promise<string> {
  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.stripeSecretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      mode: "payment",
      "line_items[0][price]": config.stripePriceId,
      "line_items[0][quantity]": "1",
      "client_reference_id": String(accountId),
      "metadata[ref]": ref,
      success_url: "https://raporty-firmowe.dev/checkout/success",
      cancel_url: "https://raporty-firmowe.dev/checkout/cancel",
    }),
  });
  if (!response.ok) {
    throw new Error(`stripe checkout failed: ${response.status}`);
  }
  const body = (await response.json()) as { url?: string };
  return body.url ?? "";
}

function randomId(): string {
  return Math.random().toString(36).slice(2, 12);
}
