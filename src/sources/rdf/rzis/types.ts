import type { RzisVariant } from "../names";

/** How the RZiS roles were determined for a statement. */
export type RzisRoleSource = "dict" | "chain" | "op-fixed" | "truncated" | "minimal";

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
  /**
   * Total operating costs. Variants that put something else in E (e.g. the
   * truncated Mikro, where E is the tax line) set this explicitly; otherwise
   * the caller adds E as "pozostałe koszty operacyjne" (see indicators.ts).
   */
  operatingCosts?: number | null;
  /** RZiS variant (kalk/por) when roles came from the dict. */
  variant?: RzisVariant;
}
