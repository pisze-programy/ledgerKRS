import { describe, expect, it } from "vitest";
import { createMemoryBillingRepository } from "../../src/store/billing-memory";
import { quantile, cagr, computeBranchStats, computeGrowth } from "../../src/metrics/branch";
import type { CatalogRow } from "../../src/store/catalog";

describe("memory billing", () => {
  it("creates an account, adds free credits and spends them", async () => {
    const billing = createMemoryBillingRepository();
    const accountId = await billing.createAccount("a@b.pl");
    await billing.addCredits(accountId, 100, "free:start", "free", null);
    expect(await billing.getBalance(accountId)).toBe(100);
    expect(await billing.spendCredit(accountId, "/dane")).toBe(true);
    expect(await billing.getBalance(accountId)).toBe(99);
  });

  it("refuses to spend without balance", async () => {
    const billing = createMemoryBillingRepository();
    const accountId = await billing.createAccount("a@b.pl");
    expect(await billing.spendCredit(accountId, "/dane")).toBe(false);
  });

  it("settles pending credits after the apply time", async () => {
    const billing = createMemoryBillingRepository();
    const accountId = await billing.createAccount("a@b.pl");
    await billing.addCredits(accountId, 1000, "checkout", "topup", new Date(Date.now() + 5000).toISOString());
    expect(await billing.getBalance(accountId)).toBe(0);
    await billing.settlePending(accountId, new Date(Date.now() + 6000).toISOString());
    expect(await billing.getBalance(accountId)).toBe(1000);
  });

  it("tracks usage per endpoint", async () => {
    const billing = createMemoryBillingRepository();
    const accountId = await billing.createAccount("a@b.pl");
    await billing.addCredits(accountId, 100, "free", "free", null);
    await billing.spendCredit(accountId, "/dane");
    await billing.spendCredit(accountId, "/dane");
    await billing.spendCredit(accountId, "/katalog");
    const usage = await billing.usage(accountId);
    expect(usage["/dane"]).toBe(2);
    expect(usage["/katalog"]).toBe(1);
  });
});

describe("quantile", () => {
  it("computes percentiles with interpolation", () => {
    expect(quantile([1, 2, 3, 4], 0.5)).toBeCloseTo(2.5);
    expect(quantile([1, 2, 3, 4], 0.9)).toBeCloseTo(3.7);
  });

  it("returns null for empty input", () => {
    expect(quantile([], 0.5)).toBeNull();
  });
});

describe("cagr", () => {
  it("computes compound annual growth", () => {
    expect(cagr(100, 121, 2)).toBeCloseTo(0.1);
  });

  it("returns null for non-positive inputs", () => {
    expect(cagr(0, 121, 2)).toBeNull();
  });
});

describe("computeBranchStats", () => {
  it("aggregates count, revenue and percentiles", () => {
    const rows: CatalogRow[] = [
      row("1", 100),
      row("2", 200),
      row("3", 400),
    ];
    const { stat, geo } = computeBranchStats("62.01.Z", 2024, rows);
    expect(stat.count).toBe(3);
    expect(stat.totalPrzychody).toBe(700);
    expect(stat.avgPrzychod).toBeCloseTo(700 / 3);
    expect(stat.p50Przychody).toBe(200);
    expect(geo["MAZOWIECKIE"]).toBe(3);
  });
});

describe("computeGrowth", () => {
  it("computes growth from two years", () => {
    const growth = computeGrowth([
      { pkd: "X", rok: 2022, count: 10, totalPrzychody: 100, avgPrzychod: null, avgZysk: null, p10Przychody: null, p20Przychody: null, p50Przychody: null, p90Przychody: null, p10Zysk: null, p20Zysk: null, p50Zysk: null, p90Zysk: null, p10Wartosc: null, p20Wartosc: null, p50Wartosc: null, p90Wartosc: null },
      { pkd: "X", rok: 2024, count: 30, totalPrzychody: 121, avgPrzychod: null, avgZysk: null, p10Przychody: null, p20Przychody: null, p50Przychody: null, p90Przychody: null, p10Zysk: null, p20Zysk: null, p50Zysk: null, p90Zysk: null, p10Wartosc: null, p20Wartosc: null, p50Wartosc: null, p90Wartosc: null },
    ]);
    expect(growth.countGrowthPerYear).toBe(10);
    expect(growth.cagr).toBeCloseTo(0.1);
  });
});

function row(krs: string, przychody: number): CatalogRow {
  return {
    krs, name: null, nip: null, regon: null, legalForm: null, street: null, city: null,
    voivodeship: "MAZOWIECKIE", postalCode: null, website: null, email: null,
    pkdSekcja: null, pkdDzial: null, pkdPodklasa: null, pkdOpis: null,
    nieWykreslona: true, czyStatusOpp: false, citEstonski: false, ostatniKrz: 0, ostatniMonitor: 0,
    rok: 2024, przychody,
  };
}
