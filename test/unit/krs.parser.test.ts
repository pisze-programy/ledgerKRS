import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseOdpis } from "../../src/sources/krs/parser";

function loadFixture(name: string): unknown {
  return JSON.parse(readFileSync(join(process.cwd(), "test", "fixtures", name), "utf-8"));
}

describe("parseOdpis", () => {
  it("returns null for empty input", () => {
    expect(parseOdpis(null)).toBeNull();
    expect(parseOdpis({})).toBeNull();
  });

  it("parses an SA odpis (Jeronimo Martins)", () => {
    const report = parseOdpis(loadFixture("krs-jeronimo.json"))!;
    expect(report).not.toBeNull();
    expect(report.company.krs).toBe("0000222483");
    expect(report.company.nip).toBe("7791011327");
    expect(report.company.regon).toBe("63030302300000");
    expect(report.company.name).toContain("JERONIMO MARTINS");
    expect(report.company.legalForm).toBe("SPÓŁKA AKCYJNA");
    expect(report.company.registrationDate).toBe("2004-12-01");
    expect(report.company.capital).toBe(798214120);
    expect(report.company.capitalCurrency).toBe("PLN");
    expect(report.company.address?.city).toBe("KOSTRZYN");
    expect(report.company.address?.voivodeship).toBe("WIELKOPOLSKIE");
  });

  it("parses connections (SA board + supervisory)", () => {
    const report = parseOdpis(loadFixture("krs-jeronimo.json"))!;
    const board = report.connections.filter((c) => c.typPowiazania === "reprezentacja");
    const supervisory = report.connections.filter((c) => c.typPowiazania === "organ nadzoru");
    expect(board.length).toBeGreaterThan(0);
    expect(supervisory.length).toBeGreaterThan(0);
    expect(board[0]!.funkcja).toBe("PREZES ZARZĄDU");
  });

  it("parses ownership for an SA (jedyny akcjonariusz)", () => {
    const report = parseOdpis(loadFixture("krs-jeronimo.json"))!;
    expect(report.ownership.length).toBeGreaterThan(0);
    expect(report.ownership[0]!.nazwa).toContain("WARTA - RETAIL");
  });

  it("parses a sp. z o.o. odpis (BaseLinker)", () => {
    const report = parseOdpis(loadFixture("krs-baselinker.json"))!;
    expect(report.company.krs).toBe("0000795513");
    expect(report.company.legalForm).toBe("SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ");
    expect(report.company.capital).toBe(3620000);
    const shareholders = report.ownership.filter((o) => o.nazwa);
    expect(shareholders.some((o) => o.nazwa!.includes("OPEN STARSHINE"))).toBe(true);
  });

  it("parses PKD codes and statements", () => {
    const report = parseOdpis(loadFixture("krs-jeronimo.json"))!;
    expect(report.pkdCodes.length).toBeGreaterThan(0);
    expect(report.pkdCodes.some((p) => p.code.length >= 6)).toBe(true);
    expect(report.statements.length).toBeGreaterThan(0);
    expect(report.statements[0]!.filedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("puts the main (przeważająca) PKD first, matching the odpis order", () => {
    const report = parseOdpis(loadFixture("krs-concrete-texture.json"))!;
    expect(report.pkdCodes[0]!.code).toBe("62.01.Z");
    expect(report.pkdCodes[0]!.description).toContain("OPROGRAMOWANIEM");
    expect(report.pkdCodes.map((p) => p.code)).toEqual(["62.01.Z", "23.62.Z", "23.61.Z", "23.69.Z"]);
  });
});
