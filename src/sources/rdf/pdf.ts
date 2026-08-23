import { entriesFor } from "./names";
import type { LayoutKey } from "./layouts";
import { htmlToText } from "./htmlToText";

export interface PdfPosition {
  kod: string | null;
  nazwa: string;
  kwota: number | null;
}

const NUM_RE = /[-+]?\d+(?:[\s\u00A0.,]?\d+)*/;

function parseNumber(raw: string): number | null {
  const cleaned = raw.replace(/[\s\u00A0]/g, "").replace(/\./g, "").replace(",", ".");
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

/** A line that is purely a numeric amount (thousands separators allowed). */
function isAmountLine(line: string): boolean {
  const cleaned = line.replace(/[\s\u00A0]/g, "").replace(/\./g, "").replace(",", ".");
  return /^[-+]?\d+$/.test(cleaned);
}

/**
 * PDF-rendered statements (banks, firms without XML) land each table cell on
 * its own line: the position name on one line and the amount on the next.
 * Returns the first amount that follows a matching name line (or trails it on
 * the same line), scaled by the statement's declared unit.
 */
export function pdfPositions(text: string, options: PdfExtractOptions): PdfPosition[] {
  const lines = htmlToText(text);
  const scale = detectScale(lines);
  const variant = options.wariant === 2 ? "RZiSPor" : "RZiSKalk";
  const result: PdfPosition[] = [];
  const seen = new Set<string>();

  for (const section of ["Bilans", "RZiS", "ZestZmianWKapitale", "RachPrzeplywow"]) {
    const entries = entriesFor(options.layout, section, section === "RZiS" ? variant : undefined);
    for (const [kod, name] of entries) {
      const needle = name.trim().replace(/\s+/g, " ").toLowerCase();
      if (needle.length < 6 || seen.has(needle)) {
        continue;
      }
      for (let i = 0; i < lines.length - 1; i += 1) {
        const line = lines[i]!.toLowerCase();
        const isNameLine = line === needle || line.startsWith(needle);
        if (!isNameLine) {
          continue;
        }
        const value = valueAfterName(lines, i, needle);
        if (value !== null) {
          result.push({ kod, nazwa: name, kwota: value * scale });
          seen.add(needle);
          break;
        }
      }
    }
  }
  return result;
}

/** Amount on the name line (after the name) or on the next data line. */
function valueAfterName(lines: string[], nameIndex: number, needle: string): number | null {
  const sameLine = lines[nameIndex]!.slice(needle.length);
  const sameLineAmount = sameLine.match(NUM_RE)?.[0];
  if (sameLineAmount !== undefined) {
    const parsed = parseNumber(sameLineAmount);
    if (parsed !== null) {
      return parsed;
    }
  }
  // next data line is the amount (table cell on its own line)
  if (isAmountLine(lines[nameIndex + 1]!)) {
    return parseNumber(lines[nameIndex + 1]!);
  }
  return null;
}

/** Statements filed in thousands of zł declare it in the document body. */
export function detectScale(lines: string[]): number {
  return lines.some((line) => /w tysi[ąa]cach zł/i.test(line) || /w tys\. zł/i.test(line)) ? 1000 : 1;
}

export interface PdfExtractOptions {
  layout: LayoutKey;
  wariant?: number | null;
}
