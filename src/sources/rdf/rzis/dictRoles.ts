import type { ParsedStatement } from "../parser";
import { sectionsOf, type StatementMeta } from "../layouts";
import type { RzisVariant } from "../names";
import type { RzisRoles } from "./types";
import { dictNamesFor, findRoleByDict } from "./matching";

const ROLE_NEEDLES = {
  przychody: "przychody netto ze sprzedazy",
  koszty: "koszty",
  zyskZeSprzedazy: "zysk (strata) ze sprzedazy",
  zyskOperacyjny: "zysk (strata) z dzialalnosci operacyjnej",
  zyskBrutto: "zysk (strata) brutto",
  podatek: "podatek dochodowy",
  zyskNetto: "zysk (strata) netto",
} as const;

/**
 * Dict-driven role resolution: match each role's canonical name in the
 * official CRWDE dictionary for the layout's variant. Returns null when the
 * statement's letters can't be mapped (falls through to the value chain).
 */
export function resolveFromDict(meta: StatementMeta, variant: RzisVariant, statement: ParsedStatement): RzisRoles | null {
  const names = dictNamesFor(meta, variant);
  const rzis = sectionsOf(statement).get("RZiS") ?? new Map<string, number | null>();
  const codes = Object.fromEntries(rzis) as Record<string, number | null>;

  const roleValue = (needle: string): number | null => {
    const code = findRoleByDict(names, needle);
    return code !== null ? (codes[code] ?? null) : null;
  };

  const przychodyCode = findRoleByDict(names, ROLE_NEEDLES.przychody);
  const zyskNettoCode = findRoleByDict(names, ROLE_NEEDLES.zyskNetto);
  const podatekCode = findRoleByDict(names, ROLE_NEEDLES.podatek);
  if (!przychodyCode || !zyskNettoCode || !podatekCode) {
    return null;
  }

  const result: RzisRoles = {
    przychody: roleValue(ROLE_NEEDLES.przychody),
    koszty: roleValue(ROLE_NEEDLES.koszty),
    zyskZeSprzedazy: roleValue(ROLE_NEEDLES.zyskZeSprzedazy),
    zyskOperacyjny: roleValue(ROLE_NEEDLES.zyskOperacyjny),
    zyskBrutto: roleValue(ROLE_NEEDLES.zyskBrutto),
    podatek: roleValue(ROLE_NEEDLES.podatek),
    zyskNetto: roleValue(ROLE_NEEDLES.zyskNetto),
    codes,
    source: "dict",
    variant,
  };
  return result.zyskNetto !== null ? result : null;
}
