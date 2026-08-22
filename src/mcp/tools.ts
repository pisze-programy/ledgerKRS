import { createCheckoutSession, MOCK_CONFIRM_MS } from "../billing/stripe";
import { catalogFor, branchesTree, pkdReport, reportFor, resolveKrs, searchFor, ServiceError, statementsFor } from "../api/services";
import { buildCompanyReport } from "../report";
import { hasData } from "../api/middleware";
import type { ApiDeps } from "../api/deps";

export interface ToolContext {
  accountId: number;
  deps: ApiDeps;
}

export interface ToolDef {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler(context: ToolContext, args: Record<string, unknown>): Promise<unknown>;
}

export const TOOLS: ToolDef[] = [
  {
    name: "get_company",
    description: "Dane firmy z KRS po numerze krs albo nip: rejestrowe, finansowe, ryzyko, wycena, powiązania, MSiG, KRZ.",
    inputSchema: {
      type: "object",
      properties: {
        krs: { type: "string", description: "10-cyfrowy numer KRS" },
        nip: { type: "string", description: "10-cyfrowy numer NIP" },
      },
    },
    async handler({ deps }, args) {
      return { data: [(await reportFor(deps, stringArg(args.krs), stringArg(args.nip)))].filter(Boolean) };
    },
  },
  {
    name: "get_company_report",
    description: "Bogaty raport firmy po numerze KRS albo NIP: finanse per rok z wyceną (min/śr/max), kredyt kupiecki, ryzyko i wiarygodność 24m, terminowość składania, pozycja na tle branży, opisy, powiązania (graf: identyczny NIP/REGON, zwrotne), podobne organizacje.",
    inputSchema: {
      type: "object",
      properties: {
        krs: { type: "string", description: "10-cyfrowy numer KRS" },
        nip: { type: "string", description: "10-cyfrowy numer NIP" },
      },
    },
    async handler({ deps }, args) {
      const report = await buildCompanyReport(deps, ...(await resolveKrsOrThrow(deps, args)));
      return { data: report ? [report] : [] };
    },
  },
  {
    name: "get_statements",
    description: "Pełne sprawozdania finansowe firmy po numerze KRS, pozycja po pozycji.",
    inputSchema: {
      type: "object",
      properties: { krs: { type: "string" } },
      required: ["krs"],
    },
    async handler({ deps }, args) {
      const krs = stringArg(args.krs);
      if (!krs) {
        throw new Error("podaj krs");
      }
      const statement = await statementsFor(deps, krs);
      return { data: statement ? [statement] : [] };
    },
  },
  {
    name: "search_companies",
    description: "Pełnotekstowe wyszukiwanie firm po nazwie, NIP, KRS albo REGON.",
    inputSchema: {
      type: "object",
      properties: { q: { type: "string" } },
      required: ["q"],
    },
    async handler({ deps }, args) {
      const q = stringArg(args.q) ?? "";
      if (!q.trim()) {
        throw new Error("podaj q");
      }
      const result = await searchFor(deps, q);
      return { data: result.data, dane_uciete: result.daneUciete };
    },
  },
  {
    name: "filter_catalog",
    description: "Filtruje firmy po finansach, branży PKD, lokalizacji i wskaźnikach. Zwraca licznik i metryki per firma.",
    inputSchema: {
      type: "object",
      properties: {
        przychody_od: { type: "number" }, przychody_do: { type: "number" },
        zysk_netto_od: { type: "number" }, zysk_netto_do: { type: "number" },
        pkd_sekcja: { type: "string" }, pkd_dzial: { type: "string" }, pkd_podklasa: { type: "string" },
        wojewodztwo: { type: "string" }, miasto: { type: "string" },
        roa_od: { type: "number" }, roe_od: { type: "number" },
        nie_wykreslona: { type: "string", enum: ["tak"] }, cit_estonski: { type: "string", enum: ["tak"] },
        sort: { type: "string" }, order: { type: "string", enum: ["asc", "desc"] },
        limit: { type: "number" }, offset: { type: "number" },
      },
    },
    async handler({ deps }, args) {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(args)) {
        if (value !== undefined && value !== null) {
          params.set(key, String(value));
        }
      }
      const limit = clamp(numberArg(args.limit) ?? 100, 1, 1000);
      const offset = numberArg(args.offset) ?? 0;
      try {
        return await catalogFor(deps, params, stringArg(args.sort) ?? "aktywa", stringArg(args.order) ?? "desc", limit, offset);
      } catch (error) {
        if (error instanceof ServiceError) {
          throw new Error(error.message);
        }
        throw error;
      }
    },
  },
  {
    name: "list_branches",
    description: "Lista branż PKD: sekcje i działy (taksonomia A-U).",
    inputSchema: { type: "object", properties: {} },
    async handler({ deps }) {
      return { data: await branchesTree(deps) };
    },
  },
  {
    name: "get_pkd_report",
    description: "Raport branżowy dla kodu PKD: podsumowanie, rozmiar, największe firmy, geografia, percentyle przychodów/zysku/wyceny.",
    inputSchema: {
      type: "object",
      properties: {
        code: { type: "string", description: "kod PKD (sekcja, dział, grupa albo podklasa), np. 62, 62.01.Z, J" },
        rok: { type: "number" },
      },
      required: ["code"],
    },
    async handler({ deps }, args) {
      const code = stringArg(args.code)?.toUpperCase() ?? "";
      const rokRaw = numberArg(args.rok);
      const report = await pkdReport(deps, code, rokRaw);
      if (!report) {
        throw new Error("nie znaleziono branży");
      }
      return { data: [report] };
    },
  },
  {
    name: "get_balance",
    description: "Stan kredytów na koncie.",
    inputSchema: { type: "object", properties: {} },
    async handler({ accountId, deps }) {
      await deps.billing.settlePending(accountId, new Date().toISOString());
      return { balance: await deps.billing.getBalance(accountId) };
    },
  },
  {
    name: "buy_credits",
    description: "Zakup pakietu 1000 kredytów za 9,99 zł. Zwraca adres checkout (Stripe). W trybie mock kredyty dochodzą po chwili.",
    inputSchema: { type: "object", properties: {} },
    async handler({ accountId, deps }) {
      const session = await createCheckoutSession(deps.config, accountId);
      if (session.mode === "mock") {
        const applyAt = new Date(Date.now() + (session.confirmInMs ?? MOCK_CONFIRM_MS)).toISOString();
        await deps.billing.addCredits(accountId, deps.config.packageCredits, session.url.split("/").pop() ?? "", "topup", applyAt);
      }
      return {
        checkout_url: session.url,
        mode: session.mode,
        credits: deps.config.packageCredits,
        price_pln: deps.config.packagePrice,
        confirm_after_ms: session.confirmInMs,
      };
    },
  },
  {
    name: "get_usage",
    description: "Zużycie kredytów w rozbiciu na endpointy i lista transakcji.",
    inputSchema: { type: "object", properties: {} },
    async handler({ accountId, deps }) {
      await deps.billing.settlePending(accountId, new Date().toISOString());
      return {
        balance: await deps.billing.getBalance(accountId),
        zuzycie: await deps.billing.usage(accountId),
        transactions: await deps.billing.transactions(accountId),
      };
    },
  },
];

export async function callTool(context: ToolContext, tool: ToolDef, args: Record<string, unknown>): Promise<unknown> {
  const result = await tool.handler(context, args);
  if (hasData(result as Record<string, unknown>)) {
    const ok = await context.deps.billing.spendCredit(context.accountId, "/mcp");
    if (!ok) {
      throw new Error("brak wystarczających kredytów");
    }
    const balance = await context.deps.billing.getBalance(context.accountId);
    return { ...(result as Record<string, unknown>), credits_spent: 1, credits_remaining: balance };
  }
  return result;
}

function stringArg(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

async function resolveKrsOrThrow(deps: ApiDeps, args: Record<string, unknown>): Promise<[string]> {
  const krs = await resolveKrs(deps, stringArg(args.krs), stringArg(args.nip));
  if (!krs) {
    throw new Error("podaj krs albo nip");
  }
  return [krs];
}

function numberArg(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
