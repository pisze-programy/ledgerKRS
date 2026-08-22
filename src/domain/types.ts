import type {
  BenchmarkIndicator,
  ConnectionType,
  EntityType,
  IndicatorName,
  MonitorImportance,
} from "./vocab";

export type { BenchmarkIndicator, ConnectionType, EntityType, IndicatorName, MonitorImportance } from "./vocab";

export interface Address {
  street?: string | null;
  postalCode?: string | null;
  city?: string | null;
  voivodeship?: string | null;
  country?: string | null;
}

export interface Company {
  krs: string;
  nip?: string | null;
  regon?: string | null;
  name?: string | null;
  legalForm?: string | null;
  legalFormNormalized?: string | null;
  address?: Address;
  registrationDate?: string | null;
  startDate?: string | null;
  capital?: number | null;
  capitalCurrency?: string | null;
  statusOpp?: boolean;
  liquidation?: boolean;
  bankruptcy?: boolean;
  restructuring?: boolean;
  arrangement?: boolean;
  organRejestrowy?: string | null;
  formaWlasnosci?: string | null;
  sposobReprezentacji?: string | null;
  organReprezentujacy?: string | null;
  organNadzoru?: string | null;
  celDzialalnosci?: string | null;
  website?: string | null;
  email?: string | null;
  numerNieruchomosci?: string | null;
}

export interface ExtendedConnection {
  typPodmiotu: EntityType;
  nazwa: string;
  typPowiazania: ConnectionType;
  idPodmiotu?: string | null;
}

export interface Connection {
  typPodmiotu: EntityType;
  nazwa: string;
  typPowiazania: ConnectionType;
  idPodmiotu?: string | null;
  organ?: string | null;
  funkcja?: string | null;
  powiazaniaRozszerzone?: ExtendedConnection[];
}

export interface OwnershipShare {
  typPodmiotu?: EntityType | null;
  nazwa?: string | null;
  procentUdzialow?: number | null;
  idPodmiotu?: string | null;
}

export interface PkdCode {
  code: string;
  description?: string | null;
}

export interface StatementReference {
  periodFrom?: string | null;
  periodTo?: string | null;
  filedAt?: string | null;
}

export interface Indicator {
  nazwa_wskaznika: IndicatorName;
  kwota: number;
}

export interface FinancialYear {
  okresSprawozdawczy: string;
  rok: number | null;
  indicators: Indicator[];
}

export interface MonitorEntry {
  numerOgloszenia?: string | null;
  sygnaturaSprawy?: string | null;
  trescNaglowka?: string | null;
  nrMonitora?: string | null;
  rozdzial?: string | null;
  trescOgloszenia?: string | null;
  dataPublikacji?: string | null;
  nazwaPodmiotu?: string | null;
  poziomIstotnosci?: MonitorImportance | null;
}

export interface KrzEntry {
  dataKrz?: string | null;
  grupaKategoriiTytul?: string | null;
  kategoriaTytul?: string | null;
  numerObwieszczenia?: string | null;
  tytulObwieszczenia?: string | null;
  sygnaturaAkt?: string | null;
  sad?: string | null;
  wydzialSadu?: string | null;
  dluznikTyp?: string | null;
  tresc?: string | null;
  idOsoby?: string | null;
  przypisanieDoKrs?: string | null;
}

export interface StatementHistoryEntry {
  okresSprawozdawczy?: string | null;
  rok?: number | null;
  terminZlozenia?: string | null;
  dataDodaniaDoKrs?: string | null;
}

export interface IndustryBenchmarkRow {
  okresSprawozdawczy?: string | null;
  rok?: number | null;
  nazwaWskaznika: BenchmarkIndicator;
  percentylWPkd: number;
  udzialWRynku?: number | null;
  przychodyCalejBranzy?: number | null;
  liczbaFirmWBranzy?: number | null;
}

export interface CompanyDescription {
  opis?: string | null;
  punktKluczowy1?: string | null;
  punktKluczowy2?: string | null;
  punktKluczowy3?: string | null;
  punktKluczowy4?: string | null;
  punktKluczowy5?: string | null;
}

export interface CompanyReport {
  company: Company;
  connections: Connection[];
  ownership: OwnershipShare[];
  pkdCodes: PkdCode[];
  statements: StatementReference[];
  financials: FinancialYear[];
  monitor: MonitorEntry[];
  krz: KrzEntry[];
  history: StatementHistoryEntry[];
  descriptions: CompanyDescription[];
  benchmarks: IndustryBenchmarkRow[];
}
