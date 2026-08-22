import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createIngest } from "../../src/pipeline/ingest";
import { createKrsClient } from "../../src/sources/krs/client";
import { createMemoryRepository } from "../helpers/memory-repository";

function odpisFixture(name: string): unknown {
  return JSON.parse(readFileSync(join(process.cwd(), "test", "fixtures", name), "utf-8"));
}

function fakeKrsClient(odpis: unknown, odpis2?: unknown) {
  return createKrsClient({
    baseUrl: "https://api-krs.ms.gov.pl",
    fetchJson: async (url) => {
      if (url.includes("/api/Krs/Biuletyn/")) {
        return ["0000222483", "0000795513"];
      }
      if (odpis2 && url.includes("0000795513")) {
        return odpis2;
      }
      return odpis;
    },
  });
}

describe("createIngest", () => {
  it("ingests a company from an odpis", async () => {
    const repository = createMemoryRepository();
    const ingest = createIngest({ krsClient: fakeKrsClient(odpisFixture("krs-jeronimo.json")), repository });
    const result = await ingest.ingestCompany("0000222483");
    expect(result).toEqual({ processed: 1, failed: 0 });
    const company = await repository.getCompany("0000222483");
    expect(company?.name).toContain("JERONIMO MARTINS");
  });

  it("ingests a bulletin list and records state", async () => {
    const repository = createMemoryRepository();
    const ingest = createIngest({
      krsClient: fakeKrsClient(odpisFixture("krs-jeronimo.json"), odpisFixture("krs-baselinker.json")),
      repository,
    });
    const result = await ingest.ingestBulletin("2026-08-22");
    expect(result.processed).toBe(2);
    expect(result.failed).toBe(0);
    expect(await repository.getIngestState()).toBe("2026-08-22");
    expect((await repository.listCompanies(10, 0)).length).toBe(2);
  });
});
