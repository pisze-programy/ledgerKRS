import type { RzisVariant } from "../names";

/** How the RZiS roles were determined for a statement. */
export type RzisRoleSource = "dict" | "chain" | "op-fixed" | "truncated";

export interface RzisRoles {
  przychody: number | null;
  koszty: number | null;
  zyskZeSprzedazy: number | null;
  zyskOperacyjny: number | null;
  zyskBrutto: number | null;
  podatek: number | null;
  zyskNetto: number | null;
  codes: Record<string, number | null>;
  source: RzisRoleSource;
  /** RZiS variant (kalk/por) when roles came from the dict. */
  variant?: RzisVariant;
}
