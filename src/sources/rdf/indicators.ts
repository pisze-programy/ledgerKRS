import type { FinancialInput } from "../../metrics/indicators";
import type { ParsedStatement } from "./parser";
import { sectionsOf, type StatementMeta } from "./layouts";
import { rzisRoles } from "./rzis";
import { revenueFor } from "./revenue";

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

/** Amortyzacja sits at B_I in modern layouts and B_VIII in legacy statements. */
function amortizationFor(
  meta: StatementMeta,
  rzisCodes: Map<string, number | null>,
): number | null {
  const [primary, fallback] = meta.layout === "LEGACY" ? ["B_VIII", "B_I"] : ["B_I", "B_VIII"];
  const primaryValue = rzisCodes.get(primary);
  if (primaryValue !== null && primaryValue !== undefined) {
    return primaryValue;
  }
  return rzisCodes.get(fallback) ?? null;
}

export function extractFinancialInput(statement: ParsedStatement, meta: StatementMeta): YearFinancials | null {
  const rzis = rzisRoles(statement, meta);
  if (rzis.przychody === null) {
    return null;
  }

  const bySection = sectionsOf(statement);
  const rzisCodes = bySection.get("RZiS") ?? new Map<string, number | null>();
  const revenue = revenueFor(meta, rzis);

  const pozKosztyOp = rzis.codes["E"] ?? null;
  const operatingCosts = rzis.koszty !== null && pozKosztyOp !== null ? rzis.koszty + pozKosztyOp : rzis.koszty;

  const input: Partial<FinancialInput> = {
    revenue: revenue.total ?? rzis.przychody,
    operatingRevenue: revenue.operating ?? rzis.przychody,
    salesRevenue: revenue.sales,
    operatingCosts,
    costOfGoodsSold: rzis.koszty,
    incomeTax: rzis.podatek,
    amortization: amortizationFor(meta, rzisCodes),
    grossProfitOnSales: rzis.zyskZeSprzedazy,
    profitOnSales: rzis.zyskZeSprzedazy,
    operatingProfit: rzis.zyskOperacyjny,
    grossProfit: rzis.zyskBrutto,
    netProfit: rzis.zyskNetto ?? 0,
    totalAssets: bilansValue(bySection, "totalAssets") ?? 0,
    fixedAssets: bilansValue(bySection, "fixedAssets"),
    currentAssets: bilansValue(bySection, "currentAssets"),
    equity: bilansValue(bySection, "equity") ?? 0,
    liabilities: bilansValue(bySection, "liabilities") ?? 0,
  };

  return { okresSprawozdawczy: statement.okres_sprawozdawczy ?? "", rok: statement.rok, input };
}
