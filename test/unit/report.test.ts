import { describe, expect, it } from "vitest";
import { buildCompanyReport } from "../../src/report";
import { terminowosc } from "../../src/report/terminowosc";
import { financials } from "../../src/report/financials";
import { createMemoryRepository } from "../helpers/memory-repository";
import { createMemoryCatalogRepository } from "../../src/store/catalog-memory";
import { createMemoryBillingRepository } from "../../src/store/billing-memory";
import { fsFetchAsset } from "../helpers/assets";
import { loadConfig } from "../../src/config";
import type { CompanyReport } from "../../src/domain/types";
import type { ApiDeps } from "../../src/api/deps";
import { createIngest } from "../../src/pipeline/ingest";
import { createKrsClient } from "../../src/sources/krs/client";

function deps(): ApiDeps {
  const repository = createMemoryRepository();
  const ingest = createIngest({ krsClient: createKrsClient({ baseUrl: "x", fetchJson: async () => ({}) }), repository });
  return {
    repository,
    ingest,
    billing: createMemoryBillingRepository(),
    catalog: createMemoryCatalogRepository(),
    config: loadConfig(),
    fetchAsset: fsFetchAsset(),
  };
}

const SAMPLE_REPORT: CompanyReport = {
  company: {
    krs: "0000222483",
    nip: "7791011327",
    regon: "63030302300000",
    name: "JERONIMO MARTINS POLSKA S.A.",
    legalForm: "SPÓŁKA AKCYJNA",
    statusOpp: false,
    liquidation: false,
    bankruptcy: false,
  },
  connections: [{ typPodmiotu: "Osoba", nazwa: "X", typPowiazania: "reprezentacja" }],
  ownership: [],
  pkdCodes: [{ code: "10.85.Z", description: "Wytwarzanie gotowych posiłków" }],
  statements: [],
  financials: [
    {
      okresSprawozdawczy: "01-01-2024_31-12-2024",
      rok: 2024,
      indicators: [
        { nazwa_wskaznika: "przychody", kwota: 1000 },
        { nazwa_wskaznika: "zysk_netto", kwota: 100 },
        { nazwa_wskaznika: "suma_bilansowa", kwota: 500 },
        { nazwa_wskaznika: "wartosc_firmy_srednia", kwota: 800 },
        { nazwa_wskaznika: "kredyt_kupiecki_sredni", kwota: 50 },
        { nazwa_wskaznika: "wiarygodnosc", kwota: 2 },
      ],
    },
  ],
  monitor: [],
  krz: [],
  history: [
    { okresSprawozdawczy: "2024", rok: 2024, terminZlozenia: "2025-07-15", dataDodaniaDoKrs: "2025-07-10" },
    { okresSprawozdawczy: "2023", rok: 2023, terminZlozenia: "2024-07-15", dataDodaniaDoKrs: "2024-09-01" },
  ],
  descriptions: [{ opis: "Opis firmy" }],
  benchmarks: [{ okresSprawozdawczy: "2024", rok: 2024, nazwaWskaznika: "przychody", percentylWPkd: 0.99 }],
};

describe("terminowosc", () => {
  it("counts on-time and late filings", () => {
    const result = terminowosc({ deps: deps(), krs: "0000222483", report: SAMPLE_REPORT });
    expect(result.razem).toBe(2);
    expect(result.w_terminie).toBe(1);
    expect(result.po_terminie).toBe(1);
    expect(result.srednie_opoznienie_dni).toBeGreaterThan(0);
  });
});

describe("financials", () => {
  it("derives wycena, kredyt and risk per year", () => {
    const series = financials({ deps: deps(), krs: "0000222483", report: SAMPLE_REPORT });
    expect(series).toHaveLength(1);
    const year = series[0]!;
    expect(year.wskazniki["przychody"]).toBe(1000);
    expect(year.wycena.srednia).toBe(800);
    expect(year.kredyt_kupiecki.sredni).toBe(50);
    expect(year.ryzyko.wiarygodnosc).toBe(2);
  });
});

describe("buildCompanyReport", () => {
  it("assembles the enriched report from stored data", async () => {
    const appDeps = deps();
    const repo = appDeps.repository as ReturnType<typeof createMemoryRepository>;
    await repo.upsertCompany(SAMPLE_REPORT);
    await repo.upsertIndicators("0000222483", "01-01-2024_31-12-2024", SAMPLE_REPORT.financials[0]!.indicators);
    await repo.upsertDescriptions("0000222483", SAMPLE_REPORT.descriptions);
    await repo.upsertCompanyBenchmarks("0000222483", SAMPLE_REPORT.benchmarks);
    await repo.upsertHistory("0000222483", SAMPLE_REPORT.history);
    await appDeps.catalog.upsertCatalogRows([
      {
        krs: "0000999999",
        name: "PODOBNA SP. Z O.O.",
        nip: null,
        regon: null,
        legalForm: null,
        street: null,
        city: null,
        voivodeship: null,
        postalCode: null,
        website: null,
        email: null,
        pkdSekcja: "C",
        pkdDzial: "10",
        pkdPodklasa: "10.85.Z",
        pkdOpis: null,
        nieWykreslona: true,
        czyStatusOpp: false,
        citEstonski: false,
        ostatniKrz: 0,
        ostatniMonitor: 0,
        rok: 2024,
        przychody: 500,
      },
    ]);

    const report = await buildCompanyReport(appDeps, "0000222483");
    expect(report).not.toBeNull();
    expect(report!.summary.przychody).toBe(1000);
    expect(report!.terminowosc.razem).toBe(2);
    expect(report!.opisy_firmy).toHaveLength(1);
    expect(report!.pozycja_na_tle_branzy[0]!.percentylWPkd).toBe(0.99);
    expect(report!.podobne_organizacje).toHaveLength(1);
    expect(report!.podobne_organizacje[0]!.krs).toBe("0000999999");
    expect(report!.finansowe[0]!.wycena.srednia).toBe(800);
  });
});
