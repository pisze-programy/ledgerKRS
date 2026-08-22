import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseOdpis } from "../../src/sources/krs/parser";
import { BENCHMARK_INDICATORS, CONNECTION, ENTITY, INDICATOR, MONITOR_IMPORTANCE } from "../../src/domain/vocab";
import type { Company } from "../../src/domain/types";

function load(name: string, dir = "fixtures"): unknown {
  return JSON.parse(readFileSync(join(process.cwd(), "test", dir, name), "utf-8"));
}

interface BizCompany {
  krs: string;
  nip?: number | null;
  informacje_o_firmie?: { nazwa_pola: string; wartosc: string }[];
  dane_finansowe?: { nazwa_wskaznika: string }[] | null;
  powiazania?: { typ_powiazania?: string; typ_podmiotu?: string }[] | null;
  udzialy?: { procent_udzialow?: number | null }[] | null;
  monitor_sadowy?: { poziom_istotnosci?: string }[] | null;
  pozycja_na_tle_branzy?: { nazwa_wskaznika?: string; udzial_w_rynku?: number }[] | null;
  krz?: unknown[] | null;
}

function bizInfo(company: BizCompany): Record<string, string> {
  return Object.fromEntries((company.informacje_o_firmie ?? []).map((item) => [item.nazwa_pola, item.wartosc]));
}

function parseCapital(text: string | undefined): number | null {
  if (!text) {
    return null;
  }
  const normalized = text.replace(/[^\d.,-]/g, "").replace(/[.]/g, "").replace(",", ".");
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

const COMPANY_CASES: { krsFixture: string; bizFixture: string; namePart?: string }[] = [
  { krsFixture: "krs-jeronimo.json", bizFixture: "bizraport/jeronimo.json" },
  { krsFixture: "krs-baselinker.json", bizFixture: "bizraport/baselinker.json" },
  { krsFixture: "krs-komandytowa.json", bizFixture: "bizraport/komandytowa.json" },
  { krsFixture: "krs-jawna.json", bizFixture: "bizraport/jawna.json" },
  { krsFixture: "krs-stowarzyszenie.json", bizFixture: "bizraport/stowarzyszenie.json" },
  { krsFixture: "krs-psa.json", bizFixture: "bizraport/psa.json" },
  { krsFixture: "krs-ska.json", bizFixture: "bizraport/ska.json" },
  { krsFixture: "krs-spoldzielnia.json", bizFixture: "bizraport/spoldzielnia.json" },
  { krsFixture: "krs-oddzial.json", bizFixture: "bizraport/oddzial.json" },
];

function assertCompanyMatches(our: Company, biz: BizCompany): void {
  const info = bizInfo(biz);
  expect(our.krs).toBe(biz.krs.replace(/_$/, "").padStart(10, "0"));
  expect(our.nip).toBe(String(biz.nip ?? ""));
  expect(our.legalForm?.toUpperCase().replace(/\s+/g, " ")).toContain(
    (info.forma_prawna ?? "").toUpperCase().slice(0, 20),
  );
  expect(our.address?.city?.toUpperCase()).toContain((info.miejscowosc ?? "").slice(0, 12));
  if (info.data_wpisu_do_rejestru) {
    expect(our.registrationDate).toBe(info.data_wpisu_do_rejestru);
  }
  const capital = parseCapital(info.kapital_zakladowy);
  if (capital !== null && our.capital !== null && our.capital !== undefined) {
    expect(our.capital).toBeCloseTo(capital, -2);
  }
  if (info.adres_strony_internetowej && our.website !== null && our.website !== undefined) {
    expect(our.website.toLowerCase()).toBe(info.adres_strony_internetowej.toLowerCase());
  }
}

describe("parity with BizRaport (company fields)", () => {
  for (const testCase of COMPANY_CASES) {
    it(`aligns fields for ${testCase.krsFixture}`, () => {
      const our = parseOdpis(load(testCase.krsFixture))!;
      const biz = (load(testCase.bizFixture) as { data: BizCompany[] }).data[0]!;
      expect(biz).toBeDefined();
      assertCompanyMatches(our.company, biz);
    });
  }
});

describe("parity with BizRaport (ownership scale)", () => {
  for (const testCase of COMPANY_CASES) {
    it(`ownership aligns for ${testCase.krsFixture}`, () => {
      const our = parseOdpis(load(testCase.krsFixture))!;
      const biz = (load(testCase.bizFixture) as { data: BizCompany[] }).data[0]!;
      const bizShares = biz.udzialy ?? [];
      expect(our.ownership.length).toBe(bizShares.length);
      if (bizShares.length > 0) {
        const bizPercents = bizShares.map((share) => share.procent_udzialow).sort((a, b) => (b ?? 0) - (a ?? 0));
        const ourPercents = our.ownership
          .map((share) => share.procentUdzialow)
          .sort((a, b) => (b ?? 0) - (a ?? 0));
        for (let i = 0; i < bizPercents.length; i++) {
          if (bizPercents[i] !== null && ourPercents[i] !== null) {
            expect(Math.abs(ourPercents[i]! - bizPercents[i]!)).toBeLessThanOrEqual(15);
          }
        }
        const ourSum = ourPercents.reduce((sum: number, value) => sum + (value ?? 0), 0);
        expect(ourSum).toBeGreaterThan(90);
        expect(ourSum).toBeLessThanOrEqual(100.5);
      }
    });
  }
});

describe("parity with BizRaport (vocabulary)", () => {
  const fixtures = readdirSync(join(process.cwd(), "test", "fixtures", "bizraport")).filter((name) =>
    name.endsWith(".json"),
  );

  it("all dane_finansowe indicators belong to the vocabulary", () => {
    const known = new Set<string>(Object.values(INDICATOR));
    for (const fixture of fixtures) {
      const raw = load(fixture, "fixtures/bizraport") as { data?: BizCompany[] };
      for (const company of raw.data ?? []) {
        for (const row of company.dane_finansowe ?? []) {
          expect(known.has(row.nazwa_wskaznika)).toBe(true);
        }
      }
    }
  });

  it("all connection types belong to the vocabulary", () => {
    const known = new Set<string>(Object.values(CONNECTION));
    const entities = new Set<string>(Object.values(ENTITY));
    for (const fixture of fixtures) {
      const raw = load(fixture, "fixtures/bizraport") as { data?: BizCompany[] };
      for (const company of raw.data ?? []) {
        for (const connection of company.powiazania ?? []) {
          if (connection.typ_powiazania) {
            expect(known.has(connection.typ_powiazania)).toBe(true);
          }
          if (connection.typ_podmiotu) {
            expect(entities.has(connection.typ_podmiotu)).toBe(true);
          }
        }
      }
    }
  });

  it("all monitor importance levels belong to the vocabulary", () => {
    const known = new Set<string>(Object.values(MONITOR_IMPORTANCE));
    for (const fixture of fixtures) {
      const raw = load(fixture, "fixtures/bizraport") as { data?: BizCompany[] };
      for (const company of raw.data ?? []) {
        for (const entry of company.monitor_sadowy ?? []) {
          if (entry.poziom_istotnosci) {
            expect(known.has(entry.poziom_istotnosci)).toBe(true);
          }
        }
      }
    }
  });

  it("all benchmark indicators belong to the ten", () => {
    const known = new Set<string>(BENCHMARK_INDICATORS as readonly string[]);
    for (const fixture of fixtures) {
      const raw = load(fixture, "fixtures/bizraport") as { data?: BizCompany[] };
      for (const company of raw.data ?? []) {
        for (const row of company.pozycja_na_tle_branzy ?? []) {
          if (row.nazwa_wskaznika) {
            expect(known.has(row.nazwa_wskaznika)).toBe(true);
          }
          if (row.nazwa_wskaznika === "przychody") {
            expect(typeof row.udzial_w_rynku).toBe("number");
          }
        }
      }
    }
  });

  it("ownership percentages are on a 0-100 scale", () => {
    for (const fixture of fixtures) {
      const raw = load(fixture, "fixtures/bizraport") as { data?: BizCompany[] };
      for (const company of raw.data ?? []) {
        for (const share of company.udzialy ?? []) {
          if (share.procent_udzialow !== null && share.procent_udzialow !== undefined) {
            expect(share.procent_udzialow).toBeGreaterThanOrEqual(0);
            expect(share.procent_udzialow).toBeLessThanOrEqual(100);
          }
        }
      }
    }
  });
});
