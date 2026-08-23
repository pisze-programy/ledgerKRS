/** Average gross salary assumption (PLN/month) used when real data is missing. */
export const DEFAULT_AVG_GROSS_SALARY = 8_000;

export interface EmploymentEstimate {
  estymowane: number;
  podstawa: "wynagrodzenia" | "skala" | null;
}

/**
 * Estimate headcount from the "Wynagrodzenia" line (RZiS B_V) divided by an
 * average annual salary. Returns null when no wage data is available.
 */
export function estimateEmployment(
  wages: number | null | undefined,
  averageSalary = DEFAULT_AVG_GROSS_SALARY,
): EmploymentEstimate | null {
  if (wages === null || wages === undefined || wages <= 0 || averageSalary <= 0) {
    return null;
  }
  const annualSalary = averageSalary * 12;
  const estimate = Math.round(wages / annualSalary);
  return { estymowane: Math.max(estimate, 1), podstawa: "wynagrodzenia" };
}
