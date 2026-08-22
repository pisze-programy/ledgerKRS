import { XMLParser } from "fast-xml-parser";
import { POSITION_NAMES } from "./positions";

export interface StatementPosition {
  pozycja_szczegolowa: string | null;
  kod_pozycji: string | null;
  poziom_zaglebienia: number | null;
  nazwa_pozycji: string | null;
  kwota: number | null;
  kwota_poprzedni_rok: number | null;
}

export interface StatementSection {
  sekcja: string;
  pozycje: StatementPosition[];
}

export interface ParsedStatement {
  okres_sprawozdawczy: string | null;
  rok: number | null;
  sekcje: StatementSection[];
}

const SECTION_KEYS = ["Bilans", "RZiS", "ZestZmianWKapitale", "RachPrzeplywow"] as const;

const SECTION_LABELS: Record<string, string> = {
  Bilans: "Bilans",
  RZiS: "Rachunek zysków i strat",
  ZestZmianWKapitale: "Zestawienie zmian w kapitale",
  RachPrzeplywow: "Rachunek przepływów pieniężnych",
};

export function parseSprawozdanie(xml: string): ParsedStatement | null {
  if (!xml || xml.trim().length === 0) {
    return null;
  }
  const parser = new XMLParser({
    ignoreAttributes: false,
    parseTagValue: false,
    parseAttributeValue: false,
    removeNSPrefix: true,
  });
  const root = parser.parse(xml) as Record<string, unknown>;
  const okresOd = findText(root, /^OkresOd$/i);
  const okresDo = findText(root, /^OkresDo$/i);
  const sekcje = SECTION_KEYS.map((section) => buildSection(root, section)).filter(
    (section) => section.pozycje.length > 0,
  );
  if (sekcje.length === 0 && !okresOd && !okresDo) {
    return null;
  }
  return {
    okres_sprawozdawczy: okresOd && okresDo ? `${okresOd}_${okresDo}` : null,
    rok: extractYear(okresDo),
    sekcje,
  };
}

function buildSection(root: Record<string, unknown>, section: string): StatementSection {
  const node = findNode(root, section);
  const pozycje: StatementPosition[] = [];
  if (isRecord(node)) {
    collectPositions(node, pozycje, section, 0);
  }
  return { sekcja: SECTION_LABELS[section] ?? section, pozycje };
}

function collectPositions(
  node: Record<string, unknown>,
  out: StatementPosition[],
  section: string,
  depth: number,
): void {
  for (const [key, value] of Object.entries(node)) {
    if (value === undefined || value === null) {
      continue;
    }
    const kod = stripPrefix(key);
    if (/^KwotaA$/i.test(kod) || /^KwotaB$/i.test(kod) || /^KwotyPozycji$/i.test(kod)) {
      continue;
    }
    if (isRecord(value)) {
      if (hasAmountKeys(value)) {
        out.push({
          pozycja_szczegolowa: null,
          kod_pozycji: kod,
          poziom_zaglebienia: depth,
          nazwa_pozycji: POSITION_NAMES[section]?.[kod] ?? null,
          kwota: toNullableNumber(textOf(value, "KwotaA")),
          kwota_poprzedni_rok: toNullableNumber(textOf(value, "KwotaB")),
        });
      }
      collectPositions(value, out, section, depth + 1);
      continue;
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        if (isRecord(item)) {
          if (hasAmountKeys(item)) {
            out.push({
              pozycja_szczegolowa: null,
              kod_pozycji: kod,
              poziom_zaglebienia: depth,
              nazwa_pozycji: POSITION_NAMES[section]?.[kod] ?? null,
              kwota: toNullableNumber(textOf(item, "KwotaA")),
              kwota_poprzedni_rok: toNullableNumber(textOf(item, "KwotaB")),
            });
          }
          collectPositions(item, out, section, depth + 1);
        }
      }
    }
  }
}

function hasAmountKeys(node: Record<string, unknown>): boolean {
  return Object.keys(node).some((key) => /^Kwota[AB]$/i.test(stripPrefix(key)));
}

function stripPrefix(key: string): string {
  return key.replace(/^[A-Za-z0-9]+:/, "");
}

function textOf(node: Record<string, unknown>, key: string): string | null {
  for (const [k, v] of Object.entries(node)) {
    if (k.replace(/^[A-Za-z0-9]+:/, "").toLowerCase() === key.toLowerCase()) {
      return typeof v === "string" ? v : null;
    }
  }
  return null;
}

function findNode(node: unknown, name: string): unknown {
  if (!isRecord(node)) {
    return undefined;
  }
  for (const [key, value] of Object.entries(node)) {
    if (key.replace(/^[A-Za-z0-9]+:/, "").toLowerCase() === name.toLowerCase()) {
      return value;
    }
  }
  for (const value of Object.values(node)) {
    if (isRecord(value)) {
      const found = findNode(value, name);
      if (found !== undefined) {
        return found;
      }
    }
  }
  return undefined;
}

function findText(node: unknown, pattern: RegExp): string | undefined {
  if (!isRecord(node)) {
    return undefined;
  }
  const entry = Object.entries(node).find(([key]) => pattern.test(key.replace(/^[A-Za-z0-9]+:/, "")));
  if (entry) {
    const value = entry[1];
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }
  for (const value of Object.values(node)) {
    if (isRecord(value) || Array.isArray(value)) {
      const found = findText(value, pattern);
      if (found !== undefined) {
        return found;
      }
    }
  }
  return undefined;
}

function extractYear(value: string | undefined | null): number | null {
  if (!value) {
    return null;
  }
  const match = value.match(/(\d{4})/);
  return match ? Number(match[1]) : null;
}

function toNullableNumber(value: string | null | undefined): number | null {
  if (value == null || value.trim().length === 0) {
    return null;
  }
  const normalized = value.replace(/\s/g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
