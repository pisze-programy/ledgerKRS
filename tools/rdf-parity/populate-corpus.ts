import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parseSprawozdanie, type ParsedStatement } from "../../src/sources/rdf/parser";
import { statementMeta } from "../../src/sources/rdf/layouts";
import { extractFinancialInput, type YearFinancials } from "../../src/sources/rdf/indicators";
import { selectAnnualYears, type AnnualCandidate } from "../../src/sources/rdf/selection";
import { historyEntryFromMeta } from "../../src/sources/rdf/history";

/**
 * Populate the local API database from the downloaded corpus fixtures
 * (financials + positions + history + descriptions + benchmarks) without
 * touching RDF. Mirrors what run-sample50 does, but reads XMLs from
 * test/fixtures/rdf-corpus/ so it needs no cookie.
 */
const API = "http://localhost:8787";
const CORPUS = join(process.cwd(), "test", "fixtures", "rdf-corpus");

async function post(path: string, body?: unknown): Promise<boolean> {
  const r = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!r.ok) {
    console.error(`  POST ${path} -> ${r.status}`);
    return false;
  }
  return true;
}

interface Winner {
  statement: ParsedStatement;
  okres: string;
  rok: number | null;
  year: YearFinancials;
}

function winnersFor(krs: string): Winner[] {
  const files = readdirSync(join(CORPUS, krs)).filter((f) => f.endsWith(".xml"));
  const candidates: AnnualCandidate[] = [];
  const parsed: { file: string; statement: ParsedStatement; meta: ReturnType<typeof statementMeta> }[] = [];
  for (const file of files) {
    const xml = readFileSync(join(CORPUS, krs, file), "utf8");
    const statement = parseSprawozdanie(xml);
    if (!statement) {
      continue;
    }
    const meta = statementMeta(xml);
    parsed.push({ file, statement, meta });
    candidates.push({ id: file, rodzaj: "18", okres: statement.okres_sprawozdawczy, dataDodania: null });
  }
  const selected = new Set(selectAnnualYears(candidates).map((s) => s.candidate.id));
  const winners: Winner[] = [];
  for (const { file, statement, meta } of parsed) {
    if (!selected.has(file)) {
      continue;
    }
    const year = extractFinancialInput(statement, meta);
    if (!year) {
      continue;
    }
    const okres = statement.okres_sprawozdawczy ?? "";
    winners.push({ statement, okres, rok: year.rok, year });
  }
  return winners;
}

async function ingestOne(krs: string): Promise<{ financials: number; positions: number }> {
  await post(`/ingest/krs/${krs}`);
  const winners = winnersFor(krs);
  let financials = 0;
  let positions = 0;
  for (const w of winners) {
    await post(`/ingest/krs/${krs}/financials`, {
      ...(w.year.input as Record<string, unknown>),
      okresSprawozdawczy: w.okres,
    });
    financials += 1;

    const rows: { sekcja: string; kod_pozycji: string | null; poziom_zaglebienia: number | null; nazwa_pozycji: string | null; kwota: number | null }[] = [];
    for (const section of w.statement.sekcje) {
      for (const position of section.pozycje) {
        rows.push({
          sekcja: section.sekcja,
          kod_pozycji: position.kod_pozycji,
          poziom_zaglebienia: position.poziom_zaglebienia,
          nazwa_pozycji: position.nazwa_pozycji,
          kwota: position.kwota,
        });
      }
    }
    if (rows.length > 0) {
      await post(`/ingest/krs/${krs}/positions`, { okres: w.okres, positions: rows });
      positions += 1;
    }

    await post(`/ingest/krs/${krs}/history`, [historyEntryFromMeta({}, w.okres, w.rok)]);
  }
  await post(`/ingest/krs/${krs}/derived`);
  return { financials, positions };
}

async function main(): Promise<void> {
  const listOverride = process.env.LIST
    ? (JSON.parse(readFileSync(process.env.LIST, "utf8")) as string[])
    : null;
  const firms = listOverride ?? readdirSync(CORPUS, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .filter((krs) => {
      try {
        return JSON.parse(readFileSync(join(CORPUS, krs, "bizraport.json"), "utf8"))?.dane_finansowe?.length > 0;
      } catch {
        return false;
      }
    })
    .sort();

  const limit = Number(process.env.LIMIT ?? 0);
  const start = Number(process.env.START ?? 0);
  const list = limit > 0 ? firms.slice(start, start + limit) : firms.slice(start);

  let firmsDone = 0;
  for (const krs of list) {
    const r = await ingestOne(krs);
    firmsDone += 1;
    console.log(`${krs}: financials=${r.financials} positions=${r.positions} (${firmsDone}/${list.length})`);
  }
  console.log(`done. firms=${firmsDone}`);
}

main().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
