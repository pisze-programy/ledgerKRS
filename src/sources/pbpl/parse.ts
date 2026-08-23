/**
 * Parser for the pb.pl financial-reports table
 * (notowania.pb.pl/instrument/{ISIN}/{symbol}/raporty-finansowe).
 *
 * The page stores each value in a cell as a JSON object inside the
 * `data-raw-value` attribute: `{"value":"233217182"}` (HTML-encoded quotes).
 * Row labels are quoted strings: `"Wynik z tytułu odsetek"`. Values are in
 * thousands of PLN for balance-sheet items.
 */

export interface PbplSeriesPoint {
  /** Period label from the table header, e.g. "IV Q 2020". */
  period: string;
  /** Calendar quarter of the period, 1..4 (IV Q is the annual value). */
  quarter: number;
  /** Calendar year of the period. */
  year: number;
  /** Parsed value (already in the source unit, typically thousands). */
  value: number | null;
}

export interface PbplIndicator {
  /** Row label, e.g. "Aktywa (tys. zł)". */
  name: string;
  /** Series values in period order. */
  series: PbplSeriesPoint[];
}

const ENTITY_MAP: Record<string, string> = {
  "&quot;": '"',
  "&#34;": '"',
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&nbsp;": " ",
  "&#39;": "'",
};

/** Decode the HTML entities that appear in the page attributes. */
export function decodeEntities(text: string): string {
  return text.replace(/&(quot|#34|amp|lt|gt|nbsp|#39);/g, (match) => ENTITY_MAP[match] ?? match);
}

/**
 * Parse one `data-raw-value` attribute into its semantic value.
 * The attribute is either a JSON object `{"value":"123"}` or a quoted
 * string `"Wynik z tytułu odsetek"`.
 */
export function parseRawValue(raw: string): string | null {
  const decoded = decodeEntities(raw.trim());
  if (decoded.startsWith("{")) {
    try {
      const obj = JSON.parse(decoded) as { value?: string | number };
      return obj.value !== undefined ? String(obj.value) : null;
    } catch {
      return null;
    }
  }
  if (decoded.startsWith('"') && decoded.endsWith('"')) {
    return decoded.slice(1, -1);
  }
  return decoded.length > 0 ? decoded : null;
}

/** Convert a value string to a number. Null for empty or non-numeric input. */
export function toNumber(value: string | null): number | null {
  if (value === null || value.trim() === "") {
    return null;
  }
  const cleaned = value.replace(/\s/g, "").replace(",", ".");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

const PERIOD_RE = /^([IVX]+)\s+Q\s+(\d{4})$/;

function romanToQuarter(roman: string): number | null {
  const map: Record<string, number> = { I: 1, II: 2, III: 3, IV: 4 };
  return map[roman.toUpperCase()] ?? null;
}

/** Parse a period label such as "II Q 1998" into quarter and year. */
export function parsePeriodLabel(label: string): { quarter: number; year: number } | null {
  const match = label.trim().match(PERIOD_RE);
  if (!match) {
    return null;
  }
  const quarter = romanToQuarter(match[1]!);
  if (quarter === null) {
    return null;
  }
  const year = Number(match[2]!);
  return Number.isFinite(year) ? { quarter, year } : null;
}

interface Cell {
  rawValue: string | null;
  text: string;
}

const CELL_RE = /<td\b[^>]*>([\s\S]*?)<\/td>/g;
const ROW_RE = /<tr\b[^>]*>([\s\S]*?)<\/tr>/g;
const HEADER_CELL_RE = /<th\b[^>]*>([\s\S]*?)<\/th>/g;
const RAW_VALUE_RE = /data-raw-value="([^"]*)"/i;
const TEXT_RE = /<[^>]+>/g;

function visibleText(cellHtml: string): string {
  return decodeEntities(cellHtml.replace(TEXT_RE, " ")).replace(/\s+/g, " ").trim();
}

function rawValueOf(cellHtml: string): string | null {
  const match = cellHtml.match(RAW_VALUE_RE);
  if (!match) {
    return null;
  }
  return parseRawValue(match[1]!);
}

function parseCells(rowHtml: string): Cell[] {
  const cells: Cell[] = [];
  for (const match of rowHtml.matchAll(CELL_RE)) {
    const cellHtml = match[1]!;
    const raw = rawValueOf(cellHtml);
    cells.push({
      // Value cells carry the JSON attribute; a cell without the attribute
      // falls back to its visible text (the label or a plain value).
      rawValue: raw ?? (cellHtml.includes("data-raw-value") ? null : visibleText(cellHtml)),
      text: visibleText(cellHtml),
    });
  }
  return cells;
}

/** Extract the period headers from the table head. */
export function parseHeaders(html: string): string[] {
  const table = extractTable(html);
  const headers: string[] = [];
  for (const match of table.matchAll(HEADER_CELL_RE)) {
    const text = visibleText(match[1]!);
    if (text && text !== "Wskaźnik" && text !== "Wykres") {
      headers.push(text);
    }
  }
  return headers;
}

function extractTable(html: string): string {
  const tableMatch = html.match(/<table\b[^>]*m-quotes-data-table[^>]*>([\s\S]*?)<\/table>/i);
  return tableMatch ? tableMatch[1]! : html;
}

/**
 * Parse the financial-reports page into indicator series.
 * Rows without a usable label or with no values are skipped.
 */
export function parseFinancialReport(html: string): PbplIndicator[] {
  const table = extractTable(html);
  const headers = parseHeaders(html);
  const result: PbplIndicator[] = [];
  for (const match of table.matchAll(ROW_RE)) {
    const cells = parseCells(match[1]!);
    if (cells.length < 2) {
      continue;
    }
    const name = cells[0]!.rawValue ?? cells[0]!.text;
    if (!name || name === "Wskaźnik" || name === "Wykres") {
      continue;
    }
    const series: PbplSeriesPoint[] = [];
    for (let i = 1; i < cells.length && i - 1 < headers.length; i += 1) {
      const period = headers[i - 1]!;
      const parsed = parsePeriodLabel(period);
      const raw = cells[i]!.rawValue;
      const value = toNumber(raw);
      if (parsed) {
        series.push({ period, quarter: parsed.quarter, year: parsed.year, value });
      }
    }
    if (series.length > 0) {
      result.push({ name, series });
    }
  }
  return result;
}
