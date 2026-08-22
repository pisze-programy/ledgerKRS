import type { StatementMeta } from "./layouts";
import { nameFor, type RzisVariant } from "./names";
import type { RzisRoles } from "./rzis";
import { hasCode } from "./rzis/codes";

export interface RevenueBreakdown {
  total: number | null;
  operating: number | null;
  sales: number | null;
}

const INCOME_LETTERS = "ABCDEFGHIJKLMNOP".split("");

function addParts(base: number | null, ...parts: (number | null | undefined)[]): number | null {
  if (base === null) {
    return null;
  }
  let sum = base;
  for (const part of parts) {
    sum += part ?? 0;
  }
  return sum;
}

function simpleRevenue(rzis: RzisRoles, incomeLetters: string[]): RevenueBreakdown {
  const base = rzis.przychody;
  const total = addParts(base, ...incomeLetters.map((code) => rzis.codes[code]));
  const sales = rzis.przychody;
  return { total, operating: base, sales };
}

function nearTaxIdentity(rzis: RzisRoles): boolean {
  const h = rzis.codes["H"];
  const i = rzis.codes["I"];
  const j = rzis.codes["J"];
  if (h === null || h === undefined || i === null || i === undefined || j === null || j === undefined) {
    return false;
  }
  return Math.abs(h - i - j) < Math.max(1, Math.abs(j) * 1e-4);
}

/**
 * Simplified porównawczy (old Mala/Mikro): H−I=J, no L letter.
 * BizRaport revenue = A+D+F (F is the financial-income letter), op = C+D−E,
 * brutto = op+F−G, podatek = I, netto = J (verified on CONNER + 10 more firms).
 */
function simplifiedRevenue(rzis: RzisRoles): RevenueBreakdown | null {
  if (hasCode(rzis.codes, "L")) {
    return null;
  }
  if (!nearTaxIdentity(rzis)) {
    return null;
  }
  const base = rzis.przychody;
  return {
    total: addParts(base, rzis.codes["D"], rzis.codes["F"]),
    operating: addParts(base, rzis.codes["D"]),
    sales: base,
  };
}

function opRevenue(rzis: RzisRoles): RevenueBreakdown {
  const base = rzis.przychody;
  return {
    total: addParts(base, rzis.codes["D"], rzis.codes["I"], rzis.codes["K"]),
    operating: addParts(base, rzis.codes["D"], rzis.codes["I"]),
    sales: base,
  };
}

function legacyRevenue(rzis: RzisRoles): RevenueBreakdown {
  const base = rzis.przychody;
  return {
    total: addParts(base, rzis.codes["D"], rzis.codes["G"]),
    operating: addParts(base, rzis.codes["D"]),
    sales: base,
  };
}

function truncatedRevenue(rzis: RzisRoles): RevenueBreakdown {
  return simpleRevenue(rzis, ["C"]);
}

/**
 * RZiS comes in two dict variants (kalkulacyjny / porównawczy). The roles
 * resolver records which variant it matched (`rzis.variant`); revenue must
 * use the same variant's dictionary, falling back to the other.
 */
function revenueVariantOrder(rzis: RzisRoles): RzisVariant[] {
  if (rzis.variant === "RZiSKalk") {
    return ["RZiSKalk", "RZiSPor"];
  }
  if (rzis.variant === "RZiSPor") {
    return ["RZiSPor", "RZiSKalk"];
  }
  return ["RZiSPor", "RZiSKalk"];
}

function incomeSumFor(meta: StatementMeta, rzis: RzisRoles, variant: RzisVariant, includeFinancial: boolean): number | null {
  let sum = 0;
  let hasValue = false;
  for (const code of INCOME_LETTERS) {
    const name = nameFor(meta.layout, "RZiS", code, variant);
    if (!name) {
      continue;
    }
    const isIncome = /przychody/i.test(name);
    const isFinancial = /finansowe/i.test(name);
    if (!isIncome || (!includeFinancial && isFinancial)) {
      continue;
    }
    const value = rzis.codes[code];
    if (value !== null && value !== undefined) {
      sum += value;
      hasValue = true;
    }
  }
  return hasValue ? sum : null;
}

/** Revenue = sum of income letters from the dict (BizRaport's "przychody"). */
function dictIncomeRevenue(meta: StatementMeta, rzis: RzisRoles): RevenueBreakdown {
  for (const variant of revenueVariantOrder(rzis)) {
    const total = incomeSumFor(meta, rzis, variant, true);
    if (total !== null) {
      const operating = incomeSumFor(meta, rzis, variant, false);
      return { total, operating, sales: rzis.przychody };
    }
  }
  return { total: null, operating: null, sales: rzis.przychody };
}

export function revenueFor(meta: StatementMeta, rzis: RzisRoles): RevenueBreakdown {
  if (meta.layout === "SFJOPZ") {
    return opRevenue(rzis);
  }
  if (rzis.source === "truncated") {
    return truncatedRevenue(rzis);
  }
  if (meta.layout === "LEGACY") {
    return legacyRevenue(rzis);
  }
  const simplified = simplifiedRevenue(rzis);
  if (simplified) {
    return simplified;
  }
  return dictIncomeRevenue(meta, rzis);
}
