import { describe, expect, it } from "vitest";
import { createKrsClient } from "../../src/sources/krs/client";
import { createIngest } from "../../src/pipeline/ingest";
import { createMemoryRepository } from "../helpers/memory-repository";
import { parseOdpis } from "../../src/sources/krs/parser";

const KRS_API_BASE = "https://api-krs.ms.gov.pl";
const TEST_KRS = "0000222483";

async function canReachKrs(): Promise<boolean> {
  try {
    const response = await fetch(`${KRS_API_BASE}/api/krs/OdpisAktualny/${TEST_KRS}?rejestr=P&format=json`);
    return response.ok;
  } catch {
    return false;
  }
}

describe("krs openapi integration", () => {
  it("fetches and parses a real odpis", async () => {
    if (!(await canReachKrs())) {
      return;
    }
    const client = createKrsClient({ baseUrl: KRS_API_BASE });
    const raw = await client.getOdpisAktualny(TEST_KRS);
    const report = parseOdpis(raw);
    expect(report).not.toBeNull();
    expect(report!.company.krs).toBe(TEST_KRS);
    expect(report!.company.name).toContain("JERONIMO MARTINS");
  });

  it("ingests a real company into the repository", async () => {
    if (!(await canReachKrs())) {
      return;
    }
    const repository = createMemoryRepository();
    const client = createKrsClient({ baseUrl: KRS_API_BASE });
    const ingest = createIngest({ krsClient: client, repository });
    const result = await ingest.ingestCompany(TEST_KRS);
    expect(result.processed).toBe(1);
    const company = await repository.getCompany(TEST_KRS);
    expect(company?.capital).toBeGreaterThan(0);
  });
});
