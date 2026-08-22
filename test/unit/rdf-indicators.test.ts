import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { parseSprawozdanie } from "../../src/sources/rdf/parser";
import { statementMeta } from "../../src/sources/rdf/layouts";
import { rzisRoles } from "../../src/sources/rdf/rzis";
import { extractFinancialInput } from "../../src/sources/rdf/indicators";

function load(name: string): string {
  return fs.readFileSync(path.join(__dirname, "..", "fixtures", name), "utf8");
}

describe("rzisRoles", () => {
  it("extracts RZiS roles via the value chain (GOING)", () => {
    const xml = load("rdf-jednostka-inna.xml");
    const meta = statementMeta(xml);
    const roles = rzisRoles(parseSprawozdanie(xml)!, meta);
    expect(roles.przychody).toBeCloseTo(133252762.98, 2);
    expect(roles.zyskOperacyjny).toBeCloseTo(-2078243.8, 1);
    expect(roles.zyskNetto).toBeCloseTo(-3014231.1, 1);
  });

  it("extracts RZiS roles via the value chain (JPK_SF, matches BizRaport)", () => {
    const xml = load("rdf-xades-jpk.xml");
    const meta = statementMeta(xml);
    const roles = rzisRoles(parseSprawozdanie(xml)!, meta);
    expect(roles.przychody).toBeCloseTo(38609746.87, 1);
    expect(roles.zyskOperacyjny).toBeCloseTo(55955.74, 1);
    expect(roles.zyskNetto).toBeCloseTo(86544.95, 1);
  });
});

describe("extractFinancialInput", () => {
  it("produces a FinancialInput that feeds computeIndicators (amortyzacja from RZiS.B_I)", () => {
    const xml = load("rdf-xades-jpk.xml");
    const meta = statementMeta(xml);
    const year = extractFinancialInput(parseSprawozdanie(xml)!, meta)!;
    expect(year.input.amortization).toBeCloseTo(5241.08, 2);
    expect(year.input.revenue).toBeCloseTo(38720880.34, 1);
    expect(year.input.salesRevenue).toBeCloseTo(38609746.87, 1);
    expect(year.input.netProfit).toBeCloseTo(86544.95, 1);
    expect(year.input.totalAssets).toBeCloseTo(8046252.06, 1);
  });

  it("extracts balance-sheet positions for the legacy fixture", () => {
    const xml = load("rdf-jednostka-inna.xml");
    const meta = statementMeta(xml);
    const year = extractFinancialInput(parseSprawozdanie(xml)!, meta)!;
    expect(year.input.totalAssets).toBeCloseTo(16855641.66, 1);
    expect(year.input.equity).toBeCloseTo(-32890677.18, 1);
  });

  it("applies BizRaport revenue definitions (income letters from the dict; RZiSPor = A+D+G)", () => {
    const xml = load("rdf-jednostka-inna.xml");
    const meta = statementMeta(xml);
    const year = extractFinancialInput(parseSprawozdanie(xml)!, meta)!;
    expect(year.input.salesRevenue).toBeCloseTo(133252762.98, 1);
    expect(year.input.operatingRevenue).toBeCloseTo(134381535.36, 1);
    expect(year.input.revenue).toBeCloseTo(134496967.7, 1);
    expect(year.input.costOfGoodsSold).toBeCloseTo(134273963.29, 1);
  });

  it("handles simplified porównawczy (old Mala/Mikro): revenue = A+D+F, brutto = op+F-G, podatek=I, netto=J (CONNER 2024 vs BizRaport)", () => {
    const xml = fs.readFileSync(path.join(__dirname, "..", "fixtures", "rdf-corpus", "0000320584", "20240101_20241231.xml"), "utf8");
    const meta = statementMeta(xml);
    const year = extractFinancialInput(parseSprawozdanie(xml)!, meta)!;
    expect(year.input.revenue).toBeCloseTo(5917627.34, 2);
    expect(year.input.salesRevenue).toBeCloseTo(5912524.58, 2);
    expect(year.input.operatingRevenue).toBeCloseTo(5917263.99, 2);
    expect(year.input.costOfGoodsSold).toBeCloseTo(5618153.79, 2);
    expect(year.input.operatingProfit).toBeCloseTo(99708.57, 2);
    expect(year.input.grossProfit).toBeCloseTo(83210.77, 2);
    expect(year.input.incomeTax).toBeCloseTo(9945, 2);
    expect(year.input.netProfit).toBeCloseTo(73265.77, 2);
  });

  it("handles old-schema JednostkaOp statutory RZiS: op=H, brutto=M, netto=O, podatek=0, revenue=A+D+I+K (0000278980 2018 vs BizRaport)", () => {
    const xml = fs.readFileSync(path.join(__dirname, "..", "fixtures", "rdf-corpus", "0000278980", "20180101_20181231.xml"), "utf8");
    const meta = statementMeta(xml);
    expect(meta.layout).toBe("SFJOPZ");
    const year = extractFinancialInput(parseSprawozdanie(xml)!, meta)!;
    expect(year.input.revenue).toBeCloseTo(1183737.79, 2);
    expect(year.input.operatingRevenue).toBeCloseTo(1183735.79, 2);
    expect(year.input.costOfGoodsSold).toBeCloseTo(1134144.01, 2);
    expect(year.input.operatingProfit).toBeCloseTo(4131.42, 2);
    expect(year.input.grossProfit).toBeCloseTo(3924.62, 2);
    expect(year.input.incomeTax).toBe(0);
    expect(year.input.netProfit).toBeCloseTo(3924.62, 2);
  });

  it("handles truncated Mikro (A..F, no H..L): revenue = A+C, netto = last letter (0000554503 2021 vs BizRaport)", () => {
    const xml = fs.readFileSync(path.join(__dirname, "..", "fixtures", "rdf-corpus", "0000554503", "20210101_20211231.xml"), "utf8");
    const meta = statementMeta(xml);
    const year = extractFinancialInput(parseSprawozdanie(xml)!, meta)!;
    expect(year.input.revenue).toBeCloseTo(1441965.6, 2);
    expect(year.input.salesRevenue).toBeCloseTo(1432600.72, 2);
    expect(year.input.costOfGoodsSold).toBeCloseTo(1428261.14, 2);
    expect(year.input.netProfit).toBeCloseTo(8691.07, 2);
  });

  it("handles consolidated group statement (SFSINZ, kalk A..W): revenue=A+G+J, op=I, brutto=R, podatek=S, netto=W — matches BizRaport (Totalizator 2025)", () => {
    const xml = fs.readFileSync(path.join(__dirname, "..", "fixtures", "rdf-consolidated-2025.xml"), "utf8");
    const meta = statementMeta(xml);
    expect(meta.layout).toBe("SFSINZ");
    const year = extractFinancialInput(parseSprawozdanie(xml)!, meta)!;
    expect(year.input.revenue).toBeCloseTo(89840026952.21, 2);
    expect(year.input.operatingRevenue).toBeCloseTo(89740566299.4, 2);
    expect(year.input.operatingProfit).toBeCloseTo(751416409.1, 2);
    expect(year.input.grossProfit).toBeCloseTo(823900112.1, 2);
    expect(year.input.incomeTax).toBeCloseTo(155251816, 2);
    expect(year.input.netProfit).toBeCloseTo(668648296.1, 2);
    expect(year.input.totalAssets).toBeCloseTo(3688572244.15, 2);
  });
});
