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

export function chainFromCodes(codes: Record<string, number | null>): RzisRoles | null {
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
  const start = zeIdx === -1 ? 2 : zeIdx + 1;
  const a = letters[start];
  const b2 = letters[start + 1];
  const opResult =
    a && b2 ? ze + (v(a) ?? 0) - (v(b2) ?? 0) : ze;

  const zyskNetto = v(letters[letters.length - 1]!);
  let brutto: number | null = null;
  let podatek: number | null = null;
  if (zyskNetto !== null) {
    let foundB: string | null = null;
    let foundT: string | null = null;
    for (let i = letters.length - 2; i >= 0; i -= 1) {
      const b = letters[i]!;
      const bv = v(b);
      if (bv === null) {
        continue;
      }
      for (let j = i + 1; j < letters.length - 1; j += 1) {
        const t = letters[j]!;
        const tv = v(t);
        if (tv !== null && near(bv - tv, zyskNetto)) {
          foundB = b;
          foundT = t;
          break;
        }
      }
      if (foundB) {
        break;
      }
    }
    if (foundB && foundT) {
      brutto = v(foundB);
      podatek = v(foundT);
    } else {
      const fallbackStart = start + 2;
      const fa = letters[fallbackStart];
      const fb = letters[fallbackStart + 1];
      const fallbackBrutto = fa && fb ? opResult + (v(fa) ?? 0) - (v(fb) ?? 0) : null;
      brutto = fallbackBrutto;
      podatek = brutto !== null && zyskNetto !== null ? brutto - zyskNetto : null;
    }
  }

  return {
    przychody,
    koszty,
    zyskZeSprzedazy: ze,
    zyskOperacyjny: opResult,
    zyskBrutto: brutto,
    podatek,
    zyskNetto,
    codes,
    source: "chain",
  };
}

export function rzisRolesFromChain(statement: ParsedStatement): RzisRoles | null {
  return chainFromCodes(letterCodes(statement));
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
