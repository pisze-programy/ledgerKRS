import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseSprawozdanie } from "../../src/sources/rdf/parser";

const SECTION_ORDER = ["Bilans", "Rachunek zysków i strat", "Rachunek przepływów pieniężnych", "Zestawienie zmian w kapitale"];
const FIXTURES = ["sprawozdania-jeronimo.json", "sprawozdania-baselinker.json", "sprawozdania-small.json", "sprawozdania-komandytowa.json"];

function load(name: string): { data: { krs?: string; okresy: { okres_sprawozdawczy?: string; rok?: number | null; sekcje: { sekcja: string; pozycje: Record<string, unknown>[] }[] }[] }[] } {
  return JSON.parse(readFileSync(join(process.cwd(), "test", "fixtures", "bizraport", name), "utf-8"));
}

describe("sprawozdania parity with BizRaport", () => {
  for (const fixture of FIXTURES) {
    it(`${fixture} matches the BizRaport statement shape`, () => {
      const data = load(fixture).data;
      expect(data.length).toBeGreaterThan(0);
      const okresy = data[0]!.okresy;
      expect(okresy.length).toBeGreaterThan(0);
      for (const okres of okresy) {
        expect(okres.okres_sprawozdawczy).toMatch(/^\d{2}-\d{2}-\d{4}_\d{2}-\d{2}-\d{4}$/);
        expect(okres.sekcje.length).toBeGreaterThan(0);
        const names = okres.sekcje.map((section) => section.sekcja);
        expect(names).toEqual([...names].sort((a, b) => SECTION_ORDER.indexOf(a) - SECTION_ORDER.indexOf(b)));
        for (const name of names) {
          expect(SECTION_ORDER).toContain(name);
        }
        for (const section of okres.sekcje) {
          expect(section.pozycje.length).toBeGreaterThan(0);
          for (const position of section.pozycje) {
            expect(position.kwota === null || typeof position.kwota === "number").toBe(true);
            expect(position.kod_pozycji).toBeTruthy();
            if (section.sekcja === "Bilans") {
              expect(position.pozycja_szczegolowa).toBeTruthy();
            }
          }
        }
      }
    });
  }

  it("our parser emits the same position field names", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<SprawozdanieFinansowe>
  <OkresOd>2025-01-01</OkresOd>
  <OkresDo>2025-12-31</OkresDo>
  <Bilans>
    <Pozycja>
      <PozycjaSzczegolowa>Aktywa</PozycjaSzczegolowa>
      <KodPozycji>Aktywa</KodPozycji>
      <PoziomZaglebienia>1</PoziomZaglebienia>
      <NazwaPozycji>Aktywa razem</NazwaPozycji>
      <Kwota>123.45</Kwota>
    </Pozycja>
  </Bilans>
</SprawozdanieFinansowe>`;
    const statement = parseSprawozdanie(xml)!;
    const ourKeys = Object.keys(statement.sekcje[0]!.pozycje[0]!).sort();
    const bizKeys = Object.keys(load("sprawozdania-small.json").data[0]!.okresy[0]!.sekcje[0]!.pozycje[0]!).sort();
    expect(ourKeys).toEqual(bizKeys);
    expect(statement.sekcje[0]!.sekcja).toBe("Bilans");
  });
});
