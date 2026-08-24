CREATE TABLE IF NOT EXISTS companies (
  krs TEXT PRIMARY KEY,
  nip TEXT,
  regon TEXT,
  name TEXT,
  legal_form TEXT,
  street TEXT,
  postal_code TEXT,
  city TEXT,
  voivodeship TEXT,
  country TEXT,
  registration_date TEXT,
  start_date TEXT,
  capital INTEGER,
  capital_currency TEXT,
  status_opp INTEGER DEFAULT 0,
  liquidation INTEGER DEFAULT 0,
  bankruptcy INTEGER DEFAULT 0,
  restructuring INTEGER DEFAULT 0,
  arrangement INTEGER DEFAULT 0,
  organ_rejestrowy TEXT,
  forma_wlasnosci TEXT,
  sposob_reprezentacji TEXT,
  organ_reprezentujacy TEXT,
  organ_nadzoru TEXT,
  cel_dzialalnosci TEXT,
  website TEXT,
  email TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS connections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  krs TEXT NOT NULL,
  type TEXT NOT NULL,
  name TEXT,
  function TEXT,
  name_norm TEXT,
  UNIQUE(krs, type, name, function)
);

CREATE TABLE IF NOT EXISTS ownership (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  krs TEXT NOT NULL,
  name TEXT,
  holder_krs TEXT,
  percent REAL,
  entity TEXT,
  UNIQUE(krs, name)
);

CREATE TABLE IF NOT EXISTS pkd_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  krs TEXT NOT NULL,
  code TEXT NOT NULL,
  description TEXT,
  UNIQUE(krs, code)
);

CREATE TABLE IF NOT EXISTS statements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  krs TEXT NOT NULL,
  period TEXT,
  rok INTEGER,
  filed_at TEXT,
  UNIQUE(krs, period)
);

CREATE TABLE IF NOT EXISTS statement_positions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  statement_id INTEGER NOT NULL,
  sekcja TEXT,
  kod_pozycji TEXT,
  poziom_zaglebienia INTEGER,
  nazwa_pozycji TEXT,
  kwota REAL
);

CREATE TABLE IF NOT EXISTS indicators (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  krs TEXT NOT NULL,
  okres TEXT,
  nazwa_wskaznika TEXT NOT NULL,
  kwota REAL,
  UNIQUE(krs, okres, nazwa_wskaznika)
);

CREATE TABLE IF NOT EXISTS benchmarks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pkd TEXT NOT NULL,
  rok INTEGER,
  nazwa_wskaznika TEXT NOT NULL,
  percentyl REAL,
  liczba_firm INTEGER,
  udzial_w_rynku REAL,
  przychody_branzy REAL,
  UNIQUE(pkd, rok, nazwa_wskaznika)
);

CREATE TABLE IF NOT EXISTS monitor_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  krs TEXT NOT NULL,
  numer_ogloszenia TEXT,
  sygnatura_sprawy TEXT,
  nr_monitora TEXT,
  rozdzial TEXT,
  tresc_ogloszenia TEXT,
  data_publikacji TEXT,
  poziom_istotnosci TEXT,
  UNIQUE(krs, numer_ogloszenia)
);

CREATE TABLE IF NOT EXISTS krz_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  krs TEXT NOT NULL,
  data_krz TEXT,
  kategoria_tytul TEXT,
  numer_obwieszczenia TEXT,
  tytul_obwieszczenia TEXT,
  sygnatura_akt TEXT,
  sad TEXT,
  tresc TEXT,
  id_osoby TEXT,
  UNIQUE(krs, numer_obwieszczenia)
);

CREATE TABLE IF NOT EXISTS statement_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  krs TEXT NOT NULL,
  okres TEXT,
  rok INTEGER,
  termin_zlozenia TEXT,
  data_dodania TEXT,
  UNIQUE(krs, okres)
);

CREATE TABLE IF NOT EXISTS ingest_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  last_bulletin_day TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS api_keys (
  key TEXT PRIMARY KEY,
  account_id INTEGER NOT NULL,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS credits (
  account_id INTEGER PRIMARY KEY,
  balance INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS credit_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  amount INTEGER NOT NULL,
  ref TEXT,
  status TEXT NOT NULL,
  apply_at TEXT,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS catalog_rows (
  krs TEXT PRIMARY KEY,
  name TEXT,
  nip TEXT,
  regon TEXT,
  legal_form TEXT,
  street TEXT,
  city TEXT,
  voivodeship TEXT,
  postal_code TEXT,
  website TEXT,
  email TEXT,
  pkd_sekcja TEXT,
  pkd_dzial TEXT,
  pkd_podklasa TEXT,
  pkd_opis TEXT,
  nie_wykreslona INTEGER DEFAULT 0,
  czy_status_opp INTEGER DEFAULT 0,
  cit_estonski INTEGER DEFAULT 0,
  ostatni_krz INTEGER DEFAULT 0,
  ostatni_monitor INTEGER DEFAULT 0,
  rok INTEGER,
  przychody REAL,
  zysk_netto REAL,
  aktywa_trwale REAL,
  aktywa_obrotowe REAL,
  suma_bilansowa REAL,
  gotowka REAL,
  kapital_wlasny REAL,
  zobowiazania_i_rezerwy REAL,
  kapital_zakladowy REAL,
  podatek_dochodowy REAL,
  zysk_operacyjny REAL,
  koszty_operacyjne REAL,
  ebit REAL,
  ebitda REAL,
  wynagrodzenia REAL,
  amortyzacja REAL,
  zatrudnienie REAL,
  roa REAL,
  roe REAL,
  marza_netto REAL,
  marza_operacyjna REAL,
  wskaznik_zadluzenia REAL,
  estymowana_wartosc_firmy REAL,
  cagr_1 REAL,
  cagr_3 REAL,
  cagr_5 REAL
);

CREATE TABLE IF NOT EXISTS pkd_taxonomy (
  code TEXT PRIMARY KEY,
  level TEXT NOT NULL,
  name TEXT NOT NULL,
  parent TEXT,
  section TEXT
);

CREATE TABLE IF NOT EXISTS branch_stats (
  pkd TEXT NOT NULL,
  rok INTEGER NOT NULL,
  count INTEGER,
  total_przychody REAL,
  avg_przychod REAL,
  avg_zysk REAL,
  p10_przychody REAL,
  p20_przychody REAL,
  p50_przychody REAL,
  p90_przychody REAL,
  p10_zysk REAL,
  p20_zysk REAL,
  p50_zysk REAL,
  p90_zysk REAL,
  p10_wartosc REAL,
  p20_wartosc REAL,
  p50_wartosc REAL,
  p90_wartosc REAL,
  PRIMARY KEY (pkd, rok)
);

CREATE TABLE IF NOT EXISTS company_descriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  krs TEXT NOT NULL,
  opis TEXT,
  punkt_kluczowy_1 TEXT,
  punkt_kluczowy_2 TEXT,
  punkt_kluczowy_3 TEXT,
  punkt_kluczowy_4 TEXT,
  punkt_kluczowy_5 TEXT,
  UNIQUE(krs)
);

CREATE TABLE IF NOT EXISTS company_benchmarks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  krs TEXT NOT NULL,
  okres TEXT,
  rok INTEGER,
  nazwa_wskaznika TEXT NOT NULL,
  percentyl REAL,
  udzial_w_rynku REAL,
  przychody_branzy REAL,
  liczba_firm INTEGER,
  UNIQUE(krs, okres, nazwa_wskaznika)
);
