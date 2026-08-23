import { describe, expect, it, vi } from "vitest";
import fs from "fs";
import path from "path";
import { createIngest } from "../../src/pipeline/ingest";
import { parseSprawozdanie } from "../../src/sources/rdf/parser";
import { createRdfClient } from "../../src/sources/rdf/client";

function mockRepo() {
  const statements: { krs: string; period: string | null }[] = [];
  const positions: { statementId: number; row: unknown }[] = [];
  const indicators: unknown[] = [];
  let nextId = 1;
  const repo = {
    upsertStatement: vi.fn(async (_krs: string, stmt: { periodFrom?: string; periodTo?: string; filedAt?: string | null }) => {
      const period = stmt.periodFrom ? `${stmt.periodFrom}_${stmt.periodTo ?? ""}` : null;
      statements.push({ krs: _krs, period });
      return nextId++;
    }),
    upsertPositions: vi.fn(async (statementId: number, rows: unknown[]) => {
      for (const row of rows) positions.push({ statementId, row });
    }),
    upsertIndicators: vi.fn(async (_krs: string, _okres: string | null, inds: unknown[]) => {
      indicators.push(...(inds as []));
    }),
    upsertHistory: vi.fn(async (_krs: string, _entries: unknown[]) => {}),
  };
  return { repo, statements, positions, indicators };
}

function mockRdfClient(xmls: string[]) {
  let i = 0;
  return createRdfClient({
    baseUrl: "https://rdf.example.test",
    transport: async (input: string) => {
      if (input.includes("/tresc")) {
        const index = i++;
        return new Response(xmls[index] ?? "<html>no more</html>", { status: 200 });
      }
      if (input.includes("/wyszukiwanie")) {
        return new Response(JSON.stringify({ content: [{ id: "doc", rodzaj: "18" }] }), { status: 200 });
      }
      return new Response(JSON.stringify({ rodzajDokumentu: { dopuszczalneRozszerzenia: ".XML" } }), { status: 200 });
    },
  });
}

describe("ingestRdfFinancials — persist statements + positions", () => {
  it("persists statement rows and raw positions for a parsed statement (consolidated fixture)", async () => {
    const xml = fs.readFileSync(path.join(__dirname, "..", "fixtures", "rdf-consolidated-2025.xml"), "utf8");
    const { repo, statements, positions } = mockRepo();
    const rdf = mockRdfClient([xml]);
    const ingest = createIngest({ krsClient: {} as never, rdfClient: rdf, repository: repo as never });
    const result = await ingest.ingestRdfFinancials("0000007411");
    expect(result.processed).toBe(1);
    expect(result.failed).toBe(0);
    expect(statements.length).toBe(1);
    expect(repo.upsertPositions).toHaveBeenCalled();
    expect(positions.length).toBeGreaterThan(100);
    const first = positions[0]!.row as { sekcja: string; kwota: number | null };
    expect(typeof first.sekcja).toBe("string");
    expect(typeof first.kwota).toBe("number");
    expect(repo.upsertIndicators).toHaveBeenCalledTimes(1);
  });

  it("persists positions for a standalone statement too", async () => {
    const xml = fs.readFileSync(path.join(__dirname, "..", "fixtures", "rdf-corpus", "0000320584", "20240101_20241231.xml"), "utf8");
    const { repo, positions } = mockRepo();
    const rdf = mockRdfClient([xml]);
    const ingest = createIngest({ krsClient: {} as never, rdfClient: rdf, repository: repo as never });
    await ingest.ingestRdfFinancials("0000320584");
    expect(positions.length).toBeGreaterThan(50);
  });

  it("counts a failed statement when XML is not parseable", async () => {
    const { repo } = mockRepo();
    const rdf = mockRdfClient(["<html>challenge</html>"]);
    const ingest = createIngest({ krsClient: {} as never, rdfClient: rdf, repository: repo as never });
    const result = await ingest.ingestRdfFinancials("0000007411");
    expect(result.processed).toBe(0);
    expect(result.failed).toBe(1);
  });

  it("persists a transitional period and the following annual statement as separate fiscal years", async () => {
    const transitional = `<?xml version="1.0"?><Dokument>
      <OkresOd>2020-01-01</OkresOd><OkresDo>2021-04-30</OkresDo>
      <JednostkaMikro><RZiS>
        <A><dtsf:KwotaA>1000</dtsf:KwotaA></A><B><dtsf:KwotaA>600</dtsf:KwotaA></B>
        <C><dtsf:KwotaA>0</dtsf:KwotaA></C><D><dtsf:KwotaA>0</dtsf:KwotaA></D>
        <E><dtsf:KwotaA>0</dtsf:KwotaA></E><F><dtsf:KwotaA>310</dtsf:KwotaA></F>
      </RZiS></JednostkaMikro></Dokument>`;
    const annual = `<?xml version="1.0"?><Dokument>
      <OkresOd>2021-01-01</OkresOd><OkresDo>2021-12-31</OkresDo>
      <JednostkaMikro><RZiS>
        <A><dtsf:KwotaA>2000</dtsf:KwotaA></A><B><dtsf:KwotaA>1200</dtsf:KwotaA></B>
        <C><dtsf:KwotaA>0</dtsf:KwotaA></C><D><dtsf:KwotaA>0</dtsf:KwotaA></D>
        <E><dtsf:KwotaA>0</dtsf:KwotaA></E><F><dtsf:KwotaA>620</dtsf:KwotaA></F>
      </RZiS></JednostkaMikro></Dokument>`;
    const { repo, statements } = mockRepo();
    const rdf = createRdfClient({
      baseUrl: "https://rdf.example.test",
      transport: async (input: string) => {
        if (input.includes("/wyszukiwanie")) {
          return new Response(
            JSON.stringify({ content: [{ id: "t", rodzaj: "18" }, { id: "a", rodzaj: "18" }] }),
            { status: 200 },
          );
        }
        if (input.includes("/tresc")) {
          const xml = input.includes("/t/tresc") ? transitional : annual;
          return new Response(xml, { status: 200 });
        }
        return new Response(JSON.stringify({ rodzajDokumentu: { dopuszczalneRozszerzenia: ".XML" }, dataDodania: "2022-01-01" }), { status: 200 });
      },
    });
    const ingest = createIngest({ krsClient: {} as never, rdfClient: rdf, repository: repo as never });
    const result = await ingest.ingestRdfFinancials("0000007411");
    expect(result.processed).toBe(2);
    // the transitional 16-month period (rok 2020) and the annual calendar year
    // (rok 2021) map to different fiscal years — both are kept, no collision
    expect(statements.map((s) => s.period).sort()).toEqual([
      "2020-01-01_2021-04-30",
      "2021-01-01_2021-12-31",
    ]);
    expect(repo.upsertHistory).toHaveBeenCalledTimes(2);
  });

  it("keeps only the genuine annual filing when a partial and an annual statement land on the same year", async () => {
    const partial = `<?xml version="1.0"?><Dokument>
      <OkresOd>2021-07-01</OkresOd><OkresDo>2021-12-31</OkresDo>
      <JednostkaMikro><RZiS>
        <A><dtsf:KwotaA>100</dtsf:KwotaA></A><B><dtsf:KwotaA>60</dtsf:KwotaA></B>
        <C><dtsf:KwotaA>0</dtsf:KwotaA></C><D><dtsf:KwotaA>0</dtsf:KwotaA></D>
        <E><dtsf:KwotaA>0</dtsf:KwotaA></E><F><dtsf:KwotaA>31</dtsf:KwotaA></F>
      </RZiS></JednostkaMikro></Dokument>`;
    const annual = `<?xml version="1.0"?><Dokument>
      <OkresOd>2021-01-01</OkresOd><OkresDo>2021-12-31</OkresDo>
      <JednostkaMikro><RZiS>
        <A><dtsf:KwotaA>2000</dtsf:KwotaA></A><B><dtsf:KwotaA>1200</dtsf:KwotaA></B>
        <C><dtsf:KwotaA>0</dtsf:KwotaA></C><D><dtsf:KwotaA>0</dtsf:KwotaA></D>
        <E><dtsf:KwotaA>0</dtsf:KwotaA></E><F><dtsf:KwotaA>620</dtsf:KwotaA></F>
      </RZiS></JednostkaMikro></Dokument>`;
    const { repo, statements } = mockRepo();
    const rdf = createRdfClient({
      baseUrl: "https://rdf.example.test",
      transport: async (input: string) => {
        if (input.includes("/wyszukiwanie")) {
          return new Response(
            JSON.stringify({ content: [{ id: "p", rodzaj: "18" }, { id: "a", rodzaj: "18" }] }),
            { status: 200 },
          );
        }
        if (input.includes("/tresc")) {
          const xml = input.includes("/p/tresc") ? partial : annual;
          return new Response(xml, { status: 200 });
        }
        return new Response(JSON.stringify({ rodzajDokumentu: { dopuszczalneRozszerzenia: ".XML" }, dataDodania: "2022-01-01" }), { status: 200 });
      },
    });
    const ingest = createIngest({ krsClient: {} as never, rdfClient: rdf, repository: repo as never });
    const result = await ingest.ingestRdfFinancials("0000007411");
    expect(result.processed).toBe(1);
    expect(statements.map((s) => s.period)).toEqual(["2021-01-01_2021-12-31"]);
    expect(repo.upsertHistory).toHaveBeenCalledTimes(1);
  });

  it("does nothing when the rdf client is absent (production without RDF_COOKIE)", async () => {
    const { repo } = mockRepo();
    const ingest = createIngest({ krsClient: {} as never, repository: repo as never });
    const result = await ingest.ingestRdfFinancials("0000007411");
    expect(result.processed).toBe(0);
    expect(repo.upsertIndicators).not.toHaveBeenCalled();
  });
});

describe("persistStatement — position mapping", () => {
  it("maps parser positions to statement_positions rows", async () => {
    const xml = fs.readFileSync(path.join(__dirname, "..", "fixtures", "rdf-consolidated-2025.xml"), "utf8");
    const statement = parseSprawozdanie(xml)!;
    const { repo, positions } = mockRepo();
    const ingest = createIngest({ krsClient: {} as never, repository: repo as never });
    await ingest.persistStatement("0000007411", statement, "2025-01-01_2025-12-31");
    expect(repo.upsertStatement).toHaveBeenCalledWith(
      "0000007411",
      { periodFrom: "2025-01-01", periodTo: "2025-12-31", filedAt: null },
    );
    expect(positions.length).toBeGreaterThan(100);
    expect(repo.upsertPositions).toHaveBeenCalledTimes(1);
  });
});
