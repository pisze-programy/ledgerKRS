import { loadCreds } from "./creds";

const BASE = "https://compabase.com/api/v1";

export interface CompabaseFinancial {
  id: string;
  krs: string;
  currency: string;
  sf_period_from: string | null;
  sf_period_to: string | null;
  revenue_total?: string | null;
  revenue_operating?: string | null;
  profit_net?: string | null;
  profit_gross?: string | null;
  ebit?: string | null;
  ebitda?: string | null;
  income_tax?: string | null;
  operating_costs_total?: string | null;
  total_assets?: string | null;
  fixed_assets?: string | null;
  current_assets?: string | null;
  equity?: string | null;
  liabilities_and_provisions?: string | null;
  roa?: string | null;
  net_margin?: string | null;
}

export interface CompabaseFinancials {
  financials: {
    years: string[];
    byYear: Record<string, CompabaseFinancial[]>;
  };
}

export interface CompabaseProfile {
  company?: {
    krs?: string;
    company_name?: string | null;
    nip?: string | null;
    legal_form?: string | null;
    city?: string | null;
    region?: string | null;
  };
  financials?: { years: string[] };
  roles?: { party?: { display_name?: string }; role_name?: string }[];
}

/** REST client for the Compabase API (independent RDF-based cross-check). */
export function createCompabaseClient(apiKey: string) {
  async function get<T>(path: string): Promise<T> {
    const response = await fetch(`${BASE}${path}`, { headers: { "X-API-Key": apiKey } });
    if (response.status === 401) {
      throw new Error("Compabase: nieprawidłowy klucz API");
    }
    if (response.status === 429) {
      throw new Error("Compabase: quota wyczerpana");
    }
    if (!response.ok) {
      throw new Error(`Compabase HTTP ${response.status} for ${path}`);
    }
    return (await response.json()) as T;
  }

  return {
    async financials(krs: string): Promise<CompabaseFinancials | null> {
      try {
        return await get<CompabaseFinancials>(`/companies/krs/${krs}/financial-statements`);
      } catch {
        return null;
      }
    },
    async profile(krs: string): Promise<CompabaseProfile | null> {
      try {
        return await get<CompabaseProfile>(`/companies/krs/${krs}`);
      } catch {
        return null;
      }
    },
    async usage(): Promise<{ used: number; limit: number; remaining: number } | null> {
      try {
        return await get<{ used: number; limit: number; remaining: number }>(`/usage`);
      } catch {
        return null;
      }
    },
  };
}

export function compabaseClient(): ReturnType<typeof createCompabaseClient> | null {
  const key = loadCreds().compabaseKey;
  if (!key) {
    return null;
  }
  return createCompabaseClient(key);
}
