import type { FinancialInput } from "../../metrics/indicators";
import type { ParsedStatement } from "./parser";
import { sectionsOf, type StatementMeta } from "./layouts";
import { rzisRoles } from "./rzis";

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
  const pozPrzychodyOp = rzis.codes["D"] ?? null;
  const pozKosztyOp = rzis.codes["E"] ?? null;
  const revenue = pozPrzychodyOp !== null ? revenueBase + pozPrzychodyOp : revenueBase;
  const przychodyOperacyjne = revenue;
  const kosztyOperacyjne = rzis.koszty !== null && pozKosztyOp !== null ? rzis.koszty + pozKosztyOp : rzis.koszty;

  const input: Partial<FinancialInput> = {
    revenue,
    operatingRevenue: przychodyOperacyjne,
    salesRevenue: revenueBase,
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
