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
});
