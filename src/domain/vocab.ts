export const INDICATOR = {
  AktywaTrwale: "aktywa_trwale",
  AktywaObrotowe: "aktywa_obrotowe",
  SumaBilansowa: "suma_bilansowa",
  KapitalWlasny: "kapital_wlasny",
  ZobowiazaniaIRezerwy: "zobowiazania_i_rezerwy",
  Przychody: "przychody",
  PrzychodyOperacyjne: "przychody_operacyjne",
  PrzychodyZeSprzedazy: "przychody_ze_sprzedazy",
  Zatrudnienie: "zatrudnienie",
  ZatrudnienieEstymowane: "zatrudnienie_estymowane",
  KosztyOperacyjne: "koszty_operacyjne",
  KosztySprzedanychProduktow: "koszty_sprzedanych_produktow",
  KosztySprzedazyIZarzadu: "koszty_sprzedazy_i_zarzadu",
  Wynagrodzenia: "wynagrodzenia",
  PodatekDochodowy: "podatek_dochodowy",
  Amortyzacja: "amortyzacja",
  ZyskBruttoZeSprzedazy: "zysk_brutto_ze_sprzedazy",
  ZyskZeSprzedazy: "zysk_ze_sprzedazy",
  ZyskOperacyjny: "zysk_operacyjny",
  ZyskBrutto: "zysk_brutto",
  ZyskNetto: "zysk_netto",
  Ebit: "ebit",
  Ebitda: "ebitda",
  MarzaOperacyjna: "marza_operacyjna",
  MarzaNetto: "marza_netto",
  Roe: "roe",
  Roa: "roa",
  WskaznikZadluzenia: "wskaznik_zadluzenia",
  Niewyplacalnosc24m: "niewyplacalnosc_lub_restrukturyzacja_24m",
  Wiarygodnosc: "wiarygodnosc",
  WartoscFirmyMinimalna: "wartosc_firmy_minimalna",
  WartoscFirmySrednia: "wartosc_firmy_srednia",
  WartoscFirmyMaksymalna: "wartosc_firmy_maksymalna",
  KredytKupieckiMinimalny: "kredyt_kupiecki_minimalny",
  KredytKupieckiSredni: "kredyt_kupiecki_sredni",
  KredytKupieckiMaksymalny: "kredyt_kupiecki_maksymalny",
} as const;
export type IndicatorName = (typeof INDICATOR)[keyof typeof INDICATOR];

export const BENCHMARK_INDICATORS = [
  INDICATOR.Przychody,
  INDICATOR.ZyskNetto,
  INDICATOR.SumaBilansowa,
  INDICATOR.MarzaNetto,
  INDICATOR.MarzaOperacyjna,
  INDICATOR.Roa,
  INDICATOR.Roe,
  INDICATOR.WskaznikZadluzenia,
  INDICATOR.PodatekDochodowy,
  INDICATOR.WartoscFirmySrednia,
] as const satisfies readonly IndicatorName[];
export type BenchmarkIndicator = (typeof BENCHMARK_INDICATORS)[number];

export const CONNECTION = {
  Reprezentacja: "reprezentacja",
  Wspolnik: "wspólnik",
  OrganNadzoru: "organ nadzoru",
  Prokurent: "prokurent",
  Syndyk: "syndyk",
  Likwidator: "likwidator",
  PowiazanieZwrotne: "powiązanie zwrotne",
  PodmiotyIdentycznyNip: "podmioty o identycznym NIP",
  PodmiotyIdentycznyRegon: "podmioty o identycznym REGON",
  PowstanieOrganizacji: "powstanie organizacji",
  Inne: "inne",
} as const;
export type ConnectionType = (typeof CONNECTION)[keyof typeof CONNECTION];

export const ENTITY = {
  Osoba: "Osoba",
  Organizacja: "Organizacja",
} as const;
export type EntityType = (typeof ENTITY)[keyof typeof ENTITY];

export const MONITOR_IMPORTANCE = {
  Uwaga: "UWAGA",
  RzucOkiem: "Rzuć okiem",
  ZmianaFormalna: "Zmiana formalna",
} as const;
export type MonitorImportance = (typeof MONITOR_IMPORTANCE)[keyof typeof MONITOR_IMPORTANCE];

export const LEGAL_FORM = {
  Spzoo: "SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ",
  Sa: "SPÓŁKA AKCYJNA",
  Psa: "PROSTA SPÓŁKA AKCYJNA",
  Komandytowa: "SPÓŁKA KOMANDYTOWA",
  KomandytowoAkcja: "SPÓŁKA KOMANDYTOWO-AKCYJNA",
  Jawna: "SPÓŁKA JAWNA",
  Partnerska: "SPÓŁKA PARTNERSKA",
  Cywilna: "SPÓŁKA CYWILNA",
  Fundacja: "FUNDACJA",
  Stowarzyszenie: "STOWARZYSZENIE",
  Spoldzielnia: "SPÓŁDZIELNIA",
  Tbs: "TOWARZYSTWO BUDOWNICTWA SPOŁECZNEGO",
  OddzialZagraniczny: "ODDZIAŁ PRZEDSIĘBIORCY ZAGRANICZNEGO",
  Instytut: "INSTYTUT",
  PrzedsiebiorstwoPanstwowe: "PRZEDSIĘBIORSTWO PAŃSTWOWE",
} as const;
export type LegalForm = (typeof LEGAL_FORM)[keyof typeof LEGAL_FORM];

export function classifyLegalForm(raw: string | null | undefined): LegalForm | null {
  const normalized = (raw ?? "").toUpperCase().replace(/\s+/g, " ").trim();
  for (const form of Object.values(LEGAL_FORM)) {
    if (normalized === form) {
      return form;
    }
  }
  if (normalized.includes("PROSTA") && normalized.includes("AKCYJNA")) {
    return LEGAL_FORM.Psa;
  }
  return null;
}

export const POSTEPOWANIE = {
  Likwidacja: "postepowanie_likwidacyjne",
  Upadlosc: "postepowanie_upadlosciowe",
  Restrukturyzacja: "postepowanie_restrukturyzacyjne",
  Ukladowe: "postepowanie_ukladowe",
} as const;
export type PostepowanieName = (typeof POSTEPOWANIE)[keyof typeof POSTEPOWANIE];

export const WYROZNIK = {
  OkresSprawozdawczy: "okres_sprawozdawczy",
  Rok: "rok",
  NazwaWskaznika: "nazwa_wskaznika",
  Kwota: "kwota",
  Krs: "krs",
  Nip: "nip",
} as const;
