export interface CatalogFilters {
  przychodyOd?: number;
  przychodyDo?: number;
  zyskNettoOd?: number;
  zyskNettoDo?: number;
  pkdSekcja?: string;
  pkdDzial?: string;
  pkdPodklasa?: string;
  wojewodztwo?: string;
  miasto?: string;
  adres?: string;
  gmina?: string;
  powiat?: string;
  kodPocztowyPoczatek?: string;
  kodPocztowyKoncowka?: string;
  zatrudnienieOd?: number;
  zatrudnienieDo?: number;
  roaOd?: number;
  roaDo?: number;
  roeOd?: number;
  roeDo?: number;
  marzaNettoOd?: number;
  marzaNettoDo?: number;
  marzaOperacyjnaOd?: number;
  marzaOperacyjnaDo?: number;
  wskaznikZadluzeniaOd?: number;
  wskaznikZadluzeniaDo?: number;
  ebitOd?: number;
  ebitDo?: number;
  ebitdaOd?: number;
  ebitdaDo?: number;
  aktywaTrwaleOd?: number;
  aktywaTrwaleDo?: number;
  aktywaObrotoweOd?: number;
  aktywaObrotoweDo?: number;
  sumaBilansowaOd?: number;
  sumaBilansowaDo?: number;
  gotowkaOd?: number;
  gotowkaDo?: number;
  kapitalWlasnyOd?: number;
  kapitalWlasnyDo?: number;
  zobowiazaniaOd?: number;
  zobowiazaniaDo?: number;
  podatekDochodowyOd?: number;
  podatekDochodowyDo?: number;
  wynagrodzeniaOd?: number;
  wynagrodzeniaDo?: number;
  amortyzacjaOd?: number;
  amortyzacjaDo?: number;
  wartoscFirmyOd?: number;
  wartoscFirmyDo?: number;
  cagr1Od?: number;
  cagr1Do?: number;
  cagr3Od?: number;
  cagr3Do?: number;
  cagr5Od?: number;
  cagr5Do?: number;
  nieWykreslona?: boolean;
  czyStatusOpp?: boolean;
  citEstonski?: boolean;
  ostatniKrz?: number;
  ostatniMonitor?: number;
}

export function parseCatalogFilters(query: URLSearchParams): CatalogFilters {
  return {
    przychodyOd: numberParam(query, "przychody_od"),
    przychodyDo: numberParam(query, "przychody_do"),
    zyskNettoOd: numberParam(query, "zysk_netto_od"),
    zyskNettoDo: numberParam(query, "zysk_netto_do"),
    pkdSekcja: stringParam(query, "pkd_sekcja"),
    pkdDzial: stringParam(query, "pkd_dzial"),
    pkdPodklasa: stringParam(query, "pkd_podklasa"),
    wojewodztwo: stringParam(query, "wojewodztwo"),
    miasto: stringParam(query, "miasto"),
    adres: stringParam(query, "adres"),
    gmina: stringParam(query, "gmina"),
    powiat: stringParam(query, "powiat"),
    kodPocztowyPoczatek: stringParam(query, "kod_pocztowy_poczatek"),
    kodPocztowyKoncowka: stringParam(query, "kod_pocztowy_koncowka"),
    zatrudnienieOd: numberParam(query, "zatrudnienie_od"),
    zatrudnienieDo: numberParam(query, "zatrudnienie_do"),
    roaOd: percentParam(query, "roa_od"),
    roaDo: percentParam(query, "roa_do"),
    roeOd: percentParam(query, "roe_od"),
    roeDo: percentParam(query, "roe_do"),
    marzaNettoOd: percentParam(query, "marza_netto_od"),
    marzaNettoDo: percentParam(query, "marza_netto_do"),
    marzaOperacyjnaOd: percentParam(query, "marza_operacyjna_od"),
    marzaOperacyjnaDo: percentParam(query, "marza_operacyjna_do"),
    wskaznikZadluzeniaOd: percentParam(query, "wskaznik_zadluzenia_od"),
    wskaznikZadluzeniaDo: percentParam(query, "wskaznik_zadluzenia_do"),
    ebitOd: numberParam(query, "ebit_od"),
    ebitDo: numberParam(query, "ebit_do"),
    ebitdaOd: numberParam(query, "ebitda_od"),
    ebitdaDo: numberParam(query, "ebitda_do"),
    aktywaTrwaleOd: numberParam(query, "aktywa_trwale_od"),
    aktywaTrwaleDo: numberParam(query, "aktywa_trwale_do"),
    aktywaObrotoweOd: numberParam(query, "aktywa_obrotowe_od"),
    aktywaObrotoweDo: numberParam(query, "aktywa_obrotowe_do"),
    sumaBilansowaOd: numberParam(query, "suma_bilansowa_od"),
    sumaBilansowaDo: numberParam(query, "suma_bilansowa_do"),
    gotowkaOd: numberParam(query, "gotowka_od"),
    gotowkaDo: numberParam(query, "gotowka_do"),
    kapitalWlasnyOd: numberParam(query, "kapital_wlasny_od"),
    kapitalWlasnyDo: numberParam(query, "kapital_wlasny_do"),
    zobowiazaniaOd: numberParam(query, "zobowiazania_i_rezerwy_na_zobowiazania_od"),
    zobowiazaniaDo: numberParam(query, "zobowiazania_i_rezerwy_na_zobowiazania_do"),
    podatekDochodowyOd: numberParam(query, "podatek_dochodowy_od"),
    podatekDochodowyDo: numberParam(query, "podatek_dochodowy_do"),
    wynagrodzeniaOd: numberParam(query, "wynagrodzenia_od"),
    wynagrodzeniaDo: numberParam(query, "wynagrodzenia_do"),
    amortyzacjaOd: numberParam(query, "amortyzacja_od"),
    amortyzacjaDo: numberParam(query, "amortyzacja_do"),
    wartoscFirmyOd: numberParam(query, "estymowana_wartosc_firmy_od"),
    wartoscFirmyDo: numberParam(query, "estymowana_wartosc_firmy_do"),
    cagr1Od: percentParam(query, "srednioroczny_wzrost_przychodow_1_rok_od"),
    cagr1Do: percentParam(query, "srednioroczny_wzrost_przychodow_1_rok_do"),
    cagr3Od: percentParam(query, "srednioroczny_wzrost_przychodow_3_lata_od"),
    cagr3Do: percentParam(query, "srednioroczny_wzrost_przychodow_3_lata_do"),
    cagr5Od: percentParam(query, "srednioroczny_wzrost_przychodow_5_lat_od"),
    cagr5Do: percentParam(query, "srednioroczny_wzrost_przychodow_5_lat_do"),
    nieWykreslona: boolParam(query, "nie_wykreslona"),
    czyStatusOpp: boolParam(query, "czy_status_opp"),
    citEstonski: boolParam(query, "cit_estonski"),
    ostatniKrz: numberParam(query, "ostatni_krz"),
    ostatniMonitor: numberParam(query, "ostatni_monitor"),
  };
}

function numberParam(query: URLSearchParams, key: string): number | undefined {
  const raw = query.get(key);
  if (raw === null || raw === "") {
    return undefined;
  }
  const normalized = raw.replace(/\s/g, "").replace(",", ".");
  const value = Number(normalized);
  return Number.isFinite(value) ? value : undefined;
}

function percentParam(query: URLSearchParams, key: string): number | undefined {
  const value = numberParam(query, key);
  return value === undefined ? undefined : value / 100;
}

function stringParam(query: URLSearchParams, key: string): string | undefined {
  const raw = query.get(key);
  return raw !== null && raw.length > 0 ? raw : undefined;
}

function boolParam(query: URLSearchParams, key: string): boolean | undefined {
  return query.get(key) === "tak" ? true : undefined;
}
