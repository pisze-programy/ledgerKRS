import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseSprawozdanie, type ParsedStatement } from "../../src/sources/rdf/parser";

const near = (a: number | null, b: number | null) =>
  a !== null && b !== null && Math.abs(a - b) < Math.max(1, Math.abs(b) * 1e-4);

export interface RzisRoles {
  przychody: string | null;
  koszty: string | null;
  zyskZeSprzedazy: string | null;
  zyskOperacyjny: string | null;
  zyskBrutto: string | null;
  podatek: string | null;
  zyskNetto: string | null;
}

export function inferRzisRoles(statement: ParsedStatement): RzisRoles {
  const rzis = statement.sekcje.find((s) => s.sekcja === "Rachunek zysków i strat");
  const values = new Map<string, number | null>();
  if (rzis) {
    for (const p of rzis.pozycje) {
      if (p.kod_pozycji && /^[A-Z]{1,2}$/.test(p.kod_pozycji)) values.set(p.kod_pozycji, p.kwota);
    }
  }
  const codes = [...values.keys()].sort((a, b) => a.length - b.length || a.localeCompare(b));

  const roles: RzisRoles = {
    przychody: null,
    koszty: null,
    zyskZeSprzedazy: null,
    zyskOperacyjny: null,
    zyskBrutto: null,
    podatek: null,
    zyskNetto: null,
  };

  const pos = new Map<string, number | null>(values);

  // zysk_netto is the last present letter (L or O in known layouts)
  if (codes.length > 0) {
    const last = codes[codes.length - 1]!;
    roles.zyskNetto = last;
  }

  // przychody: the first code whose value is >= sum of others is unlikely; pick the largest positive revenue-ish:
  // use relationship: find code p and code k such that p - k == some other code (zysk ze sprzedazy)
  for (const p of codes) {
    const pv = pos.get(p);
    if (pv === null || pv === undefined) continue;
    for (const k of codes) {
      if (k === p) continue;
      const kv = pos.get(k);
      if (kv === null || kv === undefined) continue;
      for (const z of codes) {
        if (z === p || z === k) continue;
        const zv = pos.get(z);
        if (near(zv, pv - kv)) {
          roles.przychody = roles.przychody ?? p;
          roles.koszty = roles.koszty ?? k;
          roles.zyskZeSprzedazy = z;
        }
      }
    }
  }

  // zysk_operacyjny: code o where o == zyskZeSprzedazy + D - E (or with E having any sign)
  if (roles.zyskZeSprzedazy) {
    const z = pos.get(roles.zyskZeSprzedazy);
    for (const d of codes) {
      if (d === roles.przychody || d === roles.koszty || d === roles.zyskZeSprzedazy) continue;
      const dv = pos.get(d);
      if (dv === null || dv === undefined) continue;
      for (const e of codes) {
        if (e === d || e === roles.zyskZeSprzedazy || e === roles.przychody || e === roles.koszty) continue;
        const ev = pos.get(e);
        if (ev === null || ev === undefined) continue;
        for (const o of codes) {
          if (o === d || o === e) continue;
          const ov = pos.get(o);
          if (near(ov, z! + dv - ev) || near(ov, z! + dv + ev)) {
            roles.zyskOperacyjny = o;
          }
        }
      }
    }
  }

  // podatek: the code whose value == zyskBrutto - zyskNetto
  if (roles.zyskNetto) {
    const netto = pos.get(roles.zyskNetto);
    for (const b of codes) {
      if (b === roles.zyskNetto) continue;
      const bv = pos.get(b);
      if (bv === null || bv === undefined) continue;
      for (const t of codes) {
        if (t === b || t === roles.zyskNetto) continue;
        const tv = pos.get(t);
        if (tv !== null && tv !== undefined && netto !== null && near(netto, bv - tv)) {
          roles.zyskBrutto = b;
          roles.podatek = t;
        }
      }
    }
  }

  return roles;
}

const FIXTURES = ["rdf-jednostka-inna.xml", "rdf-xades-jpk.xml"];
const out: Record<string, RzisRoles> = {};
for (const f of FIXTURES) {
  const xml = readFileSync(join(process.cwd(), "test", "fixtures", f), "utf8");
  const s = parseSprawozdanie(xml);
  if (s) {
    out[f] = inferRzisRoles(s);
    console.log(f, "->", JSON.stringify(out[f]));
  }
}
writeFileSync(join(process.cwd(), "tools", "rdf-parity", "dump", "infer-fixtures.json"), JSON.stringify(out, null, 2));
