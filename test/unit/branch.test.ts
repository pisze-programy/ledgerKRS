import { describe, expect, it } from "vitest";
import { computeBranchStats, computeGrowth, quantile } from "../../src/metrics/branch";
import { pkdReport, branchesTree } from "../../src/api/services";
import { createMemoryRepository } from "../helpers/memory-repository";
import { createMemoryCatalogRepository } from "../../src/store/catalog-memory";
import { createMemoryBillingRepository } from "../../src/store/billing-memory";
import { fsFetchAsset } from "../helpers/assets";
import { loadConfig } from "../../src/config";
import { createIngest } from "../../src/pipeline/ingest";
import { createKrsClient } from "../../src/sources/krs/client";
import type { ApiDeps } from "../../src/api/deps";
import type { CatalogRow } from "../../src/store/catalog";
import type { CompanyReport } from "../../src/domain/types";

function deps(): ApiDeps {
  const repository = createMemoryRepository();
  return {
    repository,
    ingest: createIngest({ krsClient: createKrsClient({ baseUrl: "x", fetchJson: async () => ({}) }), repository }),
    billing: createMemoryBillingRepository(),
    catalog: createMemoryCatalogRepository(),
    config: loadConfig(),
    fetchAsset: fsFetchAsset(),
  };
}

function row(krs: string, pkd: string, przychody: number | null, zysk: number | null, woj: string | null): CatalogRow {
  return {
    krs, name: `Firma ${krs}`, nip: null, regon: null, legalForm: null,
    street: null, city: null, voivodeship: woj, postalCode: null, website: null, email: null,
    pkdSekcja: "C", pkdDzial: "10", pkdPodklasa: pkd, pkdOpis: null,
    nieWykreslona: true, czyStatusOpp: false, citEstonski: false, ostatniKrz: 0, ostatniMonitor: 0,
    rok: 2024, przychody, zyskNetto: zysk, sumaBilansowa: null, estymowanaWartoscFirmy: przychody ? przychody * 2 : null,
  };
}

describe("computeBranchStats", () => {
  it("computes counts, totals, percentiles, geo and top from rows", () => {
    const rows = [
      row("1", "10.85.Z", 1000, 100, "MAZOWIECKIE"),
      row("2", "10.85.Z", 2000, 200, "MAŁOPOLSKIE"),
      row("3", "10.85.Z", 3000, 300, "MAZOWIECKIE"),
      row("4", "10.85.Z", null, null, "MAZOWIECKIE"),
    ];
    const { stat, top, geo } = computeBranchStats("10.85.Z", 2024, rows);
    expect(stat.count).toBe(4);
    expect(stat.totalPrzychody).toBe(6000);
    expect(stat.avgPrzychod).toBe(2000);
    expect(stat.p50Przychody).toBe(2000);
    expect(geo).toEqual({ MAZOWIECKIE: 3, MAŁOPOLSKIE: 1 });
    expect(top[0]!.krs).toBe("3");
  });
});

describe("computeGrowth", () => {
  it("computes CAGR and per-year growth across two years", () => {
    const growth = computeGrowth([
      { pkd: "C", rok: 2023, count: 2, totalPrzychody: 1000, avgPrzychod: 500, avgZysk: null, p10Przychody: null, p20Przychody: null, p50Przychody: null, p90Przychody: null, p10Zysk: null, p20Zysk: null, p50Zysk: null, p90Zysk: null, p10Wartosc: null, p20Wartosc: null, p50Wartosc: null, p90Wartosc: null },
      { pkd: "C", rok: 2024, count: 4, totalPrzychody: 1210, avgPrzychod: 605, avgZysk: null, p10Przychody: null, p20Przychody: null, p50Przychody: null, p90Przychody: null, p10Zysk: null, p20Zysk: null, p50Zysk: null, p90Zysk: null, p10Wartosc: null, p20Wartosc: null, p50Wartosc: null, p90Wartosc: null },
    ]);
    expect(growth.countGrowthPerYear).toBe(2);
    expect(growth.cagr).toBeCloseTo(0.21, 1);
  });

  it("returns null growth for a single year", () => {
    const growth = computeGrowth([{ pkd: "C", rok: 2024, count: 1, totalPrzychody: 100, avgPrzychod: 100, avgZysk: null, p10Przychody: null, p20Przychody: null, p50Przychody: null, p90Przychody: null, p10Zysk: null, p20Zysk: null, p50Zysk: null, p90Zysk: null, p10Wartosc: null, p20Wartosc: null, p50Wartosc: null, p90Wartosc: null }]);
    expect(growth.cagr).toBeNull();
  });
});

describe("quantile", () => {
  it("interpolates between values", () => {
    expect(quantile([1, 2, 3], 0.5)).toBe(2);
    expect(quantile([1, 2], 0.5)).toBe(1.5);
    expect(quantile([], 0.5)).toBeNull();
  });
});

describe("pkdReport", () => {
  it("builds a section-level report with summary, top, geo and percentiles", async () => {
    const appDeps = deps();
    await appDeps.catalog.upsertCatalogRows([
      row("1", "10.85.Z", 1000, 100, "MAZOWIECKIE"),
      row("2", "10.85.Z", 3000, 300, "MAŁOPOLSKIE"),
    ]);
    const report = await pkdReport(appDeps, "C");
    expect(report).not.toBeNull();
    const r = report as { code: string; summary: { count: number; total_przychody: number }; top: { krs: string }[]; geo: Record<string, number> };
    expect(r.code).toBe("C");
    expect(r.summary.count).toBe(2);
    expect(r.summary.total_przychody).toBe(4000);
    expect(r.top[0]!.krs).toBe("2");
    expect(r.geo["MAZOWIECKIE"]).toBe(1);
  });
});

describe("branchesTree", () => {
  it("returns sections with their divisions from the taxonomy", async () => {
    const tree = await branchesTree(deps());
    expect(tree.length).toBeGreaterThan(0);
    expect(tree[0]).toHaveProperty("code");
    expect(tree[0]).toHaveProperty("divisions");
  });
});
