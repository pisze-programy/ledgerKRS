import type { ParsedStatement } from "../parser";
import type { StatementMeta } from "../layouts";
import type { RzisRoles } from "./types";
import { codeValue, hasCode, letterCodes } from "./codes";

/**
 * Old-schema JednostkaOp (pożytku publicznego) statutory RZiS.
 * Companies file letters A..O even in current filings; BizRaport reads them as
 * op=H, brutto=M, netto=O, podatek=0 (verified 21/21 company-years across 3 Op
 * companies against BizRaport ground truth; identity H−I=J holds). The newest
 * CRWDE SFJOPZ dict uses standard letters (F=op, I=brutto, L=netto) and does
 * not describe these filings, so the role map is explicit.
 */
export function opStatutoryRoles(statement: ParsedStatement, meta: StatementMeta): RzisRoles | null {
  if (meta.layout !== "SFJOPZ") {
    return null;
  }
  const codes = letterCodes(statement);
  if (!(hasCode(codes, "H") && hasCode(codes, "M") && hasCode(codes, "O"))) {
    return null;
  }
  return {
    przychody: codeValue(codes, "A"),
    koszty: codeValue(codes, "B"),
    zyskZeSprzedazy: codeValue(codes, "C"),
    zyskOperacyjny: codeValue(codes, "H"),
    zyskBrutto: codeValue(codes, "M"),
    podatek: 0,
    zyskNetto: codeValue(codes, "O"),
    codes,
    source: "op-fixed",
  };
}

/**
 * Truncated Mikro (RZiS limited to A..F, no H..L): a partial structure some
 * small companies file. BizRaport's reading is fixed and consistent (verified
 * on 0000080829 across 8 years and 0000554503 2021):
 *   - przychody = A (+ C in revenue), koszty = B,
 *   - zysk operacyjny = A − B (BizRaport ignores C/D/E here),
 *   - podatek = E (the final cost line doubles as the tax line),
 *   - zysk netto = F (the last letter),
 *   - brutto and zysk ze sprzedaży are not reported.
 * E is the tax, so it must not be folded back into operating costs.
 */
export function truncatedMikroRoles(statement: ParsedStatement, meta: StatementMeta): RzisRoles | null {
  if (meta.layout !== "SFJMIZ" && meta.layout !== "SFJMAZ") {
    return null;
  }
  const codes = letterCodes(statement);
  const letters = Object.keys(codes)
    .filter((code) => /^[A-Z]$/.test(code))
    .sort((a, b) => a.localeCompare(b));
  if (letters.some((code) => code >= "H")) {
    return null;
  }
  if (!(hasCode(codes, "A") && hasCode(codes, "B") && hasCode(codes, "C")) || letters.length < 5) {
    return null;
  }
  const przychody = codeValue(codes, "A");
  const koszty = codeValue(codes, "B");
  const nettoLetter = letters[letters.length - 1]!;
  return {
    przychody,
    koszty,
    zyskZeSprzedazy: null,
    zyskOperacyjny: przychody !== null && koszty !== null ? przychody - koszty : null,
    zyskBrutto: null,
    podatek: codeValue(codes, "E"),
    zyskNetto: codeValue(codes, nettoLetter),
    operatingCosts: koszty,
    codes,
    source: "truncated",
  };
}
