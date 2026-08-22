import { describe, expect, it } from "vitest";
import { parseSprawozdanie } from "../../src/sources/rdf/parser";

const SAMPLE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<JednostkaInna>
  <Naglowek>
    <OkresOd>2025-01-01</OkresOd>
    <OkresDo>2025-12-31</OkresDo>
  </Naglowek>
  <Bilans>
    <jin:Aktywa>
      <dtsf:KwotaA>30341528084.00</dtsf:KwotaA>
      <dtsf:KwotaB>1000.00</dtsf:KwotaB>
      <jin:Aktywa_A>
        <dtsf:KwotaA>200.00</dtsf:KwotaA>
        <dtsf:KwotaB>0.00</dtsf:KwotaB>
        <jin:Aktywa_A_I_2>
          <dtsf:KwotaA>0.00</dtsf:KwotaA>
          <dtsf:KwotaB>0.00</dtsf:KwotaB>
        </jin:Aktywa_A_I_2>
      </jin:Aktywa_A>
    </jin:Aktywa>
  </Bilans>
  <RZiS>
    <jin:A>
      <dtsf:KwotaA>108317454729.00</dtsf:KwotaA>
      <dtsf:KwotaB>0.00</dtsf:KwotaB>
    </jin:A>
  </RZiS>
</JednostkaInna>`;

describe("parseSprawozdanie", () => {
  it("returns null for empty input", () => {
    expect(parseSprawozdanie("")).toBeNull();
  });

  it("parses period and year", () => {
    const statement = parseSprawozdanie(SAMPLE_XML)!;
    expect(statement.okres_sprawozdawczy).toBe("2025-01-01_2025-12-31");
    expect(statement.rok).toBe(2025);
  });

  it("parses sections and positions", () => {
    const statement = parseSprawozdanie(SAMPLE_XML)!;
    expect(statement.sekcje.map((s) => s.sekcja)).toEqual(["Bilans", "Rachunek zysków i strat"]);
    const bilans = statement.sekcje[0]!;
    expect(bilans.pozycje).toHaveLength(3);
    expect(bilans.pozycje[0]).toEqual({
      pozycja_szczegolowa: null,
      kod_pozycji: "Aktywa",
      poziom_zaglebienia: 0,
      nazwa_pozycji: "A. Aktywa razem",
      kwota: 30341528084,
      kwota_poprzedni_rok: 1000,
    });
    expect(statement.sekcje[1]!.pozycje[0]!.kwota).toBe(108317454729);
  });

  it("handles missing sections", () => {
    const statement = parseSprawozdanie(SAMPLE_XML)!;
    expect(statement.sekcje.some((s) => s.sekcja === "Zestawienie zmian w kapitale")).toBe(false);
  });
});
