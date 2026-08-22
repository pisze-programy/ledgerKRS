import type {
  BranchStat,
  CatalogRepository,
  CatalogRow,
  SearchResult,
  TaxonomyEntry,
} from "./catalog";

export const CATALOG_COLUMNS = [
  "krs", "name", "nip", "regon", "legal_form", "street", "city", "voivodeship", "postal_code",
  "website", "email", "pkd_sekcja", "pkd_dzial", "pkd_podklasa", "pkd_opis", "nie_wykreslona",
  "czy_status_opp", "cit_estonski", "ostatni_krz", "ostatni_monitor", "rok", "przychody", "zysk_netto",
  "aktywa_trwale", "aktywa_obrotowe", "suma_bilansowa", "gotowka", "kapital_wlasny",
  "zobowiazania_i_rezerwy", "kapital_zakladowy", "podatek_dochodowy", "zysk_operacyjny",
  "koszty_operacyjne", "ebit", "ebitda", "wynagrodzenia", "amortyzacja", "zatrudnienie", "roa", "roe",
  "marza_netto", "marza_operacyjna", "wskaznik_zadluzenia", "estymowana_wartosc_firmy", "cagr_1", "cagr_3", "cagr_5",
] as const;

export function createD1CatalogRepository(db: D1Database): CatalogRepository {
  return {
    async upsertCatalogRows(rows: CatalogRow[]): Promise<void> {
      await db.batch(rows.map((row) => buildUpsert(db, row)));
    },
    async searchCatalog(query): Promise<SearchResult> {
      const columns = CATALOG_COLUMNS.join(", ");
      const rows = await db
        .prepare(`SELECT ${columns} FROM catalog_rows${query.where}${query.orderBy} LIMIT ? OFFSET ?`)
        .bind(...query.params, query.limit, query.offset)
        .all<CatalogRowRaw>();
      const count = await countWhere(db, query.where, query.params);
      return { rows: rows.results.map(mapCatalogRow), count };
    },
    async searchFulltext(query): Promise<SearchResult> {
      const columns = CATALOG_COLUMNS.join(", ");
      const rows = await db
        .prepare(`SELECT ${columns} FROM catalog_rows${query.where}${query.orderBy} LIMIT ?`)
        .bind(...query.params, query.limit)
        .all<CatalogRowRaw>();
      const count = await countWhere(db, query.where, query.params);
      return { rows: rows.results.map(mapCatalogRow), count };
    },
    async listTaxonomy(level?: string, parent?: string): Promise<TaxonomyEntry[]> {
      const clauses: string[] = [];
      const params: string[] = [];
      if (level) {
        clauses.push("level = ?");
        params.push(level);
      }
      if (parent) {
        clauses.push("parent = ?");
        params.push(parent);
      }
      const where = clauses.length > 0 ? ` WHERE ${clauses.join(" AND ")}` : "";
      const rows = await db
        .prepare(`SELECT code, level, name, parent, section FROM pkd_taxonomy${where} ORDER BY code`)
        .bind(...params)
        .all<TaxonomyRow>();
      return rows.results.map(mapTaxonomy);
    },
    async upsertTaxonomy(entries: TaxonomyEntry[]): Promise<void> {
      await db.batch(
        entries.map((entry) =>
          db
            .prepare(`INSERT OR REPLACE INTO pkd_taxonomy (code, level, name, parent, section) VALUES (?, ?, ?, ?, ?)`)
            .bind(entry.code, entry.level, entry.name, entry.parent, entry.section),
        ),
      );
    },
    async getBranchStats(pkd: string, rok: number): Promise<BranchStat | null> {
      const row = await db
        .prepare(`SELECT * FROM branch_stats WHERE pkd = ? AND rok = ?`)
        .bind(pkd, rok)
        .first<BranchStatRow>();
      return row ? mapBranchStat(row) : null;
    },
    async listBranchStats(pkd: string): Promise<BranchStat[]> {
      const rows = await db
        .prepare(`SELECT * FROM branch_stats WHERE pkd = ? ORDER BY rok`)
        .bind(pkd)
        .all<BranchStatRow>();
      return rows.results.map(mapBranchStat);
    },
    async upsertBranchStats(stats: BranchStat[]): Promise<void> {
      await db.batch(stats.map(buildBranchUpsert(db)));
    },
  };
}

async function countWhere(db: D1Database, where: string, params: unknown[]): Promise<number> {
  const row = await db
    .prepare(`SELECT COUNT(*) as n FROM catalog_rows${where}`)
    .bind(...params)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

function buildUpsert(db: D1Database, row: CatalogRow): D1PreparedStatement {
  const values = [
    row.krs, row.name, row.nip, row.regon, row.legalForm, row.street, row.city, row.voivodeship, row.postalCode,
    row.website, row.email, row.pkdSekcja, row.pkdDzial, row.pkdPodklasa, row.pkdOpis, int(row.nieWykreslona),
    int(row.czyStatusOpp), int(row.citEstonski), row.ostatniKrz, row.ostatniMonitor, row.rok, row.przychody ?? null,
    row.zyskNetto ?? null, row.aktywaTrwale ?? null, row.aktywaObrotowe ?? null, row.sumaBilansowa ?? null,
    row.gotowka ?? null, row.kapitalWlasny ?? null, row.zobowiazaniaIRezerwy ?? null, row.kapitalZakladowy ?? null,
    row.podatekDochodowy ?? null, row.zyskOperacyjny ?? null, row.kosztyOperacyjne ?? null, row.ebit ?? null,
    row.ebitda ?? null, row.wynagrodzenia ?? null, row.amortyzacja ?? null, row.zatrudnienie ?? null, row.roa ?? null,
    row.roe ?? null, row.marzaNetto ?? null, row.marzaOperacyjna ?? null, row.wskaznikZadluzenia ?? null,
    row.estymowanaWartoscFirmy ?? null, row.cagr1 ?? null, row.cagr3 ?? null, row.cagr5 ?? null,
  ];
  const columns = CATALOG_COLUMNS.join(", ");
  const placeholders = CATALOG_COLUMNS.map(() => "?").join(", ");
  const updates = CATALOG_COLUMNS.map((column) => `${column} = excluded.${column}`).join(", ");
  return db
    .prepare(`INSERT INTO catalog_rows (${columns}) VALUES (${placeholders}) ON CONFLICT(krs) DO UPDATE SET ${updates}`)
    .bind(...values);
}

function buildBranchUpsert(db: D1Database) {
  return (stat: BranchStat): D1PreparedStatement =>
    db
      .prepare(
        `INSERT OR REPLACE INTO branch_stats (pkd, rok, count, total_przychody, avg_przychod, avg_zysk,
          p10_przychody, p20_przychody, p50_przychody, p90_przychody,
          p10_zysk, p20_zysk, p50_zysk, p90_zysk,
          p10_wartosc, p20_wartosc, p50_wartosc, p90_wartosc)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        stat.pkd, stat.rok, stat.count, stat.totalPrzychody, stat.avgPrzychod, stat.avgZysk,
        stat.p10Przychody, stat.p20Przychody, stat.p50Przychody, stat.p90Przychody,
        stat.p10Zysk, stat.p20Zysk, stat.p50Zysk, stat.p90Zysk,
        stat.p10Wartosc, stat.p20Wartosc, stat.p50Wartosc, stat.p90Wartosc,
      );
}

function int(value: boolean): number {
  return value ? 1 : 0;
}

function mapCatalogRow(row: CatalogRowRaw): CatalogRow {
  return {
    krs: row.krs,
    name: row.name,
    nip: row.nip,
    regon: row.regon,
    legalForm: row.legal_form,
    street: row.street,
    city: row.city,
    voivodeship: row.voivodeship,
    postalCode: row.postal_code,
    website: row.website,
    email: row.email,
    pkdSekcja: row.pkd_sekcja,
    pkdDzial: row.pkd_dzial,
    pkdPodklasa: row.pkd_podklasa,
    pkdOpis: row.pkd_opis,
    nieWykreslona: row.nie_wykreslona === 1,
    czyStatusOpp: row.czy_status_opp === 1,
    citEstonski: row.cit_estonski === 1,
    ostatniKrz: row.ostatni_krz ?? 0,
    ostatniMonitor: row.ostatni_monitor ?? 0,
    rok: row.rok,
    przychody: row.przychody,
    zyskNetto: row.zysk_netto,
    aktywaTrwale: row.aktywa_trwale,
    aktywaObrotowe: row.aktywa_obrotowe,
    sumaBilansowa: row.suma_bilansowa,
    gotowka: row.gotowka,
    kapitalWlasny: row.kapital_wlasny,
    zobowiazaniaIRezerwy: row.zobowiazania_i_rezerwy,
    kapitalZakladowy: row.kapital_zakladowy,
    podatekDochodowy: row.podatek_dochodowy,
    zyskOperacyjny: row.zysk_operacyjny,
    kosztyOperacyjne: row.koszty_operacyjne,
    ebit: row.ebit,
    ebitda: row.ebitda,
    wynagrodzenia: row.wynagrodzenia,
    amortyzacja: row.amortyzacja,
    zatrudnienie: row.zatrudnienie,
    roa: row.roa,
    roe: row.roe,
    marzaNetto: row.marza_netto,
    marzaOperacyjna: row.marza_operacyjna,
    wskaznikZadluzenia: row.wskaznik_zadluzenia,
    estymowanaWartoscFirmy: row.estymowana_wartosc_firmy,
    cagr1: row.cagr_1,
    cagr3: row.cagr_3,
    cagr5: row.cagr_5,
  };
}

function mapTaxonomy(row: TaxonomyRow): TaxonomyEntry {
  return { code: row.code, level: row.level, name: row.name, parent: row.parent, section: row.section };
}

function mapBranchStat(row: BranchStatRow): BranchStat {
  return {
    pkd: row.pkd,
    rok: row.rok,
    count: row.count,
    totalPrzychody: row.total_przychody,
    avgPrzychod: row.avg_przychod,
    avgZysk: row.avg_zysk,
    p10Przychody: row.p10_przychody,
    p20Przychody: row.p20_przychody,
    p50Przychody: row.p50_przychody,
    p90Przychody: row.p90_przychody,
    p10Zysk: row.p10_zysk,
    p20Zysk: row.p20_zysk,
    p50Zysk: row.p50_zysk,
    p90Zysk: row.p90_zysk,
    p10Wartosc: row.p10_wartosc,
    p20Wartosc: row.p20_wartosc,
    p50Wartosc: row.p50_wartosc,
    p90Wartosc: row.p90_wartosc,
  };
}

interface CatalogRowRaw {
  krs: string;
  name: string | null;
  nip: string | null;
  regon: string | null;
  legal_form: string | null;
  street: string | null;
  city: string | null;
  voivodeship: string | null;
  postal_code: string | null;
  website: string | null;
  email: string | null;
  pkd_sekcja: string | null;
  pkd_dzial: string | null;
  pkd_podklasa: string | null;
  pkd_opis: string | null;
  nie_wykreslona: number;
  czy_status_opp: number;
  cit_estonski: number;
  ostatni_krz: number | null;
  ostatni_monitor: number | null;
  rok: number | null;
  przychody: number | null;
  zysk_netto: number | null;
  aktywa_trwale: number | null;
  aktywa_obrotowe: number | null;
  suma_bilansowa: number | null;
  gotowka: number | null;
  kapital_wlasny: number | null;
  zobowiazania_i_rezerwy: number | null;
  kapital_zakladowy: number | null;
  podatek_dochodowy: number | null;
  zysk_operacyjny: number | null;
  koszty_operacyjne: number | null;
  ebit: number | null;
  ebitda: number | null;
  wynagrodzenia: number | null;
  amortyzacja: number | null;
  zatrudnienie: number | null;
  roa: number | null;
  roe: number | null;
  marza_netto: number | null;
  marza_operacyjna: number | null;
  wskaznik_zadluzenia: number | null;
  estymowana_wartosc_firmy: number | null;
  cagr_1: number | null;
  cagr_3: number | null;
  cagr_5: number | null;
}

interface TaxonomyRow {
  code: string;
  level: string;
  name: string;
  parent: string | null;
  section: string | null;
}

interface BranchStatRow {
  pkd: string;
  rok: number;
  count: number;
  total_przychody: number | null;
  avg_przychod: number | null;
  avg_zysk: number | null;
  p10_przychody: number | null;
  p20_przychody: number | null;
  p50_przychody: number | null;
  p90_przychody: number | null;
  p10_zysk: number | null;
  p20_zysk: number | null;
  p50_zysk: number | null;
  p90_zysk: number | null;
  p10_wartosc: number | null;
  p20_wartosc: number | null;
  p50_wartosc: number | null;
  p90_wartosc: number | null;
}
