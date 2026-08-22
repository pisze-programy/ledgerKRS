import type {
  Address,
  Company,
  CompanyReport,
  Connection,
  OwnershipShare,
  PkdCode,
  StatementReference,
} from "../../domain/types";
import { classifyLegalForm, CONNECTION, ENTITY, type ConnectionType } from "../../domain/vocab";
import { padKrs, toIsoDate, toNumber } from "../../lib/normalize";

export function parseOdpis(raw: unknown): CompanyReport | null {
  const odpis = asRecord(asRecord(raw)?.odpis);
  if (!odpis) {
    return null;
  }
  const naglowek = asRecord(odpis.naglowekA) ?? {};
  const dane = asRecord(odpis.dane) ?? {};
  const dzial1 = asRecord(dane.dzial1) ?? {};
  const dzial2 = asRecord(dane.dzial2) ?? {};
  const dzial3 = asRecord(dane.dzial3) ?? {};
  const dzial5 = asRecord(dane.dzial5) ?? {};
  const dzial6 = asRecord(dane.dzial6) ?? {};
  return {
    company: parseCompany(naglowek, dzial1, dzial2, dzial5, dzial6),
    connections: parseConnections(dzial1, dzial2),
    ownership: parseOwnership(dzial1),
    pkdCodes: parsePkd(dzial3),
    statements: parseStatements(dzial3),
    financials: [],
    monitor: [],
    krz: [],
    history: [],
    descriptions: [],
    benchmarks: [],
  };
}

function parseCompany(naglowek: Record<string, unknown>, dzial1: Record<string, unknown>, dzial2: Record<string, unknown>, dzial5: Record<string, unknown>, dzial6: Record<string, unknown>): Company {
  const danePodmiotu = asRecord(dzial1.danePodmiotu) ?? asRecord(dzial1.danePodmiotuZagranicznego) ?? {};
  const identyfikatory = asRecord(danePodmiotu.identyfikatory) ?? {};
  const kapital = asRecord(
    asRecord(dzial1.kapital)?.wysokoscKapitaluZakladowego ??
      asRecord(dzial1.kapitalPSA)?.wysokoscKapitaluAkcyjnego,
  ) ?? {};
  const siedzibaIAdres = asRecord(dzial1.siedzibaIAdres) ?? asRecord(dzial1.siedzibaIAdresPodmiotuZagranicznego) ?? {};
  const reprezentacja = asRecord(dzial2.reprezentacja) ?? {};
  const formaPrawna = asString(danePodmiotu.formaPrawna) ?? null;
  return {
    krs: padKrs(asString(naglowek.numerKRS) ?? ""),
    nip: asString(identyfikatory.nip) ?? null,
    regon: asString(identyfikatory.regon) ?? null,
    name: asString(danePodmiotu.nazwa) ?? null,
    legalForm: formaPrawna,
    legalFormNormalized: classifyLegalForm(formaPrawna),
    address: parseAddress(siedzibaIAdres),
    registrationDate: toIsoDate(naglowek.dataRejestracjiWKRS),
    capital: toNumber(kapital.wartosc),
    capitalCurrency: asString(kapital.waluta) ?? null,
    statusOpp: hasOpp(dzial1, danePodmiotu),
    liquidation: hasPostepowanie(dzial5, dzial6, "likwidacj"),
    bankruptcy: hasPostepowanie(dzial5, dzial6, "upadlosc"),
    restructuring: hasPostepowanie(dzial5, dzial6, "restrukturyzacj"),
    arrangement: hasPostepowanie(dzial5, dzial6, "uklad"),
    organRejestrowy: asString(naglowek.oznaczenieSaduDokonujacegoOstatniegoWpisu) ?? null,
    sposobReprezentacji: asString(reprezentacja.sposobReprezentacji) ?? null,
    organReprezentujacy: asString(reprezentacja.nazwaOrganu) ?? null,
    organNadzoru: organNadzoruNames(asArray(dzial2.organNadzoru)),
    website: asString(siedzibaIAdres.adresStronyInternetowej) ?? null,
  };
}

function organNadzoruNames(organy: unknown[]): string | null {
  const names = organy.map((organ) => asString(asRecord(organ)?.nazwa)).filter(Boolean) as string[];
  return names.length > 0 ? names.join(", ") : null;
}

function parseAddress(siedzibaIAdres: Record<string, unknown> | undefined): Address {
  const siedziba = asRecord(siedzibaIAdres?.siedziba) ?? {};
  const adres = asRecord(siedzibaIAdres?.adres) ?? {};
  return {
    street: asString(adres.ulica) ?? null,
    postalCode: asString(adres.kodPocztowy) ?? null,
    city: asString(siedziba.miejscowosc) ?? null,
    voivodeship: asString(siedziba.wojewodztwo) ?? null,
    country: asString(siedziba.kraj) ?? null,
  };
}

function parseConnections(dzial1: Record<string, unknown>, dzial2: Record<string, unknown>): Connection[] {
  const result: Connection[] = [];
  pushConnections(result, parseReprezentacja(asRecord(dzial2.reprezentacja)));
  pushConnections(result, parseOrganyNadzoru(asArray(dzial2.organNadzoru)));
  pushConnections(result, parseProkurenci(asArray(dzial2.prokurenci)));
  pushConnections(result, parseWspolnicy(dzial1));
  pushConnections(result, parseOrganSprawujacyNadzor(dzial1));
  pushConnections(result, parseOsobyReprezentujacePz(asArray(dzial2.osobyReprezentujacePZ)));
  return result;
}

function parseOsobyReprezentujacePz(osoby: unknown[]): Connection[] {
  return osoby.map((osoba) => {
    const record = asRecord(osoba) ?? {};
    const nazwisko = asRecord(record.nazwisko);
    const imiona = asRecord(record.imiona);
    const nazwiskoValue = asString(nazwisko?.nazwiskoICzlon) ?? "";
    const imieValue = asString(imiona?.imie) ?? "";
    return {
      typPodmiotu: ENTITY.Osoba,
      nazwa: [nazwiskoValue, imieValue].filter(Boolean).join(" "),
      typPowiazania: CONNECTION.Reprezentacja,
    };
  });
}

function parseWspolnicy(dzial1: Record<string, unknown>): Connection[] {
  const sources = [
    ...asArray(dzial1.wspolnicySpzoo),
    ...asArray(dzial1.wspolnicyPartnerzy),
    ...asArray(dzial1.jedynyAkcjonariusz),
  ];
  return sources.map((shareholder) => {
    const record = asRecord(shareholder) ?? {};
    const krs = asRecord(record.krs);
    return {
      typPodmiotu: record.nazwa ? ENTITY.Organizacja : ENTITY.Osoba,
      nazwa: companyOrPersonName(record),
      typPowiazania: CONNECTION.Wspolnik,
      idPodmiotu: krs && asString(krs.krs) !== "0000000000" ? padKrs(asString(krs.krs) ?? "") : null,
    };
  });
}

function parseOrganSprawujacyNadzor(dzial1: Record<string, unknown>): Connection[] {
  const organ = asRecord(dzial1.organSprawujacyNadzor);
  if (!organ) {
    return [];
  }
  const name = asString(organ.nazwaOrganu) ?? "ORGAN SPRAWUJĄCY NADZÓR";
  return asList(organ.sklad).map((member) => {
    const record = asRecord(member) ?? {};
    return {
      typPodmiotu: ENTITY.Osoba,
      nazwa: companyOrPersonName(record) || name,
      typPowiazania: CONNECTION.OrganNadzoru,
      organ: name,
      funkcja: asString(record.funkcjaWOrganie) ?? null,
    };
  });
}

function parseReprezentacja(reprezentacja: Record<string, unknown> | undefined): Connection[] {
  if (!reprezentacja) {
    return [];
  }
  const organName = asString(reprezentacja.nazwaOrganu) ?? null;
  return asList(reprezentacja.sklad).map((member) => {
    const connection = personToConnection(member, CONNECTION.Reprezentacja, "funkcjaWOrganie");
    connection.organ = organName;
    return connection;
  });
}

function parseOrganyNadzoru(organy: unknown[]): Connection[] {
  const result: Connection[] = [];
  for (const organ of organy) {
    const record = asRecord(organ);
    const nazwa = asString(record?.nazwa) ?? null;
    for (const member of asList(record?.sklad)) {
      const connection = personToConnection(member, CONNECTION.OrganNadzoru, "funkcjaWOrganie");
      connection.organ = nazwa ?? connection.organ;
      result.push(connection);
    }
  }
  return result;
}

function parseProkurenci(prokurenci: unknown[]): Connection[] {
  return prokurenci.map((prokura) => personToConnection(prokura, CONNECTION.Prokurent, "rodzajProkury"));
}

function personToConnection(member: unknown, typPowiazania: ConnectionType, funkcjaField: string): Connection {
  const record = asRecord(member) ?? {};
  return {
    typPodmiotu: ENTITY.Osoba,
    nazwa: companyOrPersonName(record),
    typPowiazania,
    funkcja: asString(record[funkcjaField]) ?? null,
  };
}

function companyOrPersonName(record: Record<string, unknown>): string {
  const nazwisko = asRecord(record.nazwisko);
  const imiona = asRecord(record.imiona);
  const nazwiskoValue = asString(nazwisko?.nazwiskoICzlon) ?? "";
  const imieValue = asString(imiona?.imie) ?? "";
  const personName = [nazwiskoValue, imieValue].filter(Boolean).join(" ");
  return asString(record.nazwa) ?? (personName || "");
}

function parseOwnership(dzial1: Record<string, unknown>): OwnershipShare[] {
  const spzoo = asArray(dzial1.wspolnicySpzoo).map(shareholderToShare);
  const sa = asArray(dzial1.jedynyAkcjonariusz).map(shareholderToShare);
  return withPercent([...spzoo, ...sa]);
}

interface ShareWithCount extends OwnershipShare {
  shares?: number;
}

function shareholderToShare(shareholder: unknown): ShareWithCount {
  const record = asRecord(shareholder) ?? {};
  const krs = asRecord(record.krs);
  const shares = parseSharesCount(asString(record.posiadaneUdzialy));
  return {
    typPodmiotu: record.nazwa ? ENTITY.Organizacja : ENTITY.Osoba,
    nazwa: companyOrPersonName(record) || null,
    procentUdzialow: null,
    idPodmiotu: krs && asString(krs.krs) !== "0000000000" ? padKrs(asString(krs.krs) ?? "") : null,
    shares: shares ?? (record.czyPosiadaCaloscAkcji === true ? 1 : undefined),
  };
}

function withPercent(shares: ShareWithCount[]): OwnershipShare[] {
  const total = shares.reduce((sum, share) => sum + (share.shares ?? 0), 0);
  if (total <= 0) {
    return shares.map(({ shares: _shares, ...rest }) => rest);
  }
  return shares.map(({ shares: count, ...rest }) => ({
    ...rest,
    procentUdzialow: count ? Math.round((count / total) * 1000) / 10 : null,
  }));
}

function parseSharesCount(text: string | undefined | null): number | undefined {
  if (!text) {
    return undefined;
  }
  const match = text.match(/([\d][\d\s.,]*)/);
  if (!match) {
    return undefined;
  }
  const normalized = match[1]!.replace(/[\s.]/g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parsePkd(dzial3: Record<string, unknown>): PkdCode[] {
  const przedmiot = asRecord(dzial3.przedmiotDzialalnosci) ?? {};
  const przewazajaca = asArray(przedmiot.przedmiotPrzewazajacejDzialalnosci);
  const pozostala = asArray(przedmiot.przedmiotPozostalejDzialalnosci);
  return [...przewazajaca, ...pozostala].map((entry) => {
    const record = asRecord(entry) ?? {};
    return {
      code: composePkd(asString(record.kodDzial), asString(record.kodKlasa), asString(record.kodPodklasa)),
      description: asString(record.opis) ?? null,
    };
  });
}

function composePkd(dzial: string | undefined, klasa: string | undefined, podklasa: string | undefined): string {
  return [dzial, klasa, podklasa].filter(Boolean).join(".");
}

function parseStatements(dzial3: Record<string, unknown>): StatementReference[] {
  const wzmianki = asRecord(dzial3.wzmiankiOZlozonychDokumentach) ?? {};
  const roczne = asArray(wzmianki.wzmiankaOZlozeniuRocznegoSprawozdaniaFinansowego);
  const skonsolidowane = asArray(wzmianki.wzmiankaOZlozeniuSkonsolidowanegoRocznegoSprawozdaniaFinansowego);
  const all = [...roczne, ...skonsolidowane];
  return all.map((entry) => {
    const record = asRecord(entry) ?? {};
    const period = parsePeriod(record.zaOkresOdDo);
    return {
      periodFrom: period.from,
      periodTo: period.to,
      filedAt: toIsoDate(record.dataZlozenia),
    };
  });
}

function parsePeriod(value: unknown): { from: string | null; to: string | null } {
  const text = asString(value);
  if (!text) {
    return { from: null, to: null };
  }
  const match = text.match(/(\d{1,2})[ .]([A-ZŁŚŻ]+|[A-Z]+)[ .](\d{4})/g);
  if (!match) {
    return { from: null, to: null };
  }
  const dates = match.map(parsePolishDate).filter((date): date is string => date !== null);
  return { from: dates[0] ?? null, to: dates[1] ?? null };
}

function parsePolishDate(value: string): string | null {
  const normalized = value.replace(".", " ").trim();
  const parts = normalized.split(/[\s.]+/);
  if (parts.length < 3) {
    return null;
  }
  const day = parts[0]!;
  const monthIndex = MONTHS.indexOf(parts[1]!.toUpperCase());
  const year = parts[2]!;
  if (monthIndex < 0 || !/^\d{4}$/.test(year)) {
    return null;
  }
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${day.padStart(2, "0")}`;
}

const MONTHS = ["STYCZNIA", "LUTEGO", "MARCA", "KWIETNIA", "MAJA", "CZERWCA", "LIPCA", "SIERPNIA", "WRZEŚNIA", "PAŹDZIERNIKA", "LISTOPADA", "GRUDNIA"];

function hasOpp(dzial1: Record<string, unknown>, danePodmiotu: Record<string, unknown>): boolean {
  const pozostale = asRecord(dzial1.pozostaleInformacje);
  return asBoolean(pozostale?.czyJestOrganizacjaPozytkuPublicznego) || asBoolean(danePodmiotu.czyPosiadaStatusOPP);
}

function hasPostepowanie(dzial5: Record<string, unknown>, dzial6: Record<string, unknown>, needle: string): boolean {
  return [dzial5, dzial6].some((section) =>
    Object.keys(section).some((key) => key.toLowerCase().includes(needle)),
  );
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asList(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }
  return value === null || value === undefined ? [] : [value];
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function asBoolean(value: unknown): boolean {
  return value === true || value === "true" || value === "TAK";
}

function pushConnections(target: Connection[], source: Connection[]): void {
  for (const item of source) {
    target.push(item);
  }
}
