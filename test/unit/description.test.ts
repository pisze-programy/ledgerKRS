import { describe, expect, it } from "vitest";
import { buildCompanyDescription } from "../../src/metrics/description";

describe("buildCompanyDescription — template generator", () => {
  it("produces a description and key facts from financial data", () => {
    const d = buildCompanyDescription({
      name: "Totalizator Sportowy sp. z o.o.",
      legalForm: "SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ",
      city: "Warszawa",
      pkdDescription: "DZIAŁALNOŚĆ ZWIĄZANA Z GRAMI LOSOWYMI",
      financials: [
        { rok: 2024, przychody: 60_000_000_000, zyskNetto: 400_000_000, sumaBilansowa: 3_000_000_000, roe: 0.2, marzaNetto: 0.007 },
        { rok: 2025, przychody: 89_840_000_000, zyskNetto: 668_000_000, sumaBilansowa: 3_700_000_000, roe: 0.3, marzaNetto: 0.007 },
      ],
    });
    expect(d.opis).toContain("Totalizator Sportowy");
    expect(d.opis).toContain("Warszawa");
    expect(d.opis).toContain("grami losowymi");
    expect(d.opis).toContain("2025");
    expect(d.opis).toContain("89,84 mld zł");
    expect(d.opis).toContain("rosnące");
    expect(d.punktKluczowy1).toContain("Przychody");
    expect(d.punktKluczowy5).toContain("0,7%");
  });

  it("still produces a description when there is no financial data (graceful)", () => {
    const d = buildCompanyDescription({ name: "Firma X", financials: [] });
    expect(d.opis).toContain("Firma X");
    expect(d.opis).toContain("brak danych");
    expect(d.punktKluczowy1).toContain("brak danych");
  });

  it("reports a declining revenue trend", () => {
    const d = buildCompanyDescription({
      name: "Firma Y",
      financials: [{ rok: 2023, przychody: 100 }, { rok: 2024, przychody: 50 }],
    });
    expect(d.opis).toContain("malejące");
  });
});
