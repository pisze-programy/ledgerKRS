export interface BizraportCreds {
  email: string;
  password: string;
}

export interface BizraportClient {
  getDane(krs: string): Promise<BizraportCompany>;
  getSprawozdania(krs: string): Promise<BizraportSprawozdania>;
  usage(): Promise<{ odpytaniaRazem: number }>;
}

export interface BizraportCompany {
  krs?: string;
  nip?: number | null;
  kod_pkd?: string | null;
  opis_pkd?: string | null;
  informacje_o_firmie?: { nazwa_pola: string; wartosc: string }[];
  dane_finansowe?: { okres_sprawozdawczy: string; rok: number; nazwa_wskaznika: string; kwota: number }[];
  opisy_firmy?: { opis?: string; punkt_kluczowy_1?: string; punkt_kluczowy_2?: string; punkt_kluczowy_3?: string; punkt_kluczowy_4?: string; punkt_kluczowy_5?: string }[];
  powiazania?: Record<string, unknown>[];
  udzialy?: Record<string, unknown>[];
  monitor_sadowy?: Record<string, unknown>[];
  krz?: Record<string, unknown>[] | null;
  historia_sprawozdan?: { okres_sprawozdawczy: string; rok: number; termin_zlozenia: string; data_dodania_do_krs: string }[];
  pozycja_na_tle_branzy?: Record<string, unknown>[];
}

export interface BizraportSprawozdanie {
  krs?: string;
  okresy?: {
    okres_sprawozdawczy: string;
    sekcje: { sekcja: string; pozycje: { pozycja_szczegolowa: string | null; kod_pozycji: string | null; poziom_zaglebienia: number | null; nazwa_pozycji: string | null; kwota: number | null }[] }[];
  }[];
}

export interface BizraportSprawozdania {
  data?: BizraportSprawozdanie[];
}

export function createBizraportClient(creds: BizraportCreds, baseUrl = "https://api.bizraport.pl"): BizraportClient {
  async function call<T>(path: string, params: Record<string, string>): Promise<T> {
    const url = new URL(`${baseUrl}${path}`);
    url.searchParams.set("email", creds.email);
    url.searchParams.set("password", creds.password);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
    const response = await fetch(url, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(60000),
    });
    if (!response.ok) {
      throw new Error(`bizraport ${path} failed: ${response.status}`);
    }
    return (await response.json()) as T;
  }

  return {
    async getDane(krs: string): Promise<BizraportCompany> {
      const body = await call<{ data?: BizraportCompany[] }>("/api/dane", { krs });
      const company = body.data?.[0];
      if (!company) {
        throw new Error(`bizraport /api/dane empty for ${krs}`);
      }
      return company;
    },
    async getSprawozdania(krs: string): Promise<BizraportSprawozdania> {
      return call<BizraportSprawozdania>("/api/sprawozdania", { krs });
    },
    async usage(): Promise<{ odpytaniaRazem: number }> {
      const body = await call<{ odpytania_razem?: number }>("/api/zuzycie", {});
      return { odpytaniaRazem: body.odpytania_razem ?? 0 };
    },
  };
}
