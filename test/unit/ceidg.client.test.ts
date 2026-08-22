import { describe, expect, it } from "vitest";
import { createCeidgClient, parseCeidg } from "../../src/sources/ceidg/client";

const SAMPLE = {
  nip: "1234567890",
  regon: "12345678901234",
  nazwa: "JAN KOWALSKI",
  ulica: "Kwiatowa 5",
  kodPocztowy: "00-001",
  miejscowosc: "Warszawa",
  wojewodztwo: "MAZOWIECKIE",
  dataRozpoczeciaDzialalnosci: "2020-01-15",
};

describe("parseCeidg", () => {
  it("maps a JDG record to a company", () => {
    const company = parseCeidg("1234567890", SAMPLE)!;
    expect(company.nip).toBe("1234567890");
    expect(company.regon).toBe("12345678901234");
    expect(company.name).toBe("JAN KOWALSKI");
    expect(company.legalForm).toBe("OSOBA FIZYCZNA");
    expect(company.address?.city).toBe("Warszawa");
    expect(company.registrationDate).toBe("2020-01-15");
  });

  it("returns null for empty body", () => {
    expect(parseCeidg("1", null)).toBeNull();
    expect(parseCeidg("1", [])).toBeNull();
  });
});

describe("createCeidgClient", () => {
  it("fetches by nip through the transport", async () => {
    const transport = async () => SAMPLE;
    const client = createCeidgClient({ baseUrl: "https://dane.gov.pl", transport });
    const company = await client.getByNip("1234567890");
    expect(company?.name).toBe("JAN KOWALSKI");
  });
});
