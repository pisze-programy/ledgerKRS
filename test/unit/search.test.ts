import { describe, expect, it } from "vitest";
import { parseCatalogFilters } from "../../src/search/catalog-parse";
import { buildCatalogQuery, CatalogFilterError } from "../../src/search/catalog-build";
import { buildSearchQuery, SEARCH_CAP } from "../../src/search/fulltext";

describe("parseCatalogFilters", () => {
  it("parses numeric, percent and bool params", () => {
    const query = new URLSearchParams("przychody_od=1 000 000&roa_od=15&nie_wykreslona=tak&pkd_podklasa=62.01.Z");
    const filters = parseCatalogFilters(query);
    expect(filters.przychodyOd).toBe(1000000);
    expect(filters.roaOd).toBeCloseTo(0.15);
    expect(filters.nieWykreslona).toBe(true);
    expect(filters.pkdPodklasa).toBe("62.01.Z");
  });

  it("treats percentages as whole numbers", () => {
    const query = new URLSearchParams("marza_netto_od=5");
    expect(parseCatalogFilters(query).marzaNettoOd).toBeCloseTo(0.05);
  });
});

describe("buildCatalogQuery", () => {
  it("throws without any filter", () => {
    expect(() => buildCatalogQuery({}, "aktywa", "desc", 100, 0)).toThrowError(CatalogFilterError);
  });

  it("builds where and params for a range filter", () => {
    const query = buildCatalogQuery({ przychodyOd: 1000 }, "przychody", "desc", 10, 0);
    expect(query.where).toContain("przychody >= ?");
    expect(query.params).toEqual([1000]);
    expect(query.orderBy).toContain("przychody DESC");
    expect(query.limit).toBe(10);
  });

  it("uppercases equality values", () => {
    const query = buildCatalogQuery({ pkdPodklasa: "62.01.z" }, "aktywa", "desc", 10, 0);
    expect(query.params).toEqual(["62.01.Z"]);
  });

  it("maps sort keys to columns", () => {
    expect(buildCatalogQuery({ przychodyOd: 1 }, "wartosc", "asc", 10, 0).orderBy).toContain("estymowana_wartosc_firmy");
  });
});

describe("buildSearchQuery", () => {
  it("builds a like query across name, nip, krs, regon", () => {
    const query = buildSearchQuery("baseli", 10);
    expect(query.where).toContain("name LIKE ?");
    expect(query.params).toEqual(["%baseli%", "%baseli%", "%baseli%", "%baseli%"]);
    expect(query.orderBy).toContain("length(name)");
  });

  it("caps the limit", () => {
    expect(buildSearchQuery("x", 999999).limit).toBe(SEARCH_CAP);
  });
});
