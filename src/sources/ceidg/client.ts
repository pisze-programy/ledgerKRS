import type { Company } from "../../domain/types";

export interface CeidgClientOptions {
  baseUrl: string;
  transport: (url: string) => Promise<unknown>;
}

export function createCeidgClient(options: CeidgClientOptions) {
  const baseUrl = options.baseUrl.replace(/\/$/, "");
  return {
    async getByNip(nip: string): Promise<Company | null> {
      const body = await options.transport(`${baseUrl}/ceidg/api/nip/${nip}`);
      return parseCeidg(nip, body);
    },
  };
}

export function parseCeidg(nip: string, body: unknown): Company | null {
  if (!isRecord(body)) {
    return null;
  }
  const record = body;
  const address = parseAddress(record);
  return {
    krs: "",
    nip: asString(record.nip) ?? nip,
    regon: asString(record.regon) ?? null,
    name: buildName(record),
    legalForm: "OSOBA FIZYCZNA",
    address,
    registrationDate: asString(record.dataRozpoczeciaDzialalnosci) ?? null,
    capital: null,
    capitalCurrency: null,
    statusOpp: false,
    liquidation: false,
    bankruptcy: false,
  };
}

function parseAddress(record: Record<string, unknown>): Company["address"] {
  return {
    street: asString(record.ulica) ?? null,
    postalCode: asString(record.kodPocztowy) ?? null,
    city: asString(record.miejscowosc) ?? null,
    voivodeship: asString(record.wojewodztwo) ?? null,
    country: "POLSKA",
  };
}

function buildName(record: Record<string, unknown>): string {
  const name = asString(record.nazwa);
  if (name) {
    return name;
  }
  const imie = asString(record.imie) ?? "";
  const nazwisko = asString(record.nazwisko) ?? "";
  return `${imie} ${nazwisko}`.trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
