import type { ParityCreds } from "./creds";

const BASE = "https://api.bizraport.pl";

export interface BizraportCompany {
  krs: string;
  dane_finansowe: { okres_sprawozdawczy: string; kwota: number | null; nazwa_wskaznika: string; rok: number }[];
  informacje_o_firmie?: { nazwa_pola: string; wartosc: string }[];
}

export async function fetchBizraportDane(creds: ParityCreds, krs: string): Promise<BizraportCompany | null> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, 3000));
    }
    const url = new URL(`${BASE}/api/dane`);
    url.searchParams.set("email", creds.bizraportEmail);
    url.searchParams.set("password", creds.bizraportPassword);
    url.searchParams.set("krs", krs);
    const response = await fetch(url);
    if (response.status === 429) {
      continue;
    }
    if (!response.ok) {
      return null;
    }
    const body = (await response.json()) as { data?: BizraportCompany[] };
    const company = body.data?.[0] ?? null;
    if (company && company.dane_finansowe && company.dane_finansowe.length > 0) {
      return company;
    }
    return null;
  }
  return null;
}

export function summarize(c: BizraportCompany): Record<string, unknown> {
  const fin = c.dane_finansowe ?? [];
  const years = [...new Set(fin.map((r) => r.rok))].sort((a, b) => a - b);
  const names = [...new Set(fin.map((r) => r.nazwa_wskaznika))].sort();
  return {
    krs: c.krs,
    nazwa: c.informacje_o_firmie?.find((x) => x.nazwa_pola === "nazwa")?.wartosc ?? null,
    lata: years,
    pierwszy_rok: years[0] ?? null,
    ostatni_rok: years[years.length - 1] ?? null,
    liczba_lat: years.length,
    liczba_wskaznikow: names.length,
    wskaźniki: names,
    ma_pre2018: (years[0] ?? 9999) < 2018,
    ma_zatrudnienie: names.includes("zatrudnienie"),
    ma_wynagrodzenia: names.includes("wynagrodzenia"),
  };
}
