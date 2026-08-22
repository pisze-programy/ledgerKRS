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
 * small companies file. BizRaport reports przychody=A+C and netto=last letter
 * (verified 7/7 against BizRaport). op/brutto/podatek are not derivable, so we
 * leave them null rather than fabricate.
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
  const nettoLetter = letters[letters.length - 1]!;
  return {
    przychody: codeValue(codes, "A"),
    koszty: codeValue(codes, "B"),
    zyskZeSprzedazy: codeValue(codes, "C"),
    zyskOperacyjny: null,
    zyskBrutto: null,
    podatek: null,
    zyskNetto: codeValue(codes, nettoLetter),
    codes,
    source: "truncated",
  };
}
