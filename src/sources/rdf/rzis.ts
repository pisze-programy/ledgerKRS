import type { ParsedStatement } from "./parser";
import { sectionsOf, type StatementMeta } from "./layouts";
import { nameFor, rzisVariantOf, type RzisVariant } from "./names";

export interface RzisRoles {
  przychody: number | null;
  koszty: number | null;
  zyskZeSprzedazy: number | null;
  zyskOperacyjny: number | null;
  zyskBrutto: number | null;
  podatek: number | null;
  zyskNetto: number | null;
  codes: Record<string, number | null>;
  source: "dict" | "chain";
}

const TOL = 1e-4;
const near = (a: number | null, b: number | null) =>
  a !== null && b !== null && Math.abs(a - b) < Math.max(1, Math.abs(b) * TOL);

function letterCodes(statement: ParsedStatement): Record<string, number | null> {
  const rzis = statement.sekcje.find((s) => s.sekcja === "Rachunek zysków i strat");
  const codes: Record<string, number | null> = {};
  if (rzis) {
    for (const p of rzis.pozycje) {
      if (p.kod_pozycji && /^[A-Z]{1,2}$/.test(p.kod_pozycji)) {
        codes[p.kod_pozycji] = p.kwota;
      }
    }
  }
  return codes;
}

function sortedLetters(codes: Record<string, number | null>): string[] {
  return Object.keys(codes).sort((a, b) => a.length - b.length || a.localeCompare(b));
}

function roleForVariant(meta: StatementMeta, variant: RzisVariant, statement: ParsedStatement): RzisRoles | null {
  const names = new Map<string, string>();
  for (const code of "ABCDEFGHIJKLMNOP".split("")) {
    const n = nameFor(meta.layout, "RZiS", code, variant);
    if (n) {
      names.set(code, n);
    }
  }
  const rzis = sectionsOf(statement).get("RZiS") ?? new Map<string, number | null>();
  const findRole = (needle: string): string | null => {
    for (const [code, name] of names) {
      if (name.toLowerCase().includes(needle)) {
        return code;
      }
    }
    return null;
  };
  const przychodyCode = findRole("przychody netto ze sprzedazy");
  const zyskNettoCode = findRole("zysk (strata) netto");
  const podatekCode = findRole("podatek dochodowy");
  if (!przychodyCode || !zyskNettoCode || !podatekCode) {
    return null;
  }
  const v = (code: string | null) => (code ? rzis.get(code) ?? null : null);
  const result: RzisRoles = {
    przychody: v(przychodyCode),
    koszty: v(findRole("koszty")),
    zyskZeSprzedazy: v(findRole("zysk (strata) ze sprzedazy")),
    zyskOperacyjny: v(findRole("zysk (strata) z dzialalnosci operacyjnej")),
    zyskBrutto: v(findRole("zysk (strata) brutto")),
    podatek: v(podatekCode),
    zyskNetto: v(zyskNettoCode),
    codes: Object.fromEntries(rzis),
    source: "dict",
  };
  return result.zyskNetto !== null ? result : null;
}

export function rzisRolesFromChain(statement: ParsedStatement): RzisRoles | null {
  const codes = letterCodes(statement);
  const letters = sortedLetters(codes);
  if (letters.length < 4) {
    return null;
  }
  const v = (code: string) => codes[code] ?? null;
  const przychody = v(letters[0]!);
  const koszty = v(letters[1]!);
  if (przychody === null || koszty === null) {
    return null;
  }
  const ze = przychody - koszty;
  const zeIdx = letters.findIndex((l) => near(v(l), ze));
  const compute = (base: number, start: number): { result: number; nextStart: number } => {
    const a = letters[start];
    const b = letters[start + 1];
    if (!a || !b) {
      return { result: base, nextStart: start };
    }
    const result = base + (v(a) ?? 0) - (v(b) ?? 0);
    const m = letters.findIndex((l, i) => i > start + 1 && near(v(l), result));
    return { result, nextStart: m !== -1 ? m + 1 : start + 2 };
  };

  const start = zeIdx === -1 ? 2 : zeIdx + 1;
  const op = compute(ze, start);
  const br = compute(op.result, op.nextStart);
  const zyskNetto = v(letters[letters.length - 1]!);
  const brutto = br.result;
  const podatek = zyskNetto !== null && brutto !== null ? brutto - zyskNetto : null;

  return {
    przychody,
    koszty,
    zyskZeSprzedazy: ze,
    zyskOperacyjny: op.result,
    zyskBrutto: brutto,
    podatek,
    zyskNetto,
    codes,
    source: "chain",
  };
}

export function rzisRoles(statement: ParsedStatement, meta: StatementMeta): RzisRoles {
  const variants: RzisVariant[] = ["RZiSKalk", "RZiSPor"];
  for (const variant of variants) {
    const r = roleForVariant(meta, variant, statement);
    if (r) {
      return r;
    }
  }
  const chain = rzisRolesFromChain(statement);
  if (chain) {
    return chain;
  }
  return {
    przychody: null,
    koszty: null,
    zyskZeSprzedazy: null,
    zyskOperacyjny: null,
    zyskBrutto: null,
    podatek: null,
    zyskNetto: null,
    codes: letterCodes(statement),
    source: "chain",
  };
}
