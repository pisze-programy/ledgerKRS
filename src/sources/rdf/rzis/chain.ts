import type { ParsedStatement } from "../parser";
import type { RzisRoles } from "./types";
import { codeValue, letterCodes } from "./codes";

const TOL = 1e-4;

function near(a: number | null, b: number | null): boolean {
  return a !== null && b !== null && Math.abs(a - b) < Math.max(1, Math.abs(b) * TOL);
}

function sortedLetters(codes: Record<string, number | null>): string[] {
  return Object.keys(codes).sort((a, b) => a.length - b.length || a.localeCompare(b));
}

/**
 * The value-chain fallback: infer RZiS roles purely from accounting
 * identities (A−B = ze, brutto−podatek = netto) when the dictionary can't
 * describe the statement. Works for every layout when letters are coherent.
 */
export function chainFromCodes(codes: Record<string, number | null>): RzisRoles | null {
  const letters = sortedLetters(codes);
  if (letters.length < 4) {
    return null;
  }
  const value = (code: string) => codeValue(codes, code);

  const przychody = value(letters[0]!);
  const koszty = value(letters[1]!);
  if (przychody === null || koszty === null) {
    return null;
  }

  const zyskZeSprzedazy = przychody - koszty;
  const zeIdx = letters.findIndex((code) => near(value(code), zyskZeSprzedazy));
  const start = zeIdx === -1 ? 2 : zeIdx + 1;

  const opAdjustA = letters[start];
  const opAdjustB = letters[start + 1];
  const zyskOperacyjny =
    opAdjustA && opAdjustB
      ? zyskZeSprzedazy + (value(opAdjustA) ?? 0) - (value(opAdjustB) ?? 0)
      : zyskZeSprzedazy;

  const zyskNetto = value(letters[letters.length - 1]!);
  const { zyskBrutto, podatek } = findTaxPair(letters, value, start, zyskNetto, zyskOperacyjny);

  return {
    przychody,
    koszty,
    zyskZeSprzedazy,
    zyskOperacyjny,
    zyskBrutto,
    podatek,
    zyskNetto,
    codes,
    source: "chain",
  };
}

/** Find brutto/podatek such that brutto − podatek ≈ netto; fall back to deriving from op. */
function findTaxPair(
  letters: string[],
  value: (code: string) => number | null,
  start: number,
  zyskNetto: number | null,
  zyskOperacyjny: number | null,
): { zyskBrutto: number | null; podatek: number | null } {
  if (zyskNetto === null) {
    return { zyskBrutto: null, podatek: null };
  }
  // Bruttó candidates are the letters between the op-adjust pair and netto,
  // scanned from the netto backwards through start (inclusive) so that a
  // short statement where brutto sits right after the op-adjust pair (e.g.
  // A,B,C,H,J) is still covered.
  for (let i = letters.length - 2; i >= start; i -= 1) {
    const bruttoCode = letters[i]!;
    const bruttoValue = value(bruttoCode);
    if (bruttoValue === null) {
      continue;
    }
    // No-tax filings omit the podatek line entirely: brutto == netto.
    if (near(bruttoValue, zyskNetto)) {
      return { zyskBrutto: bruttoValue, podatek: 0 };
    }
    for (let j = i + 1; j < letters.length - 1; j += 1) {
      const podatekValue = value(letters[j]!);
      if (podatekValue !== null && near(bruttoValue - podatekValue, zyskNetto)) {
        return { zyskBrutto: bruttoValue, podatek: podatekValue };
      }
    }
  }
  const fallbackA = letters[start + 2];
  const fallbackB = letters[start + 3];
  const fallbackBrutto =
    fallbackA && fallbackB ? (zyskOperacyjny ?? 0) + (value(fallbackA) ?? 0) - (value(fallbackB) ?? 0) : null;
  return { zyskBrutto: fallbackBrutto, podatek: fallbackBrutto !== null ? fallbackBrutto - zyskNetto : null };
}

export function rzisRolesFromChain(statement: ParsedStatement): RzisRoles | null {
  return chainFromCodes(letterCodes(statement));
}

export function fillMissingFromChain(rzis: RzisRoles, statement: ParsedStatement): RzisRoles {
  const chain = chainFromCodes(letterCodes(statement));
  if (!chain) {
    return rzis;
  }
  return {
    ...rzis,
    koszty: rzis.koszty ?? chain.koszty,
    zyskZeSprzedazy: rzis.zyskZeSprzedazy ?? chain.zyskZeSprzedazy,
    zyskOperacyjny: rzis.zyskOperacyjny ?? chain.zyskOperacyjny,
    zyskBrutto: rzis.zyskBrutto ?? chain.zyskBrutto,
    podatek: rzis.podatek ?? chain.podatek,
    zyskNetto: rzis.zyskNetto ?? chain.zyskNetto,
    source: rzis.source,
  };
}
