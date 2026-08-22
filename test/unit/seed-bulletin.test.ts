import { describe, expect, it } from "vitest";
import { seedBulletin } from "../../src/seed/bulletin";
import { createMemoryRepository } from "../helpers/memory-repository";
import { createMemoryCatalogRepository } from "../../src/store/catalog-memory";
import type { IngestService } from "../../src/pipeline/ingest";
import type { CompanyReport } from "../../src/domain/types";
import type { Repository } from "../../src/store/repository";
import type { CatalogRepository } from "../../src/store/catalog";

const COMPANIES = ["0000000001", "0000000002", "0000000003"];

function reportFor(krs: string): CompanyReport {
  return {
    company: {
      krs,
      nip: krs.slice(3),
      regon: null,
      name: `FIRMA ${krs}`,
      legalForm: "SPÓŁKA Z O.O.",
      statusOpp: false,
      liquidation: false,
      bankruptcy: false,
    },
    connections: [],
    ownership: [],
    pkdCodes: [{ code: "46.11.Z", description: "Sprzedaż hurtowa" }],
    statements: [],
    financials: [],
    monitor: [],
    krz: [],
    history: [],
    descriptions: [],
    benchmarks: [],
  };
}

function fakeIngest(repository: Repository): IngestService {
  return {
    listBulletin: async (_day: string, limit?: number) => (limit !== undefined ? COMPANIES.slice(0, limit) : [...COMPANIES]),
    ingestCompany: async (krs: string) => {
      await repository.upsertCompany(reportFor(krs));
      return { processed: 1, failed: 0 };
    },
  } as unknown as IngestService;
}

describe("seedBulletin", () => {
  it("ingests bulletin KRS entries into catalog rows", async () => {
    const repository = createMemoryRepository();
    const catalog = createMemoryCatalogRepository();
    const result = await seedBulletin({ ingest: fakeIngest(repository), repository, catalog }, "2024-01-01", 3);

    expect(result.day).toBe("2024-01-01");
    expect(result.krsFound).toBe(3);
    expect(result.ingested).toBe(3);
    expect(result.catalogRows).toBe(3);
    expect(result.failed).toEqual([]);

    const search = await catalog.searchCatalog({ where: "1=1", params: [], orderBy: "krs", limit: 10, offset: 0 });
    expect(search.rows.map((row) => row.krs).sort()).toEqual([...COMPANIES].sort());
  });

  it("respects the limit", async () => {
    const repository = createMemoryRepository();
    const catalog = createMemoryCatalogRepository();
    const result = await seedBulletin({ ingest: fakeIngest(repository), repository, catalog }, "2024-01-01", 2);
    expect(result.krsFound).toBe(2);
    expect(result.ingested).toBe(2);
  });
});
