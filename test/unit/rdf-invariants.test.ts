import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseSprawozdanie, type ParsedStatement } from "../../src/sources/rdf/parser";
import { statementMeta } from "../../src/sources/rdf/layouts";
import { extractFinancialInput } from "../../src/sources/rdf/indicators";
import { computeIndicators } from "../../src/metrics/indicators";
import { selectAnnualYears, type AnnualCandidate } from "../../src/sources/rdf/selection";
import { isKnownIssue } from "./known-issues";

const CORPUS = join(process.cwd(), "test", "fixtures", "rdf-corpus");
const EXTRA = [
  join(process.cwd(), "test", "fixtures", "rdf-consolidated-2025.xml"),
  join(process.cwd(), "test", "fixtures", "rdf-jednostka-inna.xml"),
];

interface StatementResult {
  krs: string;
  file: string;
  statement: ParsedStatement;
  layout: string;
  okres: string | null;
  rok: number | null;
  extracted: boolean;
  indicators: { nazwa_wskaznika: string; kwota: number }[];
  input: { revenue?: number | null; grossProfit?: number | null; netProfit?: number | null; incomeTax?: number | null };
}

function rzisK(statement: ParsedStatement): number {
  const rzis = statement.sekcje.find((s) => s.sekcja === "Rachunek zysków i strat");
  const k = rzis?.pozycje.find((p) => p.kod_pozycji === "K");
  return k?.kwota ?? 0;
}

function rzisNonZeroLetters(statement: ParsedStatement): number {
  const rzis = statement.sekcje.find((s) => s.sekcja === "Rachunek zysków i strat");
  if (!rzis) {
    return 0;
  }
  return rzis.pozycje.filter((p) => p.kwota !== null && p.kwota !== 0 && Math.abs(p.kwota) > 0).length;
}

function loadAll(): StatementResult[] {
  const results: StatementResult[] = [];
  const push = (krs: string, file: string, xml: string): void => {
    const statement = parseSprawozdanie(xml);
    if (!statement) {
      return;
    }
    const meta = statementMeta(xml);
    const year = extractFinancialInput(statement, meta);
    results.push({
      krs, file, statement, layout: meta.layout,
      okres: statement.okres_sprawozdawczy, rok: year?.rok ?? statement.rok,
      extracted: year !== null,
      indicators: year ? computeIndicators(year.input as never) : [],
      input: year?.input ?? {},
    });
  };
  for (const firm of readdirSync(CORPUS, { withFileTypes: true }).filter((e) => e.isDirectory())) {
    for (const file of readdirSync(join(CORPUS, firm.name)).filter((f) => f.endsWith(".xml"))) {
      push(firm.name, file, readFileSync(join(CORPUS, firm.name, file), "utf8"));
    }
  }
  for (const path of EXTRA) {
    push("EXTRA", path, readFileSync(path, "utf8"));
  }
  return results;
}

const ALL = loadAll();

/** Selected primary statements per firm, mirroring the production pipeline. */
function selected(): Map<string, StatementResult[]> {
  const byFirm = new Map<string, StatementResult[]>();
  for (const r of ALL) {
    byFirm.set(r.krs, [...(byFirm.get(r.krs) ?? []), r]);
  }
  const winners = new Map<string, StatementResult[]>();
  for (const [krs, rows] of byFirm) {
    const selectedRows = selectAnnualYears(
      rows.map((r) => ({ id: r.file, rodzaj: "18", okres: r.okres, dataDodania: null } satisfies AnnualCandidate)),
    );
    const ids = new Set(selectedRows.map((s) => s.candidate.id));
    winners.set(krs, rows.filter((r) => ids.has(r.file)));
  }
  return winners;
}

describe("rdf invariants — every extracted value is sane", () => {
  it("extracts a financial input for every active statement (≥1 non-zero RZiS letter)", () => {
    const missing = ALL.filter(
      (r) => !r.extracted && rzisNonZeroLetters(r.statement) > 0 && !isKnownIssue(r.krs, r.rok ?? 0, "zysk_netto"),
    );
    expect(missing.map((m) => `${m.krs}/${m.file}`)).toEqual([]);
  });

  it("produces no NaN or Infinity values", () => {
    const bad: string[] = [];
    for (const r of ALL) {
      for (const i of r.indicators) {
        if (!Number.isFinite(i.kwota)) {
          bad.push(`${r.krs}/${r.file} ${i.nazwa_wskaznika}=${i.kwota}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });
});

describe("rdf invariants — fiscal years", () => {
  it("selected statements have strictly increasing, non-duplicated fiscal years per firm", () => {
    const problems: string[] = [];
    for (const [krs, rows] of selected()) {
      const roks = rows.map((r) => r.rok ?? 0).filter(Boolean).sort((a, b) => a - b);
      for (let i = 1; i < roks.length; i += 1) {
        if (roks[i] === roks[i - 1]) {
          problems.push(`${krs}: duplicate fiscal year ${roks[i]}`);
        }
      }
    }
    expect(problems).toEqual([]);
  });
});

describe("rdf invariants — accounting identities", () => {
  // Statements where the filing itself breaks brutto = netto + podatek even
  // though we match BizRaport exactly — documented data-quality quirks.
  const DATA_QUIRK: Record<string, number[]> = {
    "0000386719": [2022, 2025],
    "0000416704": [2024],
    "0000325544": [2021],
    "0000582708": [2020],
    "0000617088": [2023, 2024],
  };
  const isQuirk = (krs: string, rok: number): boolean => (DATA_QUIRK[krs] ?? []).includes(rok);

  it("brutto ≈ netto + podatek for statements without a K line", () => {
    const violations: string[] = [];
    for (const [, rows] of selected()) {
      for (const r of rows) {
        if (!r.extracted) {
          continue;
        }
        // K ("pozostałe zmniejszenia zysku") is layout-dependent and unreliable,
        // and Op (pożytku publicznego) uses a different alphabet entirely.
        if (r.layout === "SFJOPZ" || rzisK(r.statement) !== 0) {
          continue;
        }
        const exempt = isKnownIssue(r.krs, r.rok ?? 0, "zysk_brutto") ||
          isKnownIssue(r.krs, r.rok ?? 0, "zysk_netto") ||
          isKnownIssue(r.krs, r.rok ?? 0, "podatek_dochodowy") ||
          isQuirk(r.krs, r.rok ?? 0);
        if (exempt) {
          continue;
        }
        const brutto = r.input.grossProfit;
        const netto = r.input.netProfit;
        const podatek = r.input.incomeTax;
        if (brutto == null || netto == null || podatek == null) {
          continue;
        }
        const expected = netto + podatek;
        const tol = Math.max(1, Math.abs(expected) * 1e-4);
        if (Math.abs(brutto - expected) > tol) {
          violations.push(`${r.krs}/${r.file}: brutto=${brutto} netto+podatek=${expected}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });
});

describe("rdf invariants — layout coverage", () => {
  it("covers every layout RDF actually serves (SFJINZ/SFJMAZ/SFJMIZ/SFJOPZ/LEGACY + SFSINZ fixture)", () => {
    const served = new Set(ALL.map((r) => r.layout));
    expect(served.has("SFJINZ")).toBe(true);
    expect(served.has("SFJMAZ")).toBe(true);
    expect(served.has("SFJMIZ")).toBe(true);
    expect(served.has("SFJOPZ")).toBe(true);
    expect(served.has("LEGACY")).toBe(true);
    expect(served.has("SFSINZ")).toBe(true); // via rdf-consolidated-2025.xml
    // SFBNKZ is a documented non-XML gap: banks file XHTML/PDF in RDF (PDF stage).
  });

  it("at least one firm changes layout across its filing years", () => {
    const byFirm = new Map<string, Set<string>>();
    for (const r of ALL) {
      if (!byFirm.has(r.krs)) byFirm.set(r.krs, new Set());
      byFirm.get(r.krs)!.add(r.layout);
    }
    const changing = [...byFirm.entries()].filter(([, layouts]) => layouts.size > 1);
    expect(changing.length).toBeGreaterThan(0);
  });
});
