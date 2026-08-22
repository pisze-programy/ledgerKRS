import { describe, expect, it } from "vitest";
import { pdfPositions } from "../../src/sources/rdf/pdf";

const SAMPLE = `BILANS
A. Aktywa razem 16 855 641,66
A. Aktywa trwałe 6 193 945,41
B. Aktywa obrotowe 10 661 696,25
Pasywa razem 16 855 641,66
A. Kapitał (fundusz) własny -32 890 677,18
B. Zobowiązania i rezerwy na zobowiązania 49 746 318,84

RACHUNEK ZYSKÓW I STRAT (wariant porównawczy)
A. Przychody netto ze sprzedaży i zrównane z nimi, w tym: 133 252 762,98
B. Koszty działalności operacyjnej 134 273 963,29
C. Zysk (strata) ze sprzedaży (A–B) -1 021 200,31
F. Zysk (strata) z działalności operacyjnej (C+D–E) -2 078 243,80
I. Zysk (strata) brutto (F+G–H) -3 014 231,10
J. Podatek dochodowy 0,00
L. Zysk (strata) netto (I–J–K) -3 014 231,10`;

describe("pdfPositions", () => {
  it("matches position names to numbers on the same line", () => {
    const positions = pdfPositions(SAMPLE, { layout: "SFJINZ", wariant: 2 });
    const byName = Object.fromEntries(positions.map((p) => [p.nazwa, p.kwota]));
    expect(byName["Aktywa razem"]).toBeCloseTo(16855641.66, 1);
    expect(byName["Aktywa obrotowe"]).toBeCloseTo(10661696.25, 1);
    expect(byName["Przychody netto ze sprzedaży i zrównane z nimi, w tym:"]).toBeCloseTo(133252762.98, 0);
    expect(byName["Zysk (strata) netto (I–J–K)"] ?? byName["Zysk (strata) netto"]).toBeCloseTo(-3014231.1, 0);
    expect(byName["Podatek dochodowy"]).toBeCloseTo(0, 1);
  });
});
