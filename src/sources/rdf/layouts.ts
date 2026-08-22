import type { ParsedStatement } from "./parser";

export type LayoutKey = "SFJINZ" | "SFJMAZ" | "SFJMIZ" | "SFJOPZ" | "SFBNKZ" | "LEGACY";

export interface StatementMeta {
  layout: LayoutKey;
  wariant: number | null;
  version: string | null;
}

const XML_LAYOUT_TO_KEY: Record<string, LayoutKey> = {
  JednostkaInna: "SFJINZ",
  JednostkaMala: "SFJMAZ",
  JednostkaMikro: "SFJMIZ",
  JednostkaOp: "SFJOPZ",
  JednostkaPozytkuPublicznego: "SFJOPZ",
  Bank: "SFBNKZ",
};

export function detectLayout(xml: string): LayoutKey {
  const match = xml.match(/<(?:[A-Za-z0-9]+:)?(Jednostka[A-Za-z]*|Bank)[\s>]/);
  if (!match) {
    return "LEGACY";
  }
  return XML_LAYOUT_TO_KEY[match[1]!] ?? "LEGACY";
}

export function detectWariant(xml: string): number | null {
  const match = xml.match(/<[A-Za-z0-9]+:WariantSprawozdania>([^<]+)</);
  if (!match) {
    return null;
  }
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

export function detectVersion(xml: string): string | null {
  const match = xml.match(/wersjaSchemy="([^"]+)"/);
  return match?.[1] ?? null;
}

export function statementMeta(xml: string): StatementMeta {
  return {
    layout: detectLayout(xml),
    wariant: detectWariant(xml),
    version: detectVersion(xml),
  };
}

export function hasDokumentWrapper(xml: string): boolean {
  return /<Dokument[\s>]/.test(xml) || /<(?:[A-Za-z0-9]+:)?Dokument[\s>]/.test(xml);
}

export function isXadesWrapped(xml: string): boolean {
  return /<(?:ds:)?Signature[\s>]/.test(xml);
}

export function sectionsOf(statement: ParsedStatement): Map<string, Map<string, number | null>> {
  const bySection = new Map<string, Map<string, number | null>>();
  for (const section of statement.sekcje) {
    const internal =
      section.sekcja === "Rachunek zysków i strat"
        ? "RZiS"
        : section.sekcja === "Zestawienie zmian w kapitale"
          ? "ZestZmianWKapitale"
          : section.sekcja === "Rachunek przepływów pieniężnych"
            ? "RachPrzeplywow"
            : section.sekcja;
    const codes = new Map<string, number | null>();
    for (const p of section.pozycje) {
      if (p.kod_pozycji) {
        codes.set(p.kod_pozycji, p.kwota);
      }
    }
    bySection.set(internal, codes);
  }
  return bySection;
}
