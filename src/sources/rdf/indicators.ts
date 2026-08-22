import type { FinancialInput } from "../../metrics/indicators";
import type { ParsedStatement } from "./parser";
import { sectionsOf, type StatementMeta } from "./layouts";
import { rzisRoles, type RzisRoles } from "./rzis";
import { nameFor, rzisVariantOf, type RzisVariant } from "./names";

export interface YearFinancials {
  okresSprawozdawczy: string;
  rok: number | null;
  input: Partial<FinancialInput>;
}

const BILANS_CODES: Record<string, [string, string]> = {
  totalAssets: ["Bilans", "Aktywa"],
  fixedAssets: ["Bilans", "Aktywa_A"],
  currentAssets: ["Bilans", "Aktywa_B"],
  equity: ["Bilans", "Pasywa_A"],
  liabilities: ["Bilans", "Pasywa_B"],
};

function bilansValue(
  meta: StatementMeta,
  bySection: Map<string, Map<string, number | null>>,
  key: keyof typeof BILANS_CODES,
): number | null {
  const entry = BILANS_CODES[key];
  if (!entry) {
    return null;
  }
  const [section, code] = entry;
  return bySection.get(section)?.get(code) ?? null;
}

const INCOME_LETTERS = "ABCDEFGHIJKLMNOP".split("");

function incomeSumFor(meta: StatementMeta, rzis: RzisRoles, variant: RzisVariant, financial: boolean): number | null {
  let sum = 0;
  let has = false;
  for (const code of INCOME_LETTERS) {
    const name = nameFor(meta.layout, "RZiS", code, variant);
    if (!name) {
      continue;
    }
    const isIncome = /przychody/i.test(name);
    const isFinancial = /finansowe/i.test(name);
    if (!isIncome || (financial === false && isFinancial)) {
      continue;
    }
    const value = rzis.codes[code] ?? null;
    if (value !== null) {
      sum += value;
      has = true;
    }
  }
  return has ? sum : null;
}

function revenueFor(meta: StatementMeta, rzis: RzisRoles): { total: number | null; operating: number | null; sales: number | null } {
  if (meta.layout === "LEGACY") {
    const a = rzis.przychody;
    const d = rzis.codes["D"] ?? null;
    const g = rzis.codes["G"] ?? null;
    const total = a !== null ? a + (d ?? 0) + (g ?? 0) : null;
    const operating = a !== null ? a + (d ?? 0) : null;
    return { total, operating, sales: a };
  }
  const variants: RzisVariant[] = ["RZiSPor", "RZiSKalk"];
  let total: number | null = null;
  let operating: number | null = null;
  for (const variant of variants) {
    const t = incomeSumFor(meta, rzis, variant, true);
    const o = incomeSumFor(meta, rzis, variant, false);
    if (t !== null) {
      total = t;
      operating = o;
      break;
    }
  }
  return { total, operating, sales: rzis.przychody };
}

export function extractFinancialInput(statement: ParsedStatement, meta: StatementMeta): YearFinancials | null {
  const rzis = rzisRoles(statement, meta);
  const bySection = sectionsOf(statement);
  const rzisCodes = bySection.get("RZiS") ?? new Map<string, number | null>();
  const rok = statement.rok;
  const okres = statement.okres_sprawozdawczy ?? "";

  const amortyzacja =
    meta.layout === "LEGACY"
      ? rzisCodes.get("B_VIII") ?? rzisCodes.get("B_I") ?? null
      : rzisCodes.get("B_I") ?? rzisCodes.get("B_VIII") ?? null;

  const revenueBase = rzis.przychody;
  if (revenueBase === null) {
    return null;
  }
  const pozKosztyOp = rzis.codes["E"] ?? null;
  const revenue = revenueFor(meta, rzis);
  const przychodyOperacyjne = revenue.operating ?? revenueBase;
  const kosztyOperacyjne = rzis.koszty !== null && pozKosztyOp !== null ? rzis.koszty + pozKosztyOp : rzis.koszty;

  const input: Partial<FinancialInput> = {
    revenue: revenue.total ?? revenueBase,
    operatingRevenue: przychodyOperacyjne,
    salesRevenue: revenue.sales,
    operatingCosts: kosztyOperacyjne,
    costOfGoodsSold: rzis.koszty,
    incomeTax: rzis.podatek,
    amortization: amortyzacja,
    grossProfitOnSales: rzis.zyskZeSprzedazy,
    profitOnSales: rzis.zyskZeSprzedazy,
    operatingProfit: rzis.zyskOperacyjny,
    grossProfit: rzis.zyskBrutto,
    netProfit: rzis.zyskNetto ?? 0,
    totalAssets: bilansValue(meta, bySection, "totalAssets") ?? 0,
    fixedAssets: bilansValue(meta, bySection, "fixedAssets"),
    currentAssets: bilansValue(meta, bySection, "currentAssets"),
    equity: bilansValue(meta, bySection, "equity") ?? 0,
    liabilities: bilansValue(meta, bySection, "liabilities") ?? 0,
  };

  return { okresSprawozdawczy: okres, rok, input };
}
