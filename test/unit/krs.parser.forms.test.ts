import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseOdpis } from "../../src/sources/krs/parser";

function loadFixture(name: string): unknown {
  return JSON.parse(readFileSync(join(process.cwd(), "test", "fixtures", name), "utf-8"));
}

describe("parseOdpis — legal-form variants", () => {
  it("parses a komandytowa (partners go to connections, not ownership)", () => {
    const report = parseOdpis(loadFixture("krs-komandytowa.json"))!;
    expect(report.company.legalForm).toBe("SPÓŁKA KOMANDYTOWA");
    expect(report.ownership).toHaveLength(0);
    const partners = report.connections.filter((c) => c.typPowiazania === "wspólnik");
    expect(partners.length).toBeGreaterThanOrEqual(2);
    expect(partners.some((p) => p.nazwa.includes("LIDL"))).toBe(true);
  });

  it("parses a jawna (partners as connections)", () => {
    const report = parseOdpis(loadFixture("krs-jawna.json"))!;
    expect(report.company.legalForm).toBe("SPÓŁKA JAWNA");
    expect(report.connections.some((c) => c.typPowiazania === "wspólnik")).toBe(true);
    expect(report.company.registrationDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("parses a stowarzyszenie (no pkd, supervisory organ)", () => {
    const report = parseOdpis(loadFixture("krs-stowarzyszenie.json"))!;
    expect(report.company.legalForm).toBe("STOWARZYSZENIE");
    expect(report.pkdCodes).toHaveLength(0);
    expect(report.connections.some((c) => c.typPowiazania === "reprezentacja")).toBe(true);
    expect(report.connections.some((c) => c.typPowiazania === "organ nadzoru")).toBe(true);
  });

  it("parses a fundacja (no pkd, organ sprawujacy nadzor)", () => {
    const report = parseOdpis(loadFixture("krs-fundacja.json"))!;
    expect(report.company.legalForm).toBe("FUNDACJA");
    expect(report.pkdCodes).toHaveLength(0);
    expect(report.connections.some((c) => c.typPowiazania === "organ nadzoru")).toBe(true);
  });

  it("derives ownership percentages for a sp. z o.o.", () => {
    const report = parseOdpis(loadFixture("krs-baselinker.json"))!;
    expect(report.ownership).toHaveLength(3);
    const total = report.ownership.reduce((sum, share) => sum + (share.procentUdzialow ?? 0), 0);
    expect(total).toBeCloseTo(100, 0);
  });

  it("parses a PSA (kapitalPSA, jedyny akcjonariusz 100%)", () => {
    const report = parseOdpis(loadFixture("krs-psa.json"))!;
    expect(report.company.legalForm).toBe("PROSTA SPÓŁKA AKCYJNA");
    expect(report.company.legalFormNormalized).toBe("PROSTA SPÓŁKA AKCYJNA");
    expect(report.company.capital).toBe(1);
    expect(report.ownership).toHaveLength(1);
    expect(report.ownership[0]!.procentUdzialow).toBe(100);
  });

  it("parses a spółka komandytowo-akcyjna (partner to connections, no ownership)", () => {
    const report = parseOdpis(loadFixture("krs-ska.json"))!;
    expect(report.company.legalForm).toBe("SPÓŁKA KOMANDYTOWO-AKCYJNA");
    expect(report.ownership).toHaveLength(0);
    expect(report.connections.some((c) => c.typPowiazania === "wspólnik")).toBe(true);
    expect(report.connections.some((c) => c.typPowiazania === "reprezentacja")).toBe(true);
  });

  it("parses a spółdzielnia (no ownership, organs)", () => {
    const report = parseOdpis(loadFixture("krs-spoldzielnia.json"))!;
    expect(report.company.legalForm).toBe("SPÓŁDZIELNIA");
    expect(report.ownership).toHaveLength(0);
    expect(report.connections.some((c) => c.typPowiazania === "reprezentacja")).toBe(true);
    expect(report.connections.some((c) => c.typPowiazania === "organ nadzoru")).toBe(true);
  });

  it("parses an oddział of a foreign enterprise", () => {
    const report = parseOdpis(loadFixture("krs-oddzial.json"))!;
    expect(report.company.legalForm).toBe("ODDZIAŁ ZAGRANICZNEGO PRZEDSIĘBIORCY");
    expect(report.company.nip).toBe("1080029241");
    expect(report.company.regon).toBe("54334787800000");
    expect(report.company.name).toContain("KPHG");
    expect(report.connections.some((c) => c.typPowiazania === "reprezentacja")).toBe(true);
  });
});
