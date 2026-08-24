/**
 * Merge MSiG-derived persons (real names from public court announcements) into
 * the report model, replacing the masked names that come from the KRS OpenAPI.
 * PESELs are never carried here — the report exposes only names and roles.
 */

import { CONNECTION, ENTITY } from "../domain/vocab";
import type { Connection, ConnectionType, OwnershipShare } from "../domain/types";
import { fullName, type MsigPerson, type PersonType } from "../sources/msig/persons";

const PERSON_CONNECTION: Record<PersonType, ConnectionType> = {
  organ: CONNECTION.Reprezentacja,
  wspólnik: CONNECTION.Wspolnik,
  prokurent: CONNECTION.Prokurent,
  "nadzór": CONNECTION.OrganNadzoru,
  likwidator: CONNECTION.Likwidator,
};

/** Replace the Osoba connections of covered types with the MSiG persons (authoritative). */
export function enrichConnections(connections: Connection[], persons: MsigPerson[]): Connection[] {
  if (persons.length === 0) {
    return connections;
  }
  const byType = new Map<ConnectionType, Connection[]>();
  for (const person of persons) {
    const typ = PERSON_CONNECTION[person.typ];
    const list = byType.get(typ) ?? [];
    list.push({ typPodmiotu: ENTITY.Osoba, nazwa: fullName(person), typPowiazania: typ, funkcja: person.funkcja });
    byType.set(typ, list);
  }
  const replaced = new Set<ConnectionType>();
  const result: Connection[] = [];
  for (const conn of connections) {
    if (conn.typPodmiotu === ENTITY.Osoba && byType.has(conn.typPowiazania)) {
      if (!replaced.has(conn.typPowiazania)) {
        result.push(...byType.get(conn.typPowiazania)!);
        replaced.add(conn.typPowiazania);
      }
      continue;
    }
    result.push(conn);
  }
  return result;
}

/** Replace person-like ownership (no company link) with the MSiG shareholders; keep real owners. */
export function enrichOwnership(ownership: OwnershipShare[], persons: MsigPerson[]): OwnershipShare[] {
  const wspolnicy = persons.filter((p) => p.typ === "wspólnik");
  if (wspolnicy.length === 0) {
    return ownership;
  }
  const total = wspolnicy.reduce((sum, p) => sum + (p.udzialy ?? 0), 0);
  const mSig = wspolnicy.map((p) => ({
    typPodmiotu: ENTITY.Osoba,
    nazwa: fullName(p),
    procentUdzialow: total > 0 ? Math.round(((p.udzialy ?? 0) / total) * 1000) / 10 : null,
    idPodmiotu: null,
  }));
  const kept = ownership.filter((share) => share.idPodmiotu);
  return [...kept, ...mSig];
}
