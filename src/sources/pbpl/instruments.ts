/**
 * Instrument inventory from the pb.pl stock table
 * (notowania.pb.pl/stocktable/GPWAKCJE) and resolution of a KRS company to
 * its listed instrument. Each listed company has an ISIN and a symbol; the
 * report URL is notowania.pb.pl/instrument/{ISIN}/{symbol}/raporty-finansowe.
 */

export interface Instrument {
  isin: string;
  symbol: string;
  name: string | null;
}

const INSTRUMENT_ANCHOR_RE =
  /<a\b[^>]*href="[^"]*\/instrument\/(PL[A-Z0-9]{10,12})\/([a-z0-9-]+)\/?"[^>]*>([^<]{1,120})<\/a>/gi;

/** Normalized company-name key: lower case, diacritics and stroke-l stripped. */
export function normalizeName(name: string): string {
  return name
    .replace(/ł/g, "l")
    .replace(/Ł/g, "L")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

const STOPWORDS = new Set(["sa", "s a", "s.a", "s.a.", "sp", "sp.", "spolka", "akcyjna", "z", "o", "o.o", "o.o."]);

/** Distinct significant tokens of a company name. */
export function nameTokens(name: string): string[] {
  return normalizeName(name)
    .split(" ")
    .filter((token) => token !== "" && !STOPWORDS.has(token));
}

/**
 * Parse the GPWAKCJE stock-table page into instruments.
 * Each row links to the instrument profile and shows the company name.
 * Duplicate instruments are skipped.
 */
export function parseInstrumentTable(html: string): Instrument[] {
  const instruments: Instrument[] = [];
  const seen = new Set<string>();
  for (const match of html.matchAll(INSTRUMENT_ANCHOR_RE)) {
    const isin = match[1]!;
    const symbol = match[2]!;
    if (seen.has(isin)) {
      continue;
    }
    seen.add(isin);
    instruments.push({ isin, symbol, name: match[3]!.trim() });
  }
  return instruments;
}

/**
 * Confirmed company-name keys for instruments whose pb.pl short name cannot
 * be matched by token overlap with the KRS legal name (acronyms and aliases).
 * Each entry lists tokens that must all appear in the KRS company name.
 * Verified against the public sources during the research.
 */
const CONFIRMED_MAP: Record<string, { tokens: string[]; symbol: string }> = {
  PLPEKAO00016: { tokens: ["opieki"], symbol: "pekao" },
  PLPKO0000016: { tokens: ["oszczednosci", "polski"], symbol: "pkobp" },
  PLBRE0000012: { tokens: ["mbank"], symbol: "mbank" },
  PLBZ00000044: { tokens: ["erste"], symbol: "erstepl" },
  PLBSK0000017: { tokens: ["slaski"], symbol: "ingbsk" },
  PLALIOR00045: { tokens: ["alior"], symbol: "alior" },
  PLBGZ0000010: { tokens: ["bnp", "paribas"], symbol: "bnpppl" },
  PLBIG0000016: { tokens: ["millennium"], symbol: "millennium" },
  PLBH00000012: { tokens: ["handlowy"], symbol: "handlowy" },
  PLBOS0000019: { tokens: ["ochrony"], symbol: "bos" },
  PLPZU0000011: { tokens: ["ubezpieczen"], symbol: "pzu" },
};

/** Find the instrument confirmed for the KRS company, if any. */
export function confirmedInstrument(instruments: Instrument[], companyName: string): Instrument | null {
  const companyTokens = nameTokens(companyName);
  for (const [isin, entry] of Object.entries(CONFIRMED_MAP)) {
    if (entry.tokens.every((token) => companyTokens.includes(token))) {
      const instrument = instruments.find((candidate) => candidate.isin === isin);
      return instrument ?? { isin, symbol: entry.symbol, name: null };
    }
  }
  return null;
}

/** Token-subset match: the instrument short name is fully contained in the KRS name. */
export function nameMatchesInstrument(instrument: Instrument, companyName: string): boolean {
  if (!instrument.name) {
    return false;
  }
  const instrumentTokens = nameTokens(instrument.name);
  const companyTokens = nameTokens(companyName);
  return (
    instrumentTokens.length > 0 &&
    companyTokens.length > 0 &&
    instrumentTokens.every((token) => companyTokens.includes(token))
  );
}

/** Resolve a KRS company to its listed instrument. */
export function resolveInstrument(instruments: Instrument[], companyName: string): Instrument | null {
  const confirmed = confirmedInstrument(instruments, companyName);
  if (confirmed) {
    return confirmed;
  }
  const matches = instruments.filter((instrument) => nameMatchesInstrument(instrument, companyName));
  return matches.length === 1 ? matches[0]! : null;
}
