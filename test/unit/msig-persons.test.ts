import { describe, expect, it } from "vitest";
import { normalizeText, parsePersons, maskPesel, maskPeselsInText } from "../../src/sources/msig/persons";

const REGISTRATION = `W dniu 15.02.2022 dokonano wpisu do rejestru KRS nr 1 następującej treści:
Dz. 1. Rub. 1. Dane podmiotu 1. SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ 3. CONCRETE TEXTURE SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ 5. NIE 6. NIE
Rub. 7. Dane wspólników 1 1. BŁASZCZYK 2. KRYSTIAN 3. 92061312457 5. 50 UDZIAŁÓW O ŁĄCZNEJ WARTOŚCI 2500 PLN 6. NIE 2 1. BŁASZCZYK 2. EWA TERESA 3. 62051615545 5. 50 UDZIAŁÓW O ŁĄCZNEJ WARTOŚCI 2500 PLN 6. NIE
Dz. 2. Rub. 1. Organ uprawniony do reprezentacji 1 1. ZARZĄD 2. DO SKŁADANIA OŚWIADCZEŃ W IMIENIU SPÓŁKI JEST UPOWAŻNIONY KAŻDY Z CZŁONKÓW ZARZĄDU SAMODZIELNIE. PRub. Dane osób wchodzących w skład organu 1 1. BŁASZCZYK 2. KRYSTIAN 3. 92061312457 5. CZŁONEK ZARZĄDU 6. NIE 2 1. BŁASZCZYK 2. EWA TERESA 3. 62051615545 5. CZŁONEK ZARZĄDU 6. NIE`;

describe("normalizeText", () => {
  it("collapses whitespace runs", () => {
    expect(normalizeText("A\n  B   C")).toBe("A B C");
  });
});

describe("maskPesel", () => {
  it("masks an 11-digit PESEL", () => {
    expect(maskPesel("92061312457")).toBe("***********");
  });
  it("masks a shorter identifier", () => {
    expect(maskPesel("1234")).toBe("*********");
  });
});

describe("maskPeselsInText", () => {
  it("replaces every 11-digit PESEL in the text", () => {
    const text = "wspólnik 92061312457 i 62051615545 koniec";
    const masked = maskPeselsInText(text);
    expect(masked.match(/\d{11}/g)).toBeNull();
    expect(masked).toBe("wspólnik *********** i *********** koniec");
  });
  it("leaves other numbers intact", () => {
    expect(maskPeselsInText("kwota 2500 PLN")).toBe("kwota 2500 PLN");
  });
});

describe("parsePersons", () => {
  it("parses shareholders and organ members with roles and shares", () => {
    const persons = parsePersons(REGISTRATION);
    expect(persons).toHaveLength(4);
    const wspolnicy = persons.filter((p) => p.typ === "wspólnik");
    const organ = persons.filter((p) => p.typ === "organ");

    expect(wspolnicy).toHaveLength(2);
    expect(wspolnicy[0]).toMatchObject({
      nazwisko: "BŁASZCZYK",
      imiona: "KRYSTIAN",
      pesel: "92061312457",
      udzialy: 50,
      funkcja: null,
    });
    expect(wspolnicy[1]!.imiona).toBe("EWA TERESA");
    expect(wspolnicy[1]!.udzialy).toBe(50);

    expect(organ).toHaveLength(2);
    expect(organ[0]!.funkcja).toBe("CZŁONEK ZARZĄDU");
    expect(organ[1]!.funkcja).toBe("CZŁONEK ZARZĄDU");
  });

  it("returns an empty list for text without persons", () => {
    expect(parsePersons("Rub. 1. Dane podmiotu 3. SPÓŁKA")).toEqual([]);
    expect(parsePersons("")).toEqual([]);
  });

  it("splits persons even with irregular spacing", () => {
    const text = "Rub. 7. Dane wspólników 1 1. NOWAK 2. JAN 3. 12345678901 5. 10 UDZIAŁÓW 6. NIE 2 1. NOWAK 2. ANNA 3. 10987654321 5. 10 UDZIAŁÓW 6. NIE";
    const persons = parsePersons(text);
    expect(persons).toHaveLength(2);
    expect(persons[1]!.nazwisko).toBe("NOWAK");
    expect(persons[1]!.imiona).toBe("ANNA");
  });
});
