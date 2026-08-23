import type { ReportContext } from "./context";
import { personKey } from "../domain/person";
import { ENTITY } from "../domain/vocab";

export interface WspolnaOsoba {
  osoba: string;
  /** Function/role of the person in the inspected company. */
  funkcja: string | null;
  /** Other companies (excluding the inspected one) where the person appears. */
  firmy: { krs: string; nazwa: string; funkcja: string | null }[];
}

const MAX_OSOB = 20;
const MAX_FIRM_PER_OSOBA = 10;

/**
 * Person-level graph: for each person in the company's registry data
 * (reprezentacja / wspólnik / organ nadzoru / prokurent), find OTHER
 * companies in which the same person appears (matched on the canonical
 * name key). Results are bounded to keep the report readable.
 */
export async function wspolneOsoby(ctx: ReportContext): Promise<WspolnaOsoba[]> {
  const result: WspolnaOsoba[] = [];
  for (const connection of ctx.report.connections) {
    if (connection.typPodmiotu !== ENTITY.Osoba || !connection.nazwa) {
      continue;
    }
    const norm = personKey(connection.nazwa);
    // Skip initials-only names ("K M") — they are not specific enough to
    // identify a person across companies. Require full words.
    const words = norm.split(" ");
    if (words.length < 2 || words.some((w) => w.length < 2)) {
      continue;
    }
    const matches = (await ctx.deps.repository.findConnectionsByPerson(norm)).filter((m) => m.krs !== ctx.krs);
    if (matches.length === 0) {
      continue;
    }
    result.push({
      osoba: connection.nazwa,
      funkcja: connection.funkcja ?? null,
      firmy: matches.slice(0, MAX_FIRM_PER_OSOBA).map((m) => ({
        krs: m.krs,
        nazwa: m.nazwa,
        funkcja: m.funkcja,
      })),
    });
    if (result.length >= MAX_OSOB) {
      break;
    }
  }
  return result;
}
