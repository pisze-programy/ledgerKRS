import { describe, expect, it } from "vitest";
import { padKrs, toIsoDate, toNumber } from "../../src/lib/normalize";

describe("padKrs", () => {
  it("pads short krs to 10 digits", () => {
    expect(padKrs("123")).toBe("0000000123");
    expect(padKrs("0000222483")).toBe("0000222483");
  });

  it("strips non-digits", () => {
    expect(padKrs("KRS 0000222483")).toBe("0000222483");
    expect(padKrs("0000222483_")).toBe("0000222483");
  });
});

describe("toIsoDate", () => {
  it("converts DD.MM.YYYY", () => {
    expect(toIsoDate("22.08.2026")).toBe("2026-08-22");
    expect(toIsoDate("1.12.2004")).toBe("2004-12-01");
  });

  it("returns null for invalid", () => {
    expect(toIsoDate("")).toBeNull();
    expect(toIsoDate("2026-08-22")).toBeNull();
    expect(toIsoDate(undefined)).toBeNull();
  });
});

describe("toNumber", () => {
  it("parses polish decimal with spaces", () => {
    expect(toNumber("798214120,00")).toBe(798214120);
    expect(toNumber("1 846 200,50")).toBe(1846200.5);
  });

  it("handles numbers and invalid", () => {
    expect(toNumber(123)).toBe(123);
    expect(toNumber("abc")).toBeNull();
    expect(toNumber("")).toBeNull();
  });
});
