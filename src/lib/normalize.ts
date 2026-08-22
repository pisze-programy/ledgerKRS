export function padKrs(value: string): string {
  const digits = value.replace(/\D/g, "");
  return digits.padStart(10, "0");
}

export function toIsoDate(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0) {
    return null;
  }
  const match = value.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (!match) {
    return null;
  }
  const [, day, month, year] = match;
  return `${year}-${month!.padStart(2, "0")}-${day!.padStart(2, "0")}`;
}

export function toNumber(value: unknown): number | null {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value !== "string" || value.length === 0) {
    return null;
  }
  const normalized = value.replace(/[\s\u00A0]/g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}
