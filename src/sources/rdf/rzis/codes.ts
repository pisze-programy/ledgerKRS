import type { ParsedStatement } from "../parser";

/** Single/two-letter RZiS position codes (A, B_I, …) with their amounts. */
export function letterCodes(statement: ParsedStatement): Record<string, number | null> {
  const rzis = statement.sekcje.find((s) => s.sekcja === "Rachunek zysków i strat");
  const codes: Record<string, number | null> = {};
  if (rzis) {
    for (const position of rzis.pozycje) {
      if (position.kod_pozycji && /^[A-Z]{1,2}$/.test(position.kod_pozycji)) {
        codes[position.kod_pozycji] = position.kwota;
      }
    }
  }
  return codes;
}

/** Undefined -> null (the "not present" marker), otherwise the value. */
export function codeValue(codes: Record<string, number | null>, code: string): number | null {
  return codes[code] ?? null;
}

/** True when the statement actually fills the given code. */
export function hasCode(codes: Record<string, number | null>, code: string): boolean {
  return codes[code] !== undefined;
}
