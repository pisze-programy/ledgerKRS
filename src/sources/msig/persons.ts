/**
 * Person extraction from MSiG announcement text.
 *
 * The KRS OpenAPI masks person names, but the public MSiG announcements
 * (Monitor Sądowy i Gospodarczy) contain the full odpis text with complete
 * names and PESELs (rubrics `Dane wspólników`, `Dane osób wchodzących w skład
 * organu`, `Prokurenci`, `Rada nadzorcza`, `likwidator`). This module parses
 * those rubrics into structured persons. PESELs are never exposed — the
 * report carries only names and roles.
 */

export type PersonType = "organ" | "wspólnik" | "prokurent" | "nadzór" | "likwidator";

export interface MsigPerson {
  typ: PersonType;
  nazwisko: string;
  imiona: string;
  /** Never returned to API consumers; kept masked. */
  pesel: string | null;
  /** Role text from rubric field 5 (organ members), e.g. "CZŁONEK ZARZĄDU". */
  funkcja: string | null;
  /** Number of shares (wspólnicy), from the share description. */
  udzialy: number | null;
}

/** Collapse all whitespace runs to a single space. */
export function normalizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

const PERSON_RE =
  /(\d{1,3}) 1\. ([A-ZĄĆĘŁŃÓŚŹŻ][A-ZĄĆĘŁŃÓŚŹŻ .'-]{0,40}?) 2\. ([A-ZĄĆĘŁŃÓŚŹŻ][A-ZĄĆĘŁŃÓŚŹŻ .'-]{0,40}?) 3\. (\d{9,11}|[A-Z0-9 .\/-]{4,20})/g;

const RUBRIC_HEADERS: [PersonType, RegExp][] = [
  ["wspólnik", /Dane wspólników/i],
  ["organ", /Dane osób wchodzących w skład organu/i],
  ["prokurent", /Prokurenci/i],
  ["nadzór", /Rada nadzorcza/i],
  ["likwidator", /likwidator/i],
];

function rubricBefore(text: string, index: number): PersonType | null {
  let best: PersonType | null = null;
  let bestIndex = -1;
  for (const [typ, re] of RUBRIC_HEADERS) {
    const match = re.exec(text.slice(0, index));
    if (match && match.index > bestIndex) {
      bestIndex = match.index;
      best = typ;
    }
    re.lastIndex = 0;
  }
  return best;
}

/** Mask a PESEL: keep nothing but a fixed-length asterisk string. */
export function maskPesel(pesel: string): string {
  return pesel.length === 11 ? "***********" : "*********";
}

/** Replace every 11-digit PESEL in announcement text with asterisks. */
export function maskPeselsInText(text: string): string {
  return text.replace(/\b\d{11}\b/g, "***********");
}

function parseShares(field5: string): number | null {
  const match = field5.match(/(\d[\d\u00a0 ]*)\s*UDZIAŁ/);
  if (!match) {
    return null;
  }
  const n = Number(match[1]!.replace(/\s/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** Parse all person records from one announcement text, typed by rubric context. */
export function parsePersons(rawText: string): MsigPerson[] {
  const text = normalizeText(rawText);
  const persons: MsigPerson[] = [];
  for (const match of text.matchAll(PERSON_RE)) {
    const typ = rubricBefore(text, match.index ?? 0);
    if (!typ) {
      continue;
    }
    const pesel = /^\d{9,11}$/.test(match[4]!) ? match[4]! : null;
    const after = text.slice(match.index! + match[0].length);
    const nextPerson = after.search(/\d{1,3} 1\. [A-ZĄĆĘŁŃÓŚŹŻ]/);
    const field5Raw = (nextPerson >= 0 ? after.slice(0, nextPerson) : after).slice(0, 400);
    const field5Match = field5Raw.match(/5\. (.*?)(?= 6\. |$)/);
    const field5 = field5Match ? normalizeText(field5Match[1]!) : null;
    persons.push({
      typ,
      nazwisko: match[2]!.trim(),
      imiona: match[3]!.trim(),
      pesel,
      funkcja: typ === "organ" ? field5 : null,
      udzialy: typ === "wspólnik" ? parseShares(field5 ?? "") : null,
    });
  }
  return persons;
}

/** For each person type, the latest announcement (reverse order) wins. */
export function aggregatePersons(texts: string[]): MsigPerson[] {
  const seen = new Set<PersonType>();
  const result: MsigPerson[] = [];
  for (const text of [...texts].reverse()) {
    const persons = parsePersons(text);
    const types = new Set(persons.map((p) => p.typ));
    for (const typ of types) {
      if (!seen.has(typ)) {
        seen.add(typ);
        result.push(...persons.filter((p) => p.typ === typ));
      }
    }
  }
  return result;
}

export function fullName(person: MsigPerson): string {
  return [person.nazwisko, person.imiona].filter(Boolean).join(" ");
}
