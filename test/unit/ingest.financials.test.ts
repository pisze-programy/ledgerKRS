import { describe, expect, it } from "vitest";
import { createIngest } from "../../src/pipeline/ingest";
import { createKrsClient } from "../../src/sources/krs/client";
import { createMemoryRepository } from "../helpers/memory-repository";
import type { FinancialInput } from "../../src/metrics/indicators";

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
  netProfit: 150,
  totalAssets: 1000,
  equity: 500,
  liabilities: 500,
  currentAssets: 200,
  currentLiabilities: 100,
  amortization: 50,
};

describe("ingestFinancials", () => {
  it("stores computed indicators with the reporting period", async () => {
    const { repository, ingest } = ingestWithMemory();
    await ingest.ingestFinancials("0000222483", FINANCIALS);
    const indicators = await repository.readIndicators("0000222483");
    expect(indicators.length).toBeGreaterThan(10);
    const byName = Object.fromEntries(indicators.map((item) => [item.nazwa_wskaznika, item.kwota]));
    expect(byName.ebit).toBe(200);
    expect(byName.ebitda).toBe(250);
    expect(byName.marza_netto).toBeCloseTo(0.15);
    expect(byName.roe).toBeCloseTo(0.3);
    expect(byName.wskaznik_zadluzenia).toBeCloseTo(0.5);
    expect(byName["plynnosc_biezaca"]).toBeCloseTo(2);
  });

  it("does not emit płynność when current liabilities are zero (division by zero)", async () => {
    const { repository, ingest } = ingestWithMemory();
    await ingest.ingestFinancials("0000222483", { ...FINANCIALS, currentLiabilities: 0 });
    const indicators = await repository.readIndicators("0000222483");
    const byName = Object.fromEntries(indicators.map((item) => [item.nazwa_wskaznika, item.kwota]));
    expect(byName["plynnosc_biezaca"]).toBeUndefined();
  });
});
