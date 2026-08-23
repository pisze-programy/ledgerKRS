import { describe, expect, it } from "vitest";
import { normalizePersonName, personKey } from "../../src/domain/person";

describe("normalizePersonName", () => {
  it("lowercases and strips diacritics", () => {
    expect(normalizePersonName("KOWALSKI JAN")).toBe("kowalski jan");
    expect(normalizePersonName("Żółć Śmieszna")).toBe("zolc smieszna");
  });

  it("collapses whitespace and punctuation", () => {
    expect(normalizePersonName("Jan  K.   Kowalski")).toBe("jan k kowalski");
    expect(normalizePersonName("  Anna-Marie   Nowak  ")).toBe("anna marie nowak");
  });

  it("treats differently-spelled variants as the same person", () => {
    const a = personKey("Kowalski Jan");
    const b = personKey("jan kowalski");
    const c = personKey("JAN KOWALSKI");
    expect(a).toBe(b);
    expect(a).toBe(c);
  });

  it("returns empty for null / empty input", () => {
    expect(normalizePersonName(null)).toBe("");
    expect(normalizePersonName(undefined)).toBe("");
    expect(normalizePersonName("")).toBe("");
    expect(normalizePersonName("  ")).toBe("");
  });
});

describe("personKey", () => {
  it("is the canonical matching key", () => {
    expect(personKey("Nowak Anna")).toBe(personKey("ANNA NOWAK"));
  });
});
