import { describe, expect, it } from "vitest";
import { PbplIndicator } from "../../src/sources/pbpl/parse";
import { detectScale, annualValues, toFullValue, annualFullValues } from "../../src/sources/pbpl/period";

function indicator(series: PbplIndicator["series"], name = "Aktywa (tys. zł)"): PbplIndicator {
  return { name, series };
}

describe("detectScale", () => {
  it("detects thousands in the indicator name", () => {
    expect(detectScale("Aktywa (tys. zł)")).toBe(1000);
    expect(detectScale("Kapitał własny (tys. zł)")).toBe(1000);
  });

  it("detects a plain PLN indicator", () => {
    expect(detectScale("Wynik na akcję (zł)")).toBe(1);
    expect(detectScale("Zysk (strata) netto na jedną akcję zwykłą")).toBe(1);
  });
});

describe("annualValues", () => {
  it("takes the fourth-quarter cumulative value as the annual value", () => {
    const series: PbplIndicator["series"] = [
      { period: "I Q 2020", quarter: 1, year: 2020, value: 210000000 },
      { period: "II Q 2020", quarter: 2, year: 2020, value: 222380996 },
      { period: "III Q 2020", quarter: 3, year: 2020, value: 230000000 },
      { period: "IV Q 2020", quarter: 4, year: 2020, value: 233217182 },
    ];
    expect(annualValues(indicator(series))).toEqual([{ year: 2020, value: 233217182 }]);
  });

  it("returns years sorted ascending", () => {
    const series: PbplIndicator["series"] = [
      { period: "IV Q 2019", quarter: 4, year: 2019, value: 200 },
      { period: "IV Q 2021", quarter: 4, year: 2021, value: 400 },
      { period: "IV Q 2020", quarter: 4, year: 2020, value: 300 },
    ];
    expect(annualValues(indicator(series)).map((a) => a.year)).toEqual([2019, 2020, 2021]);
  });

  it("omits a year without a fourth-quarter value", () => {
    const series: PbplIndicator["series"] = [
      { period: "III Q 2020", quarter: 3, year: 2020, value: 5 },
      { period: "IV Q 2021", quarter: 4, year: 2021, value: 7 },
    ];
    expect(annualValues(indicator(series))).toEqual([{ year: 2021, value: 7 }]);
  });

  it("omits a year whose fourth-quarter value is null", () => {
    const series: PbplIndicator["series"] = [
      { period: "IV Q 2020", quarter: 4, year: 2020, value: null },
      { period: "IV Q 2019", quarter: 4, year: 2019, value: 1 },
    ];
    expect(annualValues(indicator(series))).toEqual([{ year: 2019, value: 1 }]);
  });

  it("returns an empty list for a series without fourth quarters", () => {
    const series: PbplIndicator["series"] = [{ period: "II Q 2020", quarter: 2, year: 2020, value: 5 }];
    expect(annualValues(indicator(series))).toEqual([]);
  });
});

describe("toFullValue", () => {
  it("scales a value by the given unit", () => {
    expect(toFullValue(233217182, 1000)).toBe(233217182000);
    expect(toFullValue(5, 1)).toBe(5);
  });

  it("passes null through", () => {
    expect(toFullValue(null, 1000)).toBeNull();
  });
});

describe("annualFullValues", () => {
  it("converts thousands to full PLN", () => {
    const series: PbplIndicator["series"] = [{ period: "IV Q 2020", quarter: 4, year: 2020, value: 233217182 }];
    expect(annualFullValues(indicator(series))).toEqual([{ year: 2020, value: 233217182000 }]);
  });

  it("uses the explicit scale when given", () => {
    const series: PbplIndicator["series"] = [{ period: "IV Q 2020", quarter: 4, year: 2020, value: 10 }];
    expect(annualFullValues(indicator(series, "Wynik na akcję (zł)"), 1)).toEqual([{ year: 2020, value: 10 }]);
  });
});
