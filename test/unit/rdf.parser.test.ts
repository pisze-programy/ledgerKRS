import { describe, expect, it } from "vitest";
import { parseSprawozdanie } from "../../src/sources/rdf/parser";

const SAMPLE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<SprawozdanieFinansowe>
  <OkresOd>2025-01-01</OkresOd>
  <OkresDo>2025-12-31</OkresDo>
  <Bilans>
    <Pozycja>
      <KodPozycji>Aktywa</KodPozycji>
      <PoziomZaglebienia>1</PoziomZaglebienia>
      <NazwaPozycji>Aktywa razem</NazwaPozycji>
      <Kwota>30341528084.00</Kwota>
    </Pozycja>
    <Pozycja>
      <KodPozycji>Aktywa_A_I_2</KodPozycji>
      <PoziomZaglebienia>4</PoziomZaglebienia>
      <NazwaPozycji>Wartość firmy</NazwaPozycji>
      <Kwota>0</Kwota>
    </Pozycja>
  </Bilans>
  <RachunekZyskowIStrat>
    <Pozycja>
      <KodPozycji>RZiS_A</KodPozycji>
      <PoziomZaglebienia>2</PoziomZaglebienia>
      <NazwaPozycji>Przychody netto ze sprzedaży</NazwaPozycji>
      <Kwota>108317454729.00</Kwota>
    </Pozycja>
  </RachunekZyskowIStrat>
</SprawozdanieFinansowe>`;

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
    expect(statement.sekcje.map((s) => s.sekcja)).toEqual(["Bilans", "RachunekZyskowIStrat"]);
    const bilans = statement.sekcje[0]!;
    expect(bilans.pozycje).toHaveLength(2);
    expect(bilans.pozycje[0]).toEqual({
      pozycja_szczegolowa: null,
      kod_pozycji: "Aktywa",
      poziom_zaglebienia: 1,
      nazwa_pozycji: "Aktywa razem",
      kwota: 30341528084,
    });
    expect(statement.sekcje[1]!.pozycje[0]!.kwota).toBe(108317454729);
  });

  it("handles empty sections", () => {
    const statement = parseSprawozdanie(SAMPLE_XML)!;
    expect(statement.sekcje.some((s) => s.sekcja === "ZestawienieZmianWKapitale")).toBe(false);
  });
});
