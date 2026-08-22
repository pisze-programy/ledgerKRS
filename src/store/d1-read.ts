import type {
  Company,
  Connection,
  FinancialYear,
  Indicator,
  KrzEntry,
  MonitorEntry,
  OwnershipShare,
  PkdCode,
  StatementHistoryEntry,
  StatementReference,
} from "../domain/types";
import { CONNECTION, ENTITY } from "../domain/vocab";
import type { Indicator as StoredIndicator } from "./repository";

export async function readCompany(db: D1Database, krs: string): Promise<Company | null> {
  const row = await db
    .prepare(
      `SELECT krs, nip, regon, name, legal_form, street, postal_code, city, voivodeship, country,
        registration_date, capital, capital_currency, status_opp, liquidation, bankruptcy
       FROM companies WHERE krs = ?`,
    )
    .bind(krs)
    .first<CompanyRow>();
  return row ? mapCompany(row) : null;
}

export async function readConnections(db: D1Database, krs: string): Promise<Connection[]> {
  const rows = await db
    .prepare(`SELECT type, name, function FROM connections WHERE krs = ? ORDER BY type`)
    .bind(krs)
    .all<ConnectionRow>();
  return rows.results.map((row) => ({
    typPodmiotu: ENTITY.Osoba,
    nazwa: row.name ?? "",
    typPowiazania: (row.type as Connection["typPowiazania"]) ?? CONNECTION.Inne,
    funkcja: row.function,
  }));
}

export async function readOwnership(db: D1Database, krs: string): Promise<OwnershipShare[]> {
  const rows = await db
    .prepare(`SELECT name, holder_krs FROM ownership WHERE krs = ?`)
    .bind(krs)
    .all<OwnershipRow>();
  return rows.results.map((row) => ({
    typPodmiotu: ENTITY.Organizacja,
    nazwa: row.name ?? null,
    idPodmiotu: row.holder_krs,
  }));
}

export async function readPkd(db: D1Database, krs: string): Promise<PkdCode[]> {
  const rows = await db
    .prepare(`SELECT code, description FROM pkd_codes WHERE krs = ? ORDER BY code`)
    .bind(krs)
    .all<PkdRow>();
  return rows.results.map((row) => ({ code: row.code, description: row.description }));
}

export async function readStatements(db: D1Database, krs: string): Promise<StatementReference[]> {
  const rows = await db
    .prepare(`SELECT period, filed_at FROM statements WHERE krs = ? ORDER BY period`)
    .bind(krs)
    .all<StatementRow>();
  return rows.results.map((row) => {
    const [from, to] = splitPeriod(row.period);
    return { periodFrom: from, periodTo: to, filedAt: row.filed_at };
  });
}

export async function readIndicators(db: D1Database, krs: string): Promise<StoredIndicator[]> {
  const rows = await db
    .prepare(`SELECT nazwa_wskaznika, kwota FROM indicators WHERE krs = ? ORDER BY nazwa_wskaznika`)
    .bind(krs)
    .all<StoredIndicator>();
  return rows.results;
}

export async function readMonitor(db: D1Database, krs: string): Promise<MonitorEntry[]> {
  const rows = await db
    .prepare(`SELECT numer_ogloszenia, sygnatura_sprawy, nr_monitora, rozdzial, tresc_ogloszenia, data_publikacji, poziom_istotnosci FROM monitor_entries WHERE krs = ?`)
    .bind(krs)
    .all<MonitorRow>();
  return rows.results.map((row) => ({
    numerOgloszenia: row.numer_ogloszenia,
    sygnaturaSprawy: row.sygnatura_sprawy,
    nrMonitora: row.nr_monitora,
    rozdzial: row.rozdzial,
    trescOgloszenia: row.tresc_ogloszenia,
    dataPublikacji: row.data_publikacji,
    poziomIstotnosci: row.poziom_istotnosci as MonitorEntry["poziomIstotnosci"],
  }));
}

export async function readKrz(db: D1Database, krs: string): Promise<KrzEntry[]> {
  const rows = await db
    .prepare(`SELECT data_krz, kategoria_tytul, numer_obwieszczenia, tytul_obwieszczenia, sygnatura_akt, sad, tresc, id_osoby FROM krz_entries WHERE krs = ?`)
    .bind(krs)
    .all<KrzRow>();
  return rows.results.map((row) => ({
    dataKrz: row.data_krz,
    kategoriaTytul: row.kategoria_tytul,
    numerObwieszczenia: row.numer_obwieszczenia,
    tytulObwieszczenia: row.tytul_obwieszczenia,
    sygnaturaAkt: row.sygnatura_akt,
    sad: row.sad,
    tresc: row.tresc,
    idOsoby: row.id_osoby,
  }));
}

export async function readHistory(db: D1Database, krs: string): Promise<StatementHistoryEntry[]> {
  const rows = await db
    .prepare(`SELECT okres, rok, termin_zlozenia, data_dodania FROM statement_history WHERE krs = ? ORDER BY okres`)
    .bind(krs)
    .all<HistoryRow>();
  return rows.results.map((row) => ({
    okresSprawozdawczy: row.okres,
    rok: row.rok,
    terminZlozenia: row.termin_zlozenia,
    dataDodaniaDoKrs: row.data_dodania,
  }));
}

export function groupIndicators(stored: StoredIndicator[]): FinancialYear[] {
  const byPeriod = new Map<string, Indicator[]>();
  for (const indicator of stored) {
    const list = byPeriod.get(indicator.nazwa_wskaznika) ?? [];
    list.push({ nazwa_wskaznika: indicator.nazwa_wskaznika as Indicator["nazwa_wskaznika"], kwota: indicator.kwota });
    byPeriod.set(indicator.nazwa_wskaznika, list);
  }
  return [...byPeriod.entries()].map(([period, items]) => ({
    okresSprawozdawczy: period,
    rok: null,
    indicators: items,
  }));
}

function splitPeriod(period: string | null): [string | null, string | null] {
  if (!period) {
    return [null, null];
  }
  const [from, to] = period.split("_");
  return [from ?? null, to ?? null];
}

function mapCompany(row: CompanyRow): Company {
  return {
    krs: row.krs,
    nip: row.nip,
    regon: row.regon,
    name: row.name,
    legalForm: row.legal_form,
    address: {
      street: row.street,
      postalCode: row.postal_code,
      city: row.city,
      voivodeship: row.voivodeship,
      country: row.country,
    },
    registrationDate: row.registration_date,
    capital: row.capital,
    capitalCurrency: row.capital_currency,
    statusOpp: row.status_opp === 1,
    liquidation: row.liquidation === 1,
    bankruptcy: row.bankruptcy === 1,
  };
}

interface CompanyRow {
  krs: string;
  nip: string | null;
  regon: string | null;
  name: string | null;
  legal_form: string | null;
  street: string | null;
  postal_code: string | null;
  city: string | null;
  voivodeship: string | null;
  country: string | null;
  registration_date: string | null;
  capital: number | null;
  capital_currency: string | null;
  status_opp: number;
  liquidation: number;
  bankruptcy: number;
}

interface ConnectionRow {
  type: string;
  name: string | null;
  function: string | null;
}

interface OwnershipRow {
  name: string | null;
  holder_krs: string | null;
}

interface PkdRow {
  code: string;
  description: string | null;
}

interface StatementRow {
  period: string | null;
  filed_at: string | null;
}

interface MonitorRow {
  numer_ogloszenia: string | null;
  sygnatura_sprawy: string | null;
  nr_monitora: string | null;
  rozdzial: string | null;
  tresc_ogloszenia: string | null;
  data_publikacji: string | null;
  poziom_istotnosci: string | null;
}

interface KrzRow {
  data_krz: string | null;
  kategoria_tytul: string | null;
  numer_obwieszczenia: string | null;
  tytul_obwieszczenia: string | null;
  sygnatura_akt: string | null;
  sad: string | null;
  tresc: string | null;
  id_osoby: string | null;
}

interface HistoryRow {
  okres: string | null;
  rok: number | null;
  termin_zlozenia: string | null;
  data_dodania: string | null;
}
