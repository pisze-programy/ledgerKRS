import { describe, expect, it } from "vitest";
import { aggregatePersons, fullName, parsePersons } from "../../src/sources/msig/persons";
import { enrichConnections, enrichOwnership } from "../../src/report/msigEnrich";
import { CONNECTION, ENTITY } from "../../src/domain/vocab";
import type { Connection, OwnershipShare } from "../../src/domain/types";

const ANNOUNCEMENT = `Rub. 7. Dane wspólników 1 1. BŁASZCZYK 2. KRYSTIAN 3. 92061312457 5. 50 UDZIAŁÓW 6. NIE 2 1. BŁASZCZYK 2. EWA TERESA 3. 62051615545 5. 50 UDZIAŁÓW 6. NIE
Dz. 2. Rub. 1. Organ uprawniony 1 1. ZARZĄD 2. DO SKŁADANIA OŚWIADCZEŃ SAMODZIELNIE. PRub. Dane osób wchodzących w skład organu 1 1. BŁASZCZYK 2. KRYSTIAN 3. 92061312457 5. CZŁONEK ZARZĄDU 6. NIE 2 1. BŁASZCZYK 2. EWA TERESA 3. 62051615545 5. CZŁONEK ZARZĄDU 6. NIE`;

describe("aggregatePersons", () => {
  it("uses the latest announcement per person type", () => {
    const older = "Rub. 7. Dane wspólników 1 1. NOWAK 2. JAN 3. 11111111111 5. 10 UDZIAŁÓW 6. NIE";
    const newer = ANNOUNCEMENT;
    const persons = aggregatePersons([older, newer]);
    const wspolnicy = persons.filter((p) => p.typ === "wspólnik");
    expect(wspolnicy.map((p) => p.nazwisko)).toEqual(["BŁASZCZYK", "BŁASZCZYK"]);
  });

  it("returns empty for empty input", () => {
    expect(aggregatePersons([])).toEqual([]);
  });
});

describe("fullName", () => {
  it("joins surname and given names", () => {
    expect(fullName({ typ: "organ", nazwisko: "BŁASZCZYK", imiona: "KRYSTIAN", pesel: "x", funkcja: null, udzialy: null })).toBe("BŁASZCZYK KRYSTIAN");
  });
});

describe("enrichConnections", () => {
  it("replaces masked person connections with MSiG names and keeps other rows", () => {
    const connections: Connection[] = [
      { typPodmiotu: ENTITY.Osoba, nazwa: "B******** E**", typPowiazania: CONNECTION.Reprezentacja, funkcja: "CZŁONEK ZARZĄDU" },
      { typPodmiotu: ENTITY.Osoba, nazwa: "B******** K*******", typPowiazania: CONNECTION.Reprezentacja, funkcja: "CZŁONEK ZARZĄDU" },
      { typPodmiotu: ENTITY.Organizacja, nazwa: "ORLEN S.A.", typPowiazania: CONNECTION.Wspolnik, idPodmiotu: "0000028860" },
    ];
    const persons = parsePersons(ANNOUNCEMENT);
    const enriched = enrichConnections(connections, persons);
    const reprezentacja = enriched.filter((c) => c.typPowiazania === CONNECTION.Reprezentacja);
    expect(reprezentacja.map((c) => c.nazwa)).toEqual(["BŁASZCZYK KRYSTIAN", "BŁASZCZYK EWA TERESA"]);
    expect(reprezentacja[0]!.funkcja).toBe("CZŁONEK ZARZĄDU");
    // company owner stays
    expect(enriched.some((c) => c.nazwa === "ORLEN S.A.")).toBe(true);
    expect(enriched).toHaveLength(3);
  });

  it("returns connections unchanged when there are no persons", () => {
    const connections: Connection[] = [{ typPodmiotu: ENTITY.Osoba, nazwa: "B********", typPowiazania: CONNECTION.Reprezentacja }];
    expect(enrichConnections(connections, [])).toEqual(connections);
  });
});

describe("enrichOwnership", () => {
  it("replaces masked ownership with MSiG shareholders and computes percentages", () => {
    const ownership: OwnershipShare[] = [
      { typPodmiotu: ENTITY.Organizacja, nazwa: "B******** E**", idPodmiotu: null },
      { typPodmiotu: ENTITY.Organizacja, nazwa: "B******** K*******", idPodmiotu: null },
      { typPodmiotu: ENTITY.Organizacja, nazwa: "ORLEN S.A.", idPodmiotu: "0000028860" },
    ];
    const persons = parsePersons(ANNOUNCEMENT);
    const enriched = enrichOwnership(ownership, persons);
    const os = enriched.filter((s) => s.typPodmiotu === ENTITY.Osoba);
    expect(os.map((s) => s.nazwa)).toEqual(["BŁASZCZYK KRYSTIAN", "BŁASZCZYK EWA TERESA"]);
    expect(os[0]!.procentUdzialow).toBe(50);
    expect(enriched.some((s) => s.nazwa === "ORLEN S.A.")).toBe(true);
  });

  it("keeps ownership unchanged when no shareholders parsed", () => {
    const ownership: OwnershipShare[] = [{ typPodmiotu: ENTITY.Osoba, nazwa: "B********", procentUdzialow: 50 }];
    expect(enrichOwnership(ownership, [])).toEqual(ownership);
  });
});
