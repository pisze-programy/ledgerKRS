import { describe, expect, it } from "vitest";
import { fiscalYearOf, parsePeriod, periodClassOf, periodDays } from "../../src/sources/rdf/period";

describe("parsePeriod", () => {
  it("splits a FROM_TO okres into ISO dates", () => {
    const { from, to } = parsePeriod("2025-01-01_2025-12-31");
    expect(from?.getUTCFullYear()).toBe(2025);
    expect(to?.getUTCFullYear()).toBe(2025);
  });

  it("returns nulls for malformed / missing periods", () => {
    expect(parsePeriod(null)).toEqual({ from: null, to: null });
    expect(parsePeriod("garbage")).toEqual({ from: null, to: null });
    expect(parsePeriod("2025-01-01").to).toBeNull();
    expect(parsePeriod("2025/01/01_2025/12/31")).toEqual({ from: null, to: null });
  });
});

describe("fiscalYearOf — BizRaport fiscal-year label", () => {
  it("labels a calendar-year period with its own year", () => {
    expect(fiscalYearOf("2025-01-01_2025-12-31")).toBe(2025);
  });

  it("labels a non-calendar 12-month period by the year containing its bulk (Oct-Sep -> end year)", () => {
    // 2017-10-01..2018-09-30 has its midpoint in 2018 -> BizRaport reports it as 2018.
    expect(fiscalYearOf("2017-10-01_2018-09-30")).toBe(2018);
    expect(fiscalYearOf("2017-10-01_2018-09-30")).not.toBe(2017);
  });

  it("labels a 16-month transitional period by its start year (2020-01-01..2021-04-30 -> 2020)", () => {
    expect(fiscalYearOf("2020-01-01_2021-04-30")).toBe(2020);
  });

  it("labels a short partial period by its majority year", () => {
    expect(fiscalYearOf("2021-07-01_2021-12-31")).toBe(2021);
  });

  it("handles leap-year boundaries", () => {
    expect(fiscalYearOf("2020-01-01_2020-12-31")).toBe(2020);
    expect(fiscalYearOf("2019-10-01_2020-09-30")).toBe(2020);
  });

  it("returns null for unparseable periods", () => {
    expect(fiscalYearOf(null)).toBeNull();
    expect(fiscalYearOf(undefined)).toBeNull();
    expect(fiscalYearOf("")).toBeNull();
    expect(fiscalYearOf("abc")).toBeNull();
  });
});

describe("periodDays", () => {
  it("counts the days between two ISO dates", () => {
    expect(periodDays(new Date(Date.UTC(2025, 0, 1)), new Date(Date.UTC(2025, 11, 31)))).toBe(364);
    expect(periodDays(new Date(Date.UTC(2020, 0, 1)), new Date(Date.UTC(2021, 3, 30)))).toBe(485);
  });
});

describe("periodClassOf", () => {
  it("classifies a calendar year as annual", () => {
    expect(periodClassOf("2025-01-01_2025-12-31")).toBe("annual");
    expect(periodClassOf("2017-10-01_2018-09-30")).toBe("annual");
  });

  it("classifies a 16-month fiscal-year change as transitional", () => {
    expect(periodClassOf("2020-01-01_2021-04-30")).toBe("transitional");
  });

  it("classifies a short period as partial", () => {
    expect(periodClassOf("2021-07-01_2021-12-31")).toBe("partial");
    expect(periodClassOf("2016-07-01_2016-12-31")).toBe("partial");
  });

  it("returns null for unparseable periods", () => {
    expect(periodClassOf(null)).toBeNull();
    expect(periodClassOf("not-a-period")).toBeNull();
  });
});
