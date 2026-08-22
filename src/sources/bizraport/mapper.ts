import type {
  Company,
  CompanyDescription,
  CompanyReport,
  Connection,
  IndustryBenchmarkRow,
  KrzEntry,
  MonitorEntry,
  OwnershipShare,
  StatementHistoryEntry,
} from "../../domain/types";
import { CONNECTION, ENTITY, MONITOR_IMPORTANCE } from "../../domain/vocab";
import type { BizraportCompany } from "./client";

export interface BizraportPatch {
  company: Partial<Company>;
  indicators: Record<string, { nazwa_wskaznika: string; kwota: number }[]>;
  monitor: MonitorEntry[];
  krz: KrzEntry[];
  history: StatementHistoryEntry[];
  descriptions: CompanyDescription[];
  benchmarks: IndustryBenchmarkRow[];
}

export function mapBizraportCompany(krs: string, biz: BizraportCompany): BizraportPatch {
  const info = Object.fromEntries((biz.informacje_o_firmie ?? []).map((item) => [item.nazwa_pola, item.wartosc]));
  const indicators: Record<string, { nazwa_wskaznika: string; kwota: number }[]> = {};
  for (const row of biz.dane_finansowe ?? []) {
    const list = indicators[row.okres_sprawozdawczy] ?? [];
    list.push({ nazwa_wskaznika: row.nazwa_wskaznika, kwota: row.kwota });
    indicators[row.okres_sprawozdawczy] = list;
  }
  return {
    company: {
      krs,
      nip: info.nip ?? String(biz.nip ?? "") ?? null,
      regon: info.regon ?? null,
      name: info.nazwa ?? null,
      legalForm: info.forma_prawna ?? null,
      address: {
        city: info.miejscowosc ?? null,
        voivodeship: info.wojewodztwo ?? null,
        street: info.ulica ?? null,
        postalCode: info.kod_pocztowy ?? null,
        country: info.kraj ?? null,
      },
      registrationDate: normalizeDate(info.data_wpisu_do_rejestru),
      startDate: normalizeDate(info.data_rozpoczecia_dzialalnosci),
      capital: parseCapital(info.kapital_zakladowy),
      capitalCurrency: "PLN",
      statusOpp: info.status_opp === "TAK" ? true : undefined,
      organRejestrowy: info.organ_rejestrowy ?? null,
      formaWlasnosci: info.forma_wlasnosci ?? null,
      sposobReprezentacji: info.sposob_reprezentacji ?? null,
      organReprezentujacy: info.organ_reprezentujacy ?? null,
      organNadzoru: info.organ_nadzoru ?? null,
      celDzialalnosci: info.cel_dzialalnosci ?? null,
      website: info.adres_strony_internetowej ?? null,
      email: info.email ?? null,
      numerNieruchomosci: info.numer_nieruchomosci ?? null,
    },
    indicators,
    monitor: (biz.monitor_sadowy ?? []).map(mapMonitor),
    krz: (biz.krz ?? []).map(mapKrz),
    history: (biz.historia_sprawozdan ?? []).map((row) => ({
      okresSprawozdawczy: row.okres_sprawozdawczy,
      rok: row.rok,
      terminZlozenia: normalizeDate(row.termin_zlozenia),
      dataDodaniaDoKrs: normalizeDate(row.data_dodania_do_krs),
    })),
    descriptions: (biz.opisy_firmy ?? []).map((desc) => ({
      opis: desc.opis ?? null,
      punktKluczowy1: desc.punkt_kluczowy_1 ?? null,
      punktKluczowy2: desc.punkt_kluczowy_2 ?? null,
      punktKluczowy3: desc.punkt_kluczowy_3 ?? null,
      punktKluczowy4: desc.punkt_kluczowy_4 ?? null,
      punktKluczowy5: desc.punkt_kluczowy_5 ?? null,
    })),
    benchmarks: (biz.pozycja_na_tle_branzy ?? []).map((row) => ({
      okresSprawozdawczy: String(row.okres_sprawozdawczy ?? ""),
      rok: numberOrNull(row.rok),
      nazwaWskaznika: String(row.nazwa_wskaznika ?? "") as IndustryBenchmarkRow["nazwaWskaznika"],
      percentylWPkd: numberOrNull(row.percentyl_w_pkd) ?? 0,
      udzialWRynku: numberOrNull(row.udzial_w_rynku),
      przychodyCalejBranzy: numberOrNull(row.przychody_calej_branzy),
      liczbaFirmWBranzy: numberOrNull(row.liczba_firm_w_branzy),
    })),
  };
}

export function enrichReportWithBizraport(report: CompanyReport, biz: BizraportCompany): CompanyReport {
  const patch = mapBizraportCompany(report.company.krs, biz);
  return {
    ...report,
    company: { ...report.company, ...patch.company },
  };
}

export function mapBizraportConnections(connections: Record<string, unknown>[]): Connection[] {
  return connections.map((raw) => {
    const powiazaniaRozszerzone = Array.isArray(raw.powiazania_rozszerzone)
      ? raw.powiazania_rozszerzone.map((ext) => ({
          typPodmiotu: String(ext.typ_podmiotu ?? "") as Connection["typPodmiotu"],
          nazwa: String(ext.nazwa ?? ""),
          typPowiazania: String(ext.typ_powiazania ?? "") as Connection["typPowiazania"],
          idPodmiotu: stringOrNull(ext.id_podmiotu),
        }))
      : undefined;
    return {
      typPodmiotu: raw.typ_podmiotu === "Organizacja" ? ENTITY.Organizacja : ENTITY.Osoba,
      nazwa: String(raw.nazwa ?? ""),
      typPowiazania: normalizeConnectionType(String(raw.typ_powiazania ?? CONNECTION.Inne)),
      idPodmiotu: stringOrNull(raw.id_podmiotu),
      organ: stringOrNull(raw.organ),
      funkcja: stringOrNull(raw.funkcja),
      powiazaniaRozszerzone,
    };
  });
}

export function mapBizraportOwnership(shares: Record<string, unknown>[]): OwnershipShare[] {
  return shares.map((raw) => ({
    typPodmiotu: raw.typ_podmiotu === "Organizacja" ? ENTITY.Organizacja : raw.typ_podmiotu === "Osoba" ? ENTITY.Osoba : null,
    nazwa: stringOrNull(raw.nazwa),
    procentUdzialow: numberOrNull(raw.procent_udzialow),
    idPodmiotu: stringOrNull(raw.id_podmiotu),
  }));
}

function mapMonitor(raw: Record<string, unknown>): MonitorEntry {
  const importance = String(raw.poziom_istotnosci ?? "");
  const known: string[] = [MONITOR_IMPORTANCE.Uwaga, MONITOR_IMPORTANCE.RzucOkiem, MONITOR_IMPORTANCE.ZmianaFormalna];
  return {
    numerOgloszenia: stringOrNull(raw.numer_ogloszenia),
    sygnaturaSprawy: stringOrNull(raw.sygnatura_sprawy),
    trescNaglowka: stringOrNull(raw.tresc_naglowka),
    nrMonitora: stringOrNull(raw.nr_monitora),
    rozdzial: stringOrNull(raw.rozdzial),
    trescOgloszenia: stringOrNull(raw.tresc_ogloszenia),
    dataPublikacji: normalizeDate(stringOrNull(raw.data_publikacji)),
    nazwaPodmiotu: stringOrNull(raw.nazwa_podmiotu),
    poziomIstotnosci: known.includes(importance) ? (importance as MonitorEntry["poziomIstotnosci"]) : null,
  };
}

function mapKrz(raw: Record<string, unknown>): KrzEntry {
  return {
    dataKrz: normalizeDate(stringOrNull(raw.data_krz)),
    grupaKategoriiTytul: stringOrNull(raw.grupa_kategorii_tytul),
    kategoriaTytul: stringOrNull(raw.kategoria_tytul),
    numerObwieszczenia: stringOrNull(raw.numer_obwieszczenia),
    tytulObwieszczenia: stringOrNull(raw.tytul_obwieszczenia),
    sygnaturaAkt: stringOrNull(raw.sygnatura_akt),
    sad: stringOrNull(raw.sad),
    wydzialSadu: stringOrNull(raw.wydzial_sadu),
    dluznikTyp: stringOrNull(raw.dluznik_typ),
    tresc: stringOrNull(raw.tresc),
    idOsoby: stringOrNull(raw.id_osoby),
    przypisanieDoKrs: stringOrNull(raw.przypisanie_do_krs),
  };
}

function normalizeDate(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    return `${match[1]}-${match[2]}-${match[3]}`;
  }
  const ddmm = value.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (ddmm) {
    return `${ddmm[3]}-${ddmm[2]}-${ddmm[1]}`;
  }
  return value;
}

function parseCapital(value: string | undefined | null): number | null {
  if (!value) {
    return null;
  }
  const normalized = value.replace(/[^\d.,-]/g, "").replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function numberOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeConnectionType(value: string): Connection["typPowiazania"] {
  const known = Object.values(CONNECTION);
  return known.includes(value as Connection["typPowiazania"]) ? (value as Connection["typPowiazania"]) : CONNECTION.Inne;
}
