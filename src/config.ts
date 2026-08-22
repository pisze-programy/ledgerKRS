export interface AppConfig {
  krsApiBase: string;
  rdfBase: string;
  regonApiBase: string;
  regonApiKey: string;
  regonMode: "mock" | "live";
  billingMode: "mock" | "live";
  stripeSecretKey: string;
  stripeWebhookSecret: string;
  stripePriceId: string;
  packageCredits: number;
  packagePriceUsd: number;
  freeCredits: number;
}

export interface Bindings {
  DB?: D1Database;
  KRS_API_BASE?: string;
  RDF_BASE?: string;
  REGON_API_BASE?: string;
  REGON_API_KEY?: string;
  REGON_MODE?: string;
  BILLING_MODE?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  STRIPE_PRICE_ID?: string;
  PACKAGE_CREDITS?: string;
  PACKAGE_PRICE_USD?: string;
  FREE_CREDITS?: string;
}

export const PACKAGE = {
  Credits: 1000,
  PriceUsd: 9.99,
} as const;

export function loadConfig(bindings: Bindings = {}): AppConfig {
  return {
    krsApiBase: bindings.KRS_API_BASE ?? "https://api-krs.ms.gov.pl",
    rdfBase: bindings.RDF_BASE ?? "https://rdf-przegladarka.ms.gov.pl",
    regonApiBase: bindings.REGON_API_BASE ?? "https://wyszukiwarkaregon.stat.gov.pl/wsBIR/UslugaBIRzewnPubl.svc",
    regonApiKey: bindings.REGON_API_KEY ?? "",
    regonMode: bindings.REGON_MODE === "live" ? "live" : "mock",
    billingMode: bindings.BILLING_MODE === "live" ? "live" : "mock",
    stripeSecretKey: bindings.STRIPE_SECRET_KEY ?? "",
    stripeWebhookSecret: bindings.STRIPE_WEBHOOK_SECRET ?? "",
    stripePriceId: bindings.STRIPE_PRICE_ID ?? "price_1000_credits",
    packageCredits: numberOrDefault(bindings.PACKAGE_CREDITS, PACKAGE.Credits),
    packagePriceUsd: numberOrDefault(bindings.PACKAGE_PRICE_USD, PACKAGE.PriceUsd),
    freeCredits: numberOrDefault(bindings.FREE_CREDITS, 100),
  };
}

function numberOrDefault(value: string | undefined, fallback: number): number {
  const parsed = value === undefined ? NaN : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
