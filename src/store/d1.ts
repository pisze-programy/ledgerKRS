import type { Company, CompanyReport } from "../domain/types";
import type { Indicator, Benchmark, Repository, StatementPosition } from "./repository";
import {
  readCompany,
  readConnections,
  readOwnership,
  readPkd,
  readStatements,
  readIndicators,
  readIndicatorsByYear,
  readMonitor,
  readKrz,
  readHistory,
  readDescriptions,
  readCompanyBenchmarks,
} from "./d1-read";

export function createD1Repository(db: D1Database): Repository {
  return {
    async upsertCompany(report: CompanyReport): Promise<void> {
      const company = report.company;
      await db
        .prepare(
          `INSERT INTO companies (krs, nip, regon, name, legal_form, street, postal_code, city, voivodeship,
            country, registration_date, start_date, capital, capital_currency, status_opp, liquidation, bankruptcy,
            restructuring, arrangement, organ_rejestrowy, forma_wlasnosci, sposob_reprezentacji, organ_reprezentujacy,
            organ_nadzoru, cel_dzialalnosci, website, email, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(krs) DO UPDATE SET
             nip = excluded.nip, regon = excluded.regon, name = excluded.name, legal_form = excluded.legal_form,
             street = excluded.street, postal_code = excluded.postal_code, city = excluded.city,
             voivodeship = excluded.voivodeship, country = excluded.country,
             registration_date = excluded.registration_date, start_date = excluded.start_date,
             capital = excluded.capital, capital_currency = excluded.capital_currency,
             status_opp = excluded.status_opp, liquidation = excluded.liquidation, bankruptcy = excluded.bankruptcy,
             restructuring = excluded.restructuring, arrangement = excluded.arrangement,
             organ_rejestrowy = excluded.organ_rejestrowy, forma_wlasnosci = excluded.forma_wlasnosci,
             sposob_reprezentacji = excluded.sposob_reprezentacji, organ_reprezentujacy = excluded.organ_reprezentujacy,
             organ_nadzoru = excluded.organ_nadzoru, cel_dzialalnosci = excluded.cel_dzialalnosci,
             website = excluded.website, email = excluded.email, updated_at = excluded.updated_at`,
        )
        .bind(
          company.krs,
          company.nip,
          company.regon,
          company.name,
          company.legalForm,
          company.address?.street,
          company.address?.postalCode,
          company.address?.city,
          company.address?.voivodeship,
          company.address?.country,
          company.registrationDate ?? null,
          company.startDate ?? null,
          company.capital ?? null,
          company.capitalCurrency ?? null,
          boolToInt(company.statusOpp),
          boolToInt(company.liquidation),
          boolToInt(company.bankruptcy),
          boolToInt(company.restructuring),
          boolToInt(company.arrangement),
          company.organRejestrowy ?? null,
          company.formaWlasnosci ?? null,
          company.sposobReprezentacji ?? null,
          company.organReprezentujacy ?? null,
          company.organNadzoru ?? null,
          company.celDzialalnosci ?? null,
          company.website ?? null,
          company.email ?? null,
          new Date().toISOString(),
        )
        .run();
      await upsertConnections(db, company.krs, report.connections);
      await upsertOwnership(db, company.krs, report.ownership);
      await upsertPkd(db, company.krs, report.pkdCodes);
    },
    async upsertConnections(krs: string, connections: CompanyReport["connections"]): Promise<void> {
      await upsertConnections(db, krs, connections);
    },
    async upsertOwnership(krs: string, ownership: CompanyReport["ownership"]): Promise<void> {
      await upsertOwnership(db, krs, ownership);
    },
    async upsertPkd(krs: string, codes: CompanyReport["pkdCodes"]): Promise<void> {
      await upsertPkd(db, krs, codes);
    },
    async upsertIndicators(krs: string, okres: string | null, indicators: Indicator[]): Promise<void> {
      for (const indicator of indicators) {
        await db
          .prepare(
            `INSERT INTO indicators (krs, okres, nazwa_wskaznika, kwota) VALUES (?, ?, ?, ?)
             ON CONFLICT(krs, okres, nazwa_wskaznika) DO UPDATE SET kwota = excluded.kwota`,
          )
          .bind(krs, okres ?? null, indicator.nazwa_wskaznika, indicator.kwota ?? null)
          .run();
      }
    },
    async upsertBenchmarks(pkd: string, rok: number, benchmarks: Benchmark[]): Promise<void> {
      for (const benchmark of benchmarks) {
        await db
          .prepare(
            `INSERT INTO benchmarks (pkd, rok, nazwa_wskaznika, percentyl, liczba_firm, udzial_w_rynku, przychody_branzy)
             VALUES (?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(pkd, rok, nazwa_wskaznika) DO UPDATE SET
               percentyl = excluded.percentyl, liczba_firm = excluded.liczba_firm,
               udzial_w_rynku = excluded.udzial_w_rynku, przychody_branzy = excluded.przychody_branzy`,
          )
          .bind(
            pkd,
            benchmark.rok,
            benchmark.nazwa_wskaznika,
            benchmark.percentyl,
            benchmark.liczba_firm,
            benchmark.udzial_w_rynku ?? null,
            benchmark.przychody_branzy ?? null,
          )
          .run();
      }
    },
    async upsertMonitor(krs: string, entries: CompanyReport["monitor"]): Promise<void> {
      await upsertMonitor(db, krs, entries);
    },
    async upsertKrz(krs: string, entries: CompanyReport["krz"]): Promise<void> {
      await upsertKrz(db, krs, entries);
    },
    async upsertHistory(krs: string, entries: CompanyReport["history"]): Promise<void> {
      await upsertHistory(db, krs, entries);
    },
    async upsertDescriptions(krs: string, entries: CompanyReport["descriptions"]): Promise<void> {
      await upsertDescriptions(db, krs, entries);
    },
    async upsertCompanyBenchmarks(krs: string, entries: CompanyReport["benchmarks"]): Promise<void> {
      await upsertCompanyBenchmarks(db, krs, entries);
    },
    async getDescriptions(krs: string): Promise<CompanyReport["descriptions"]> {
      return readDescriptions(db, krs);
    },
    async getCompanyBenchmarks(krs: string): Promise<CompanyReport["benchmarks"]> {
      return readCompanyBenchmarks(db, krs);
    },
    async upsertStatement(krs: string, statement: CompanyReport["statements"][number]): Promise<number> {
      const result = await db
        .prepare(
          `INSERT INTO statements (krs, period, rok, filed_at) VALUES (?, ?, ?, ?)
           ON CONFLICT(krs, period) DO UPDATE SET rok = excluded.rok, filed_at = excluded.filed_at`,
        )
        .bind(krs, statement.periodFrom ? `${statement.periodFrom}_${statement.periodTo ?? ""}` : null, null, statement.filedAt)
        .run();
      const row = await db
        .prepare(`SELECT id FROM statements WHERE krs = ? AND period = ?`)
        .bind(krs, statement.periodFrom ? `${statement.periodFrom}_${statement.periodTo ?? ""}` : null)
        .first<{ id: number }>();
      return row?.id ?? 0;
    },
    async upsertPositions(statementId: number, positions: unknown[]): Promise<void> {
      await upsertPositions(db, statementId, positions);
    },
    async readIndicators(krs: string): Promise<Indicator[]> {
      const result = await db
        .prepare(`SELECT nazwa_wskaznika, kwota FROM indicators WHERE krs = ? ORDER BY nazwa_wskaznika`)
        .bind(krs)
        .all<Indicator>();
      return result.results;
    },
    async readIndicatorsByYear(krs: string): Promise<CompanyReport["financials"]> {
      return readIndicatorsByYear(db, krs);
    },
    async getCompany(krs: string): Promise<Company | null> {
      const row = await db
        .prepare(
          `SELECT krs, nip, regon, name, legal_form, street, postal_code, city, voivodeship, country,
            registration_date, capital, capital_currency, status_opp, liquidation, bankruptcy
           FROM companies WHERE krs = ?`,
        )
        .bind(krs)
        .first<CompanyRow>();
      return row ? mapRow(row) : null;
    },
    async getReport(krs: string): Promise<CompanyReport | null> {
      const [company, connections, ownership, pkdCodes, statements, financials, monitor, krz, history, descriptions, benchmarks] = await Promise.all([
        readCompany(db, krs),
        readConnections(db, krs),
        readOwnership(db, krs),
        readPkd(db, krs),
        readStatements(db, krs),
        readIndicatorsByYear(db, krs),
        readMonitor(db, krs),
        readKrz(db, krs),
        readHistory(db, krs),
        readDescriptions(db, krs),
        readCompanyBenchmarks(db, krs),
      ]);
      if (!company) {
        return null;
      }
      return {
        company,
        connections,
        ownership,
        pkdCodes,
        statements,
        financials,
        monitor,
        krz,
        history,
        descriptions,
        benchmarks,
      };
    },
    async getStatementPositions(krs: string): Promise<StatementPosition[]> {
      const rows = await db
        .prepare(
          `SELECT s.period AS okres, p.sekcja, p.kod_pozycji, p.poziom_zaglebienia, p.nazwa_pozycji, p.kwota
           FROM statements s JOIN statement_positions p ON p.statement_id = s.id
           WHERE s.krs = ? ORDER BY p.statement_id`,
        )
        .bind(krs)
        .all<StatementPositionRow>();
      return rows.results.map((row) => ({
        okresSprawozdawczy: row.okres ?? "",
        sekcja: row.sekcja ?? "",
        kod_pozycji: row.kod_pozycji ?? "",
        poziom_zaglebienia: row.poziom_zaglebienia,
        nazwa_pozycji: row.nazwa_pozycji,
        kwota: row.kwota,
      }));
    },
    async listCompanies(limit: number, offset: number): Promise<Company[]> {
      const result = await db
        .prepare(
          `SELECT krs, nip, regon, name, legal_form, street, postal_code, city, voivodeship, country,
            registration_date, capital, capital_currency, status_opp, liquidation, bankruptcy
           FROM companies ORDER BY name LIMIT ? OFFSET ?`,
        )
        .bind(limit, offset)
        .all<CompanyRow>();
      return result.results.map(mapRow);
    },
    async setIngestState(lastBulletinDay: string): Promise<void> {
      await db
        .prepare(
          `INSERT INTO ingest_state (id, last_bulletin_day, updated_at) VALUES (1, ?, ?)
           ON CONFLICT(id) DO UPDATE SET last_bulletin_day = excluded.last_bulletin_day, updated_at = excluded.updated_at`,
        )
        .bind(lastBulletinDay, new Date().toISOString())
        .run();
    },
    async getIngestState(): Promise<string | null> {
      const row = await db.prepare(`SELECT last_bulletin_day FROM ingest_state WHERE id = 1`).first<{ last_bulletin_day: string }>();
      return row?.last_bulletin_day ?? null;
    },
  };
}

async function upsertConnections(db: D1Database, krs: string, connections: CompanyReport["connections"]): Promise<void> {
  for (const connection of connections) {
    await db
      .prepare(`INSERT OR IGNORE INTO connections (krs, type, name, function) VALUES (?, ?, ?, ?)`)
      .bind(krs, connection.typPowiazania, connection.nazwa ?? null, connection.funkcja ?? null)
      .run();
  }
}

async function upsertOwnership(db: D1Database, krs: string, ownership: CompanyReport["ownership"]): Promise<void> {
  for (const share of ownership) {
    await db
      .prepare(`INSERT OR IGNORE INTO ownership (krs, name, holder_krs) VALUES (?, ?, ?)`)
      .bind(krs, share.nazwa, share.idPodmiotu)
      .run();
  }
}

async function upsertPkd(db: D1Database, krs: string, codes: CompanyReport["pkdCodes"]): Promise<void> {
  for (const code of codes) {
    await db
      .prepare(`INSERT OR IGNORE INTO pkd_codes (krs, code, description) VALUES (?, ?, ?)`)
      .bind(krs, code.code, code.description)
      .run();
  }
}

async function upsertMonitor(db: D1Database, krs: string, entries: CompanyReport["monitor"]): Promise<void> {
  for (const entry of entries) {
    await db
      .prepare(
        `INSERT OR IGNORE INTO monitor_entries (krs, numer_ogloszenia, sygnatura_sprawy, nr_monitora, rozdzial, tresc_ogloszenia, data_publikacji, poziom_istotnosci)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        krs,
        entry.numerOgloszenia ?? null,
        entry.sygnaturaSprawy ?? null,
        entry.nrMonitora ?? null,
        entry.rozdzial ?? null,
        entry.trescOgloszenia ?? null,
        entry.dataPublikacji ?? null,
        entry.poziomIstotnosci ?? null,
      )
      .run();
  }
}

async function upsertKrz(db: D1Database, krs: string, entries: CompanyReport["krz"]): Promise<void> {
  for (const entry of entries) {
    await db
      .prepare(
        `INSERT OR IGNORE INTO krz_entries (krs, data_krz, kategoria_tytul, numer_obwieszczenia, tytul_obwieszczenia, sygnatura_akt, sad, tresc, id_osoby)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        krs,
        entry.dataKrz ?? null,
        entry.kategoriaTytul ?? null,
        entry.numerObwieszczenia ?? null,
        entry.tytulObwieszczenia ?? null,
        entry.sygnaturaAkt ?? null,
        entry.sad ?? null,
        entry.tresc ?? null,
        entry.idOsoby ?? null,
      )
      .run();
  }
}

async function upsertHistory(db: D1Database, krs: string, entries: CompanyReport["history"]): Promise<void> {
  for (const entry of entries) {
    await db
      .prepare(
        `INSERT OR IGNORE INTO statement_history (krs, okres, rok, termin_zlozenia, data_dodania) VALUES (?, ?, ?, ?, ?)`,
      )
      .bind(krs, entry.okresSprawozdawczy ?? null, entry.rok ?? null, entry.terminZlozenia ?? null, entry.dataDodaniaDoKrs ?? null)
      .run();
  }
}

async function upsertDescriptions(db: D1Database, krs: string, entries: CompanyReport["descriptions"]): Promise<void> {
  for (const entry of entries) {
    await db
      .prepare(
        `INSERT OR REPLACE INTO company_descriptions (krs, opis, punkt_kluczowy_1, punkt_kluczowy_2, punkt_kluczowy_3, punkt_kluczowy_4, punkt_kluczowy_5)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(krs, entry.opis ?? null, entry.punktKluczowy1 ?? null, entry.punktKluczowy2 ?? null, entry.punktKluczowy3 ?? null, entry.punktKluczowy4 ?? null, entry.punktKluczowy5 ?? null)
      .run();
  }
}

async function upsertCompanyBenchmarks(db: D1Database, krs: string, entries: CompanyReport["benchmarks"]): Promise<void> {
  for (const entry of entries) {
    await db
      .prepare(
        `INSERT OR REPLACE INTO company_benchmarks (krs, okres, rok, nazwa_wskaznika, percentyl, udzial_w_rynku, przychody_branzy, liczba_firm)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(krs, entry.okresSprawozdawczy ?? null, entry.rok ?? null, entry.nazwaWskaznika, entry.percentylWPkd, entry.udzialWRynku ?? null, entry.przychodyCalejBranzy ?? null, entry.liczbaFirmWBranzy ?? null)
      .run();
  }
}

async function upsertPositions(db: D1Database, statementId: number, positions: unknown[]): Promise<void> {
  for (const position of positions as StatementPositionRow[]) {
    await db
      .prepare(
        `INSERT INTO statement_positions (statement_id, sekcja, kod_pozycji, poziom_zaglebienia, nazwa_pozycji, kwota)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        statementId,
        position.sekcja,
        position.kod_pozycji,
        position.poziom_zaglebienia,
        position.nazwa_pozycji,
        position.kwota,
      )
      .run();
  }
}

interface StatementPositionRow {
  okres: string;
  sekcja: string;
  kod_pozycji: string;
  poziom_zaglebienia: number | null;
  nazwa_pozycji: string | null;
  kwota: number | null;
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

function mapRow(row: CompanyRow): Company {
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
    statusOpp: boolFromInt(row.status_opp),
    liquidation: boolFromInt(row.liquidation),
    bankruptcy: boolFromInt(row.bankruptcy),
  };
}

function boolToInt(value: boolean | undefined): number {
  return value ? 1 : 0;
}

function boolFromInt(value: number): boolean {
  return value === 1;
}
