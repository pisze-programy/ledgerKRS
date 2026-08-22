import { entriesFor } from "./names";
import type { LayoutKey } from "./layouts";

export interface PdfPosition {
  kod: string | null;
  nazwa: string;
  kwota: number | null;
}

const NUM_RE = /[-+]?\d+(?:[\s\u00A0.,]?\d+)*/g;

function parseNumber(raw: string): number | null {
  const cleaned = raw.replace(/[\s\u00A0]/g, "").replace(/\./g, "").replace(",", ".");
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

function extractNumberAfterName(line: string, name: string): number | null {
  const idx = line.indexOf(name);
  if (idx === -1) {
    return null;
  }
  const after = line.slice(idx + name.length);
  const matches = after.match(NUM_RE);
  if (!matches) {
    return null;
  }
  return parseNumber(matches[matches.length - 1]!);
}

export interface PdfExtractOptions {
  layout: LayoutKey;
  wariant?: number | null;
}

export function pdfPositions(text: string, options: PdfExtractOptions): PdfPosition[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const variant = options.wariant === 2 ? "RZiSPor" : "RZiSKalk";
  const result: PdfPosition[] = [];
  const seen = new Set<string>();

  for (const section of ["Bilans", "RZiS", "ZestZmianWKapitale", "RachPrzeplywow"]) {
    const entries = entriesFor(options.layout, section, section === "RZiS" ? variant : undefined);
    for (const [kod, name] of entries) {
      const needle = name.trim();
      if (needle.length < 6 || seen.has(needle)) {
        continue;
      }
      for (const line of lines) {
        const kwota = extractNumberAfterName(line, needle);
        if (kwota !== null) {
          result.push({ kod, nazwa: name, kwota });
          seen.add(needle);
          break;
        }
      }
    }
  }
  return result;
}
