import { XMLParser } from "fast-xml-parser";

export interface StatementPosition {
  pozycja_szczegolowa: string | null;
  kod_pozycji: string | null;
  poziom_zaglebienia: number | null;
  nazwa_pozycji: string | null;
  kwota: number | null;
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

const SECTION_KEYS = [
  "Bilans",
  "RachunekZyskowIStrat",
  "RachunekPrzeplywowPienieznych",
  "ZestawienieZmianWKapitale",
];

export function parseSprawozdanie(xml: string): ParsedStatement | null {
  if (!xml || xml.trim().length === 0) {
    return null;
  }
  const parser = new XMLParser({
    ignoreAttributes: true,
    parseTagValue: false,
    parseAttributeValue: false,
  });
  const root = parser.parse(xml);
  const okresOd = findFirstString(root, /^okresod$/i);
  const okresDo = findFirstString(root, /^okresdo$/i);
  const sekcje = SECTION_KEYS.map((key) => buildSection(root, key)).filter(
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

function buildSection(root: Record<string, unknown>, sectionKey: string): StatementSection {
  const raw = findSectionNode(root, sectionKey) ?? {};
  const pozycje = collectPositions(raw);
  return { sekcja: sectionKey, pozycje };
}

function findSectionNode(node: unknown, sectionKey: string): unknown {
  if (!isRecord(node)) {
    return undefined;
  }
  const key = Object.keys(node).find((k) => k.toUpperCase() === sectionKey.toUpperCase());
  if (key !== undefined) {
    return node[key];
  }
  for (const value of Object.values(node)) {
    const found = findSectionNode(value, sectionKey);
    if (found !== undefined) {
      return found;
    }
  }
  return undefined;
}

function collectPositions(node: unknown): StatementPosition[] {
  if (!isRecord(node)) {
    return [];
  }
  const result: StatementPosition[] = [];
  for (const [key, value] of Object.entries(node)) {
    if (/^pozycja$/i.test(key)) {
      for (const item of toArray(value)) {
        const position = toPosition(item);
        if (position) {
          result.push(position);
        }
      }
      continue;
    }
    if (isRecord(value)) {
      result.push(...collectPositions(value));
    } else if (Array.isArray(value)) {
      for (const item of value) {
        if (isRecord(item)) {
          result.push(...collectPositions(item));
        }
      }
    }
  }
  return result;
}

function toPosition(node: unknown): StatementPosition | null {
  if (!isRecord(node)) {
    return null;
  }
  const kod = findFirstString(node, /^kodpozycji$/i);
  if (!kod) {
    return null;
  }
  return {
    pozycja_szczegolowa: findFirstString(node, /^pozycjaszczegolowa$/i) ?? null,
    kod_pozycji: kod,
    poziom_zaglebienia: toNullableNumber(findFirstString(node, /^poziomzaglebienia$/i)),
    nazwa_pozycji: findFirstString(node, /^nazwapozycji$/i) ?? null,
    kwota: toNullableNumber(findFirstString(node, /^kwota$/i)),
  };
}

function findFirstString(node: unknown, pattern: RegExp): string | undefined {
  if (!isRecord(node)) {
    return undefined;
  }
  const entry = Object.entries(node).find(([key]) => pattern.test(key));
  if (entry) {
    const value = entry[1];
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }
  for (const value of Object.values(node)) {
    if (isRecord(value) || Array.isArray(value)) {
      const found = findFirstString(value, pattern);
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

function toNullableNumber(value: string | undefined | null): number | null {
  if (value == null) {
    return null;
  }
  const normalized = value.replace(/\s/g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function toArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [value];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
