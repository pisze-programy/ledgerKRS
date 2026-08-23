import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseSprawozdanie } from "../../src/sources/rdf/parser";
import { statementMeta } from "../../src/sources/rdf/layouts";
import { extractFinancialInput } from "../../src/sources/rdf/indicators";
import { computeIndicators } from "../../src/metrics/indicators";
import { buildCompanyReport } from "../../src/report";
import { createMemoryRepository } from "../helpers/memory-repository";
import { createMemoryCatalogRepository } from "../../src/store/catalog-memory";
import { createMemoryBillingRepository } from "../../src/store/billing-memory";
import { fsFetchAsset } from "../helpers/assets";
import { loadConfig } from "../../src/config";
import { createIngest } from "../../src/pipeline/ingest";
import { createKrsClient } from "../../src/sources/krs/client";
import type { ApiDeps } from "../../src/api/deps";
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

const CORPUS = join(process.cwd(), "test", "fixtures", "rdf-corpus");

/** One representative statement per layout, from real fixtures. */
const PER_LAYOUT: { layout: string; file: string }[] = [
  { layout: "SFJINZ", file: join(CORPUS, "0000005989", "20171001_20180930.xml") },
  { layout: "SFJMAZ", file: join(CORPUS, "0000085314", "20210101_20211231.xml") },
  { layout: "SFJMIZ", file: join(CORPUS, "0000080829", "20180101_20181231.xml") },
  { layout: "SFJOPZ", file: join(CORPUS, "0000278980", "20180101_20181231.xml") },
  { layout: "SFSINZ", file: join(process.cwd(), "test", "fixtures", "rdf-consolidated-2025.xml") },
];

const CANONICAL = [
  "suma_bilansowa",
  "kapital_wlasny",
  "zobowiazania_i_rezerwy",
  "przychody",
  "koszty_sprzedanych_produktow",
  "zysk_ze_sprzedazy",
  "zysk_operacyjny",
  "zysk_netto",
  "podatek_dochodowy",
  "amortyzacja",
];

describe("API coverage — every layout exposes the canonical indicators", () => {
  for (const { layout, file } of PER_LAYOUT) {
    it(`${layout}: /api/dane finansowe exposes the canonical indicators extracted offline`, async () => {
      const xml = readFileSync(file, "utf8");
      const meta = statementMeta(xml);
      expect(meta.layout).toBe(layout);
      const statement = parseSprawozdanie(xml);
      expect(statement).not.toBeNull();
      const year = extractFinancialInput(statement!, meta);
      expect(year, `${layout} extract`).not.toBeNull();
      const indicators = computeIndicators(year!.input as never);
      const names = new Set(indicators.map((i) => i.nazwa_wskaznika));
      expect(names.size).toBeGreaterThan(0);

      const krs = "0000000001";
      const company: CompanyReport = {
        company: { krs, nip: null, regon: null, name: "TEST", legalForm: null, statusOpp: false, liquidation: false, bankruptcy: false },
        connections: [],
        ownership: [],
        pkdCodes: [],
        statements: [],
        financials: [{ okresSprawozdawczy: year!.okresSprawozdawczy, rok: year!.rok, indicators }],
        monitor: [],
        krz: [],
        history: [],
        descriptions: [],
        benchmarks: [],
      };
      const appDeps = deps();
      await (appDeps.repository as ReturnType<typeof createMemoryRepository>).upsertCompany(company);
      await (appDeps.repository as ReturnType<typeof createMemoryRepository>).upsertIndicators(krs, year!.okresSprawozdawczy, indicators);

      const report = await buildCompanyReport(appDeps, krs);
      expect(report).not.toBeNull();
      const wskazniki = report!.finansowe[0]!.wskazniki as Record<string, number>;
      const present = CANONICAL.filter((ind) => names.has(ind as never));
      expect(present.length, `${layout} has at least one canonical indicator`).toBeGreaterThan(0);
      for (const ind of present) {
        expect(wskazniki[ind], `${layout} exposes ${ind}`).toBeTypeOf("number");
      }
    });
  }
});
