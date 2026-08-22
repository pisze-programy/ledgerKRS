import { describe, expect, it } from "vitest";
import { chainFromCodes, rzisRoles } from "../../src/sources/rdf/rzis";
import { normalizeName, namePhrase, findRoleByDict, dictNamesFor } from "../../src/sources/rdf/rzis/matching";
import { parseSprawozdanie } from "../../src/sources/rdf/parser";
import { statementMeta } from "../../src/sources/rdf/layouts";
import fs from "fs";
import path from "path";

describe("chainFromCodes — value-chain RZiS (universal)", () => {
  it("decodes the standard kalkulacyjny/porównawczy chain (GOING-style)", () => {
    const r = chainFromCodes({
      A: 133252762.98, B: 134273963.29, C: -1021200.31, D: 1128772.38,
      E: 2185815.87, F: -2078243.8, G: 115432.34, H: 1051419.64,
      I: -3014231.1, J: 0, K: 0, L: -3014231.1,
    })!;
    expect(r.przychody).toBeCloseTo(133252762.98, 1);
    expect(r.zyskOperacyjny).toBeCloseTo(-2078243.8, 1);
    expect(r.zyskBrutto).toBeCloseTo(-3014231.1, 1);
    expect(r.zyskNetto).toBeCloseTo(-3014231.1, 1);
  });

  it("decodes the old-schema porównawczy chain where H/I/J = brutto/podatek/netto (CONNER 2019)", () => {
    const r = chainFromCodes({
      A: 6167716.72, B: 6187802.72, C: -20086, D: 42306.36, E: 233.23,
      G: 2333.33, H: 19732.99, I: 5482, J: 14250.99,
    })!;
    expect(r.zyskOperacyjny).toBeCloseTo(21987.13, 1);
    expect(r.zyskBrutto).toBeCloseTo(19732.99, 1);
    expect(r.podatek).toBeCloseTo(5482, 1);
    expect(r.zyskNetto).toBeCloseTo(14250.99, 1);
  });

  it("decodes CONNER 2025 (H/I/J with F/G items)", () => {
    const r = chainFromCodes({
      A: 6148188.93, B: 6015357.39, C: 132831.54, D: 790.58, E: 25038.69,
      F: 175.6, G: 23961.48, H: 84797.55, I: 10256, J: 74541.55,
    })!;
    expect(r.zyskOperacyjny).toBeCloseTo(108583.43, 1);
    expect(r.zyskBrutto).toBeCloseTo(84797.55, 1);
    expect(r.podatek).toBeCloseTo(10256, 1);
    expect(r.zyskNetto).toBeCloseTo(74541.55, 1);
  });

  it("does NOT confuse przychody/koszty with brutto/podatek in simplified statements (fundacja A−B=netto)", () => {
    const r = chainFromCodes({
      A: 15300, B: 11254.13, C: 0, D: 0, E: 0, F: 0, G: 0, H: 0, I: 0,
      J: 0, K: 0, L: 0, M: 0, N: 0, O: 4045.87,
    })!;
    expect(r.zyskNetto).toBeCloseTo(4045.87, 1);
    expect(r.zyskBrutto).not.toBe(15300);
    expect(r.podatek).not.toBe(11254.13);
  });

  it("handles the JednostkaOp statutory chain (netto = last letter)", () => {
    const r = chainFromCodes({
      A: 1837870.24, B: 1813603.5, C: 24266.74, D: 102619, E: 52897.92,
      F: 49721.08, G: 21806.94, H: 52180.88, I: 0, J: 0, K: 12564.66,
      L: 0, M: 64745.54, N: 0, O: 64745.54,
    })!;
    expect(r.zyskNetto).toBeCloseTo(64745.54, 1);
    expect(r.zyskBrutto).toBeCloseTo(64745.54, 1);
  });

  it("returns null for too few letters", () => {
    expect(chainFromCodes({ A: 1, B: 2 })).toBeNull();
  });
});

describe("rzisRoles — dict + chain fallback on real fixtures", () => {
  it("extracts roles for the GOING fixture", () => {
    const xml = fs.readFileSync(path.join(__dirname, "..", "fixtures", "rdf-jednostka-inna.xml"), "utf8");
    const meta = statementMeta(xml);
    const r = rzisRoles(parseSprawozdanie(xml)!, meta);
    expect(r.zyskOperacyjny).toBeCloseTo(-2078243.8, 1);
    expect(r.zyskNetto).toBeCloseTo(-3014231.1, 1);
  });
});

describe("dict name matching (rzis/matching)", () => {
  it("normalizes Polish diacritics incl. ł (U+0142)", () => {
    expect(normalizeName("działalności operacyjnej")).toBe("dzialalnosci operacyjnej");
    expect(normalizeName("sprzedaży")).toBe("sprzedazy");
  });

  it("namePhrase strips only the trailing formula parenthetical, not '(strata)'", () => {
    expect(namePhrase("Zysk (strata) z działalności operacyjnej (F + G - H)")).toBe("zysk (strata) z dzialalnosci operacyjnej");
    expect(namePhrase("Zysk (strata) brutto (M - N + O +/- P)")).toBe("zysk (strata) brutto");
  });

  it("findRoleByDict prefers the exact phrase over 'brutto ze sprzedaży'", () => {
    const names = new Map<string, string>([
      ["C", "Zysk (strata) brutto ze sprzedaży (A - B)"],
      ["R", "Zysk (strata) brutto (M - N + O +/- P)"],
    ]);
    expect(findRoleByDict(names, "zysk (strata) brutto")).toBe("R");
  });

  it("dictNamesFor covers consolidated letters up to W", () => {
    const meta = { layout: "SFSINZ" as const, wariant: 2, version: null };
    const names = dictNamesFor(meta, "RZiSKalk");
    expect(names.get("W")).toContain("netto");
    expect(names.get("S")).toContain("Podatek");
  });
});

describe("rzisRoles — dict acceptance rules", () => {
  it("accepts a dict result when the podatek letter exists in the dict but not in the statement (0000085314 2021: brutto=I)", () => {
    const xml = fs.readFileSync(path.join(__dirname, "..", "fixtures", "rdf-corpus", "0000085314", "20210101_20211231.xml"), "utf8");
    const meta = statementMeta(xml);
    const r = rzisRoles(parseSprawozdanie(xml)!, meta);
    expect(r.source).toBe("dict");
    expect(r.zyskBrutto).toBeCloseTo(54890.07, 2);
    expect(r.zyskOperacyjny).toBeCloseTo(73884.38, 2);
  });
});
