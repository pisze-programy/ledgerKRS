import { describe, expect, it } from "vitest";
import { createIngest } from "../../src/pipeline/ingest";
import { createKrsClient } from "../../src/sources/krs/client";
import { createMemoryRepository } from "../helpers/memory-repository";
import type { FinancialInput } from "../../src/metrics/indicators";
import { INDICATOR } from "../../src/domain/vocab";
import type { IndustryBenchmarkRow } from "../../src/domain/types";

function ingestWithMemory() {
  const repository = createMemoryRepository();
  const krsClient = createKrsClient({
    baseUrl: "https://api-krs.ms.gov.pl",
    fetchJson: async () => ({}),
  });
  return { repository, ingest: createIngest({ krsClient, repository }) };
}

const FINANCIALS: FinancialInput = {
  okresSprawozdawczy: "01-01-2024_31-12-2024",
  rok: 2024,
  revenue: 1000,
  operatingCosts: 800,
  operatingProfit: 200,
  amortization: 50,
  netProfit: 150,
  totalAssets: 1000,
  equity: 500,
  liabilities: 500,
  currentAssets: 200,
  currentLiabilities: 100,
};

describe("ingestFinancials", () => {
  it("stores statement, risk and valuation indicators", async () => {
    const { repository, ingest } = ingestWithMemory();
    await ingest.ingestFinancials("0000222483", FINANCIALS);
    const indicators = await repository.readIndicators("0000222483");
    const byName = Object.fromEntries(indicators.map((item) => [item.nazwa_wskaznika, item.kwota]));
    expect(byName.ebit).toBe(200);
    expect(byName.ebitda).toBe(250);
    expect(byName.marza_netto).toBeCloseTo(0.15);
    expect(byName[INDICATOR.Wiarygodnosc]).toBeGreaterThanOrEqual(1);
    expect(byName[INDICATOR.Niewyplacalnosc24m]).toBeLessThan(0.3);
    expect(byName[INDICATOR.WartoscFirmySrednia]).toBeCloseTo(1500);
    expect(byName[INDICATOR.KredytKupieckiSredni]).toBeGreaterThan(0);
  });

  it("worsens risk indicators with distress signals", async () => {
    const { repository, ingest } = ingestWithMemory();
    const distressed = { ...FINANCIALS, netProfit: -300, equity: -100, liabilities: 1100 };
    await ingest.ingestFinancials("0000059307", distressed, {
      krzEntries: 3,
      monitorUwaga: 1,
      bankruptcy: true,
      liquidation: false,
      restructuring: false,
    });
    const indicators = await repository.readIndicators("0000059307");
    const byName = Object.fromEntries(indicators.map((item) => [item.nazwa_wskaznika, item.kwota]));
    expect(byName[INDICATOR.Wiarygodnosc]).toBe(5);
    expect(byName[INDICATOR.Niewyplacalnosc24m]).toBeGreaterThan(0.7);
  });
});

describe("ingestBenchmarks", () => {
  it("stores benchmark rows per year", async () => {
    const { repository, ingest } = ingestWithMemory();
    const rows: IndustryBenchmarkRow[] = [
      {
        okresSprawozdawczy: "01-01-2024_31-12-2024",
        rok: 2024,
        nazwaWskaznika: INDICATOR.Przychody,
        percentylWPkd: 0.95,
        udzialWRynku: 0.01,
        przychodyCalejBranzy: 100000,
        liczbaFirmWBranzy: 100,
      },
    ];
    await ingest.ingestBenchmarks("62.01.Z", rows);
    const stored = await repository.readIndicators("0000000000");
    expect(stored).toEqual([]);
  });
});

describe("ingestAnnouncements", () => {
  it("stores monitor, krz and history sections", async () => {
    const { repository, ingest } = ingestWithMemory();
    const report = {
      company: { krs: "0000060888" },
      connections: [],
      ownership: [],
      pkdCodes: [],
      statements: [],
      financials: [],
      monitor: [{ numerOgloszenia: "A1", rozdzial: "XV. WPISY DO KRS" }],
      krz: [{ numerObwieszczenia: "B2", kategoriaTytul: "Upadłość" }],
      history: [{ okresSprawozdawczy: "2024", rok: 2024, terminZlozenia: "2025-03-31" }],
      descriptions: [],
      benchmarks: [],
    };
    await ingest.ingestAnnouncements("0000060888", report as never);
    expect(repository.monitor("0000060888")).toHaveLength(1);
    expect(repository.krz("0000060888")[0]!.kategoriaTytul).toBe("Upadłość");
    expect(repository.history("0000060888")[0]!.rok).toBe(2024);
  });
});
