import type { ParsedStatement } from "../parser";
import type { StatementMeta } from "../layouts";
import type { RzisVariant } from "../names";
import type { RzisRoles } from "./types";
import { resolveFromDict } from "./dictRoles";
import { opStatutoryRoles, truncatedMikroRoles, minimalMikroRoles } from "./fixedRoles";
import { chainFromCodes, fillMissingFromChain, rzisRolesFromChain } from "./chain";
import { letterCodes } from "./codes";

export type { RzisRoles, RzisRoleSource } from "./types";
export { chainFromCodes, rzisRolesFromChain } from "./chain";

const DICT_VARIANTS: RzisVariant[] = ["RZiSKalk", "RZiSPor"];

/**
 * Role resolution order — most specific first:
 * 1. Explicit per-form maps for structures the CRWDE dicts don't describe
 *    (old Op statutory RZiS, truncated Mikro) — see `fixedRoles.ts`.
 * 2. Dict-driven roles: match each role's canonical name in the official
 *    CRWDE dictionary for the layout's variant (`dictRoles.ts`).
 * 3. The value chain (accounting identities) as the universal fallback.
 */
export function rzisRoles(statement: ParsedStatement, meta: StatementMeta): RzisRoles {
  const opFixed = opStatutoryRoles(statement, meta);
  if (opFixed) {
    return opFixed;
  }
  const truncated = truncatedMikroRoles(statement, meta);
  if (truncated) {
    return truncated;
  }
  const minimal = minimalMikroRoles(statement, meta);
  if (minimal) {
    return minimal;
  }
  for (const variant of DICT_VARIANTS) {
    const fromDict = resolveFromDict(meta, variant, statement);
    if (fromDict) {
      return fillMissingFromChain(fromDict, statement);
    }
  }
  const fromChain = rzisRolesFromChain(statement);
  if (fromChain) {
    return fromChain;
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
