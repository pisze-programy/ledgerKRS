import type { FinancialInput } from "../../metrics/indicators";
import type { ParsedStatement } from "./parser";
import { sectionsOf, type StatementMeta } from "./layouts";
import { rzisRoles, type RzisRoles } from "./rzis";
import { nameFor, entriesFor } from "./names";
import { estimateEmployment } from "../../metrics/employment";
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
  currentLiabilities: ["Bilans", "Pasywa_B_III"],
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

function near(a: number | null, b: number | null): boolean {
  return a !== null && b !== null && Math.abs(a - b) < Math.max(1, Math.abs(b) * 1e-4);
}

/**
 * Suma bilansowa = Aktywa total, preferring the internally consistent side.
 * Statements occasionally file an Aktywa total that does not match its parts
 * while Pasywa is coherent (verified on 0000450927 2018: filed Aktywa
 * 1 047 768,58 vs Aktywa_A+Aktywa_B 4 891 524,75; Pasywa 5 939 293,33 ==
 * Pasywa_A+Pasywa_B — BizRaport reports the Pasywa total). When both sides
 * are coherent we keep the Aktywa convention; otherwise the coherent one wins.
 */
function bilansTotalFor(bySection: Map<string, Map<string, number | null>>): number | null {
  const bilans = bySection.get("Bilans");
  if (!bilans) {
    return null;
  }
  const aktywa = bilans.get("Aktywa") ?? null;
  const pasywa = bilans.get("Pasywa") ?? null;
  if (aktywa !== null && pasywa !== null && !near(aktywa, pasywa)) {
    const aktywaConsistent = near(aktywa, (bilans.get("Aktywa_A") ?? 0) + (bilans.get("Aktywa_B") ?? 0));
    const pasywaConsistent = near(pasywa, (bilans.get("Pasywa_A") ?? 0) + (bilans.get("Pasywa_B") ?? 0));
    if (pasywaConsistent && !aktywaConsistent) {
      return pasywa;
    }
    if (aktywaConsistent && !pasywaConsistent) {
      return aktywa;
    }
  }
  return aktywa ?? pasywa;
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

/**
 * "Wynagrodzenia" is a separate RZiS line only in the porównawczy variant
 * (B_V). In kalkulacyjny it is embedded in the cost-of-sales and not
 * separately reported — returns null there.
 */
function wagesFor(
  meta: StatementMeta,
  rzis: RzisRoles,
  rzisCodes: Map<string, number | null>,
): number | null {
  const variant = rzis.variant;
  if (!variant) {
    return null;
  }
  for (const [code, name] of entriesFor(meta.layout, "RZiS", variant)) {
    if (/wynagrodzeni/i.test(name)) {
      return rzisCodes.get(code) ?? null;
    }
  }
  return null;
}

export function extractFinancialInput(statement: ParsedStatement, meta: StatementMeta): YearFinancials | null {
  const rzis = rzisRoles(statement, meta);
  if (rzis.przychody === null) {
    return null;
  }

  const bySection = sectionsOf(statement);
  const rzisCodes = bySection.get("RZiS") ?? new Map<string, number | null>();
  const revenue = revenueFor(meta, rzis);

  // Variants that treat E as something else (truncated Mikro: the tax line)
  // carry operatingCosts explicitly; otherwise operating costs = koszty + E.
  const pozKosztyOp = rzis.codes["E"] ?? null;
  const operatingCosts =
    rzis.operatingCosts ??
    (rzis.koszty !== null && pozKosztyOp !== null ? rzis.koszty + pozKosztyOp : rzis.koszty);

  const wages = wagesFor(meta, rzis, rzisCodes);
  const employment = wages !== null ? estimateEmployment(wages) : null;

  const input: Partial<FinancialInput> = {
    revenue: revenue.total ?? rzis.przychody,
    operatingRevenue: revenue.operating ?? rzis.przychody,
    salesRevenue: revenue.sales,
    operatingCosts,
    costOfGoodsSold: rzis.koszty,
    wages,
    estimatedEmployees: employment?.estymowane ?? null,
    incomeTax: rzis.podatek,
    amortization: amortizationFor(meta, rzisCodes),
    grossProfitOnSales: rzis.zyskZeSprzedazy,
    profitOnSales: rzis.zyskZeSprzedazy,
    operatingProfit: rzis.zyskOperacyjny,
    grossProfit: rzis.zyskBrutto,
    netProfit: rzis.zyskNetto ?? 0,
    totalAssets: bilansTotalFor(bySection) ?? 0,
    fixedAssets: bilansValue(bySection, "fixedAssets"),
    currentAssets: bilansValue(bySection, "currentAssets"),
    currentLiabilities: bilansValue(bySection, "currentLiabilities"),
    equity: bilansValue(bySection, "equity") ?? 0,
    liabilities: bilansValue(bySection, "liabilities") ?? 0,
  };

  return { okresSprawozdawczy: statement.okres_sprawozdawczy ?? "", rok: statement.rok, input };
}
