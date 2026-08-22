import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import {
  callApi,
  checkUsage,
  getCreds,
  hasFixture,
  LEDGER_FILE,
  readFixture,
  reuseEnabled,
  trimKatalog,
  writeFixture,
  writeLedger,
  writeRaw,
  type CallRecord,
} from "../../helpers/bizraport";

const creds = getCreds();
const LONG = 120000;
const itLong = (name: string, fn: () => Promise<void>): void => {
  it(name, fn, LONG);
};

interface Company {
  krs?: string;
  informacje_o_firmie?: { nazwa_pola: string; wartosc: string }[];
  dane_finansowe?: { rok: number; nazwa_wskaznika: string; kwota: number }[] | null;
  krz?: unknown[] | null;
  powiazania?: { powiazania_rozszerzone?: unknown[] }[];
}

function companyOf(json: Record<string, unknown>): Company | null {
  const data = json.data;
  if (!Array.isArray(data) || data.length === 0) {
    return null;
  }
  return data[0] as Company;
}

function infoOf(company: Company): Record<string, string> {
  return Object.fromEntries((company.informacje_o_firmie ?? []).map((item) => [item.nazwa_pola, item.wartosc]));
}

function krsOfFixture(name: string): string | null {
  const fixture = readFixture(name);
  if (!fixture) {
    return null;
  }
  const company = companyOf(fixture);
  return company?.krs ? company.krs.replace(/_$/, "").padStart(10, "0") : null;
}

const calls: CallRecord[] = [];
let usedBefore: number | null = null;
let usedAfter: number | null = null;

async function probe(
  endpoint: string,
  params: Record<string, string>,
  fixture?: string,
  katalogTrimmed = false,
): Promise<{ status: number; json: Record<string, unknown>; credits: number }> {
  if (reuseEnabled() && fixture && hasFixture(fixture)) {
    const json = readFixture(fixture)!;
    const credits = creditsForResponse(json);
    calls.push({
      at: new Date().toISOString(),
      endpoint: `/api/${endpoint}`,
      params,
      status: 200,
      credits: 0,
      fixture,
      note: `reused fixture (originally ${credits} credit)`,
    });
    return { status: 200, json, credits: 0 };
  }
  const result = await callApi(endpoint, params, creds!);
  if (fixture && result.status === 200) {
    if (katalogTrimmed) {
      writeRaw(fixture, result.json);
      writeFixture(fixture, trimKatalog(result.json));
    } else {
      writeFixture(fixture, result.json);
    }
  }
  calls.push({
    at: new Date().toISOString(),
    endpoint: `/api/${endpoint}`,
    params,
    status: result.status,
    credits: result.credits,
    fixture: fixture ?? null,
  });
  return result;
}

function creditsForResponse(json: Record<string, unknown>): number {
  const data = json.data;
  return Array.isArray(data) && data.length > 0 ? 1 : 0;
}

async function findCompany(
  fixture: string,
  query: string,
  matches: (company: Company | null) => boolean,
  attempts = 3,
): Promise<string | null> {
  const existing = krsOfFixture(fixture);
  if (existing && matches(companyOf(readFixture(fixture)!))) {
    return existing;
  }
  const search = await probe("szukaj", { q: query });
  const candidates = (search.json.data as { krs?: string }[] | undefined) ?? [];
  for (const candidate of candidates.slice(0, attempts)) {
    const krs = candidate.krs ? candidate.krs.replace(/_$/, "").padStart(10, "0") : null;
    if (!krs) {
      continue;
    }
    const dane = await probe("dane", { krs }, fixture);
    if (matches(companyOf(dane.json))) {
      return krs;
    }
  }
  return null;
}

describe.skipIf(creds === null)("BizRaport battery", () => {
  beforeAll(async () => {
    usedBefore = await checkUsage(creds!);
  });

  afterAll(async () => {
    usedAfter = await checkUsage(creds!);
    const existing = existsSync(LEDGER_FILE) ? JSON.parse(readFileSync(LEDGER_FILE, "utf-8")) : {};
    const history = Array.isArray(existing.history) ? existing.history : [];
    history.push({
      at: new Date().toISOString(),
      usedBefore,
      usedAfter,
      spent: (usedAfter ?? 0) - (usedBefore ?? 0),
      calls: calls.length,
    });
    writeLedger({
      email: creds!.email,
      model: "konto testowe",
      freeLimit: 100,
      usedBefore,
      usedAfter,
      creditsSpentThisRun: (usedAfter ?? 0) - (usedBefore ?? 0),
      history,
      calls,
    });
  });

  describe("free error semantics", () => {
    it("rejects wrong credentials with 401", async () => {
      const result = await probe("dane", { krs: "0000795513", password: "wrong-password" });
      expect(result.status).toBe(401);
      expect(result.credits).toBe(0);
    });

    it("returns 400 without identifiers", async () => {
      const result = await probe("dane", {});
      expect(result.status).toBe(400);
    });

    it("returns empty data for a nonexistent krs", async () => {
      const result = await probe("dane", { krs: "0000000000" });
      expect(result.status).toBe(200);
      expect(result.json.data).toEqual([]);
      expect(result.credits).toBe(0);
    });

    it("rejects a katalog call without filters", async () => {
      const result = await probe("katalog", {});
      expect(result.status).toBe(400);
    });

    it("rejects an empty szukaj query", async () => {
      const result = await probe("szukaj", { q: "" });
      expect(result.status).toBe(400);
    });
  });

  describe("legal-form gaps", () => {
    itLong("probes a PSA (prosta spółka akcyjna)", async () => {
      const krs = await findCompany("psa.json", "PROSTA SPÓŁKA AKCYJNA", (company) => {
        return company !== null && (infoOf(company).forma_prawna ?? "").includes("PROSTA");
      });
      expect(krs).not.toBeNull();
      await probe("sprawozdania", { krs: krs! }, "sprawozdania-psa.json");
    });

    itLong("probes a spółka komandytowo-akcyjna", async () => {
      const krs = await findCompany("ska.json", "SPÓŁKA KOMANDYTOWO-AKCYJNA", (company) => {
        return company !== null && (infoOf(company).forma_prawna ?? "").includes("KOMANDYTOWO-AKCYJNA");
      });
      expect(krs).not.toBeNull();
      await probe("sprawozdania", { krs: krs! }, "sprawozdania-ska.json");
    });

    itLong("probes a spółdzielnia", async () => {
      const krs = await findCompany("spoldzielnia.json", "SPÓŁDZIELNIA MIESZKANIOWA", (company) => {
        return company !== null && (infoOf(company).forma_prawna ?? "").includes("SPÓŁDZIELNIA");
      });
      expect(krs).not.toBeNull();
      await probe("sprawozdania", { krs: krs! }, "sprawozdania-spoldzielnia.json");
    });

    itLong("probes an oddział of a foreign company", async () => {
      const krs = await findCompany("oddzial.json", "ODDZIAŁ ZAGRANICZNEGO PRZEDSIĘBIORCY", (company) => {
        return company !== null && (infoOf(company).forma_prawna ?? "").includes("ZAGRANICZNEGO PRZEDSIĘBIORCY");
      });
      expect(krs).not.toBeNull();
    });

    itLong("probes a company in liquidation", async () => {
      const krs = await findCompany(
        "likwidacja.json",
        "W LIKWIDACJI",
        (company) => {
          return company !== null && infoOf(company).postepowanie_likwidacyjne === "Tak";
        },
        2,
      );
      expect(krs).not.toBeNull();
    });
  });

  describe("financial extremes", () => {
    itLong("probes a loss-making company", async () => {
      const found = await probe("katalog", { zysk_netto_do: "-5000000" }, "katalog-strata.json", true);
      const krs = (found.json.data as { krs?: string }[] | undefined)?.[0]?.krs?.replace(/_$/, "").padStart(10, "0");
      if (!krs) {
        return;
      }
      const dane = await probe("dane", { krs }, "strata.json");
      const company = companyOf(dane.json);
      expect(company).not.toBeNull();
      const financials = company!.dane_finansowe ?? [];
      expect(financials.some((row) => row.nazwa_wskaznika === "zysk_netto" && row.kwota < 0)).toBe(true);
    });

    itLong("probes a fresh company", async () => {
      const found = await probe("katalog", { rok_wpisu_do_rejestru_od: "2026" }, "katalog-mikro.json", true);
      const krs = (found.json.data as { krs?: string }[] | undefined)?.[0]?.krs?.replace(/_$/, "").padStart(10, "0");
      if (!krs) {
        return;
      }
      const dane = await probe("dane", { krs }, "mikro.json");
      const company = companyOf(dane.json);
      expect(company).not.toBeNull();
    });
  });

  describe("fresh re-probes with the new API fields", () => {
    itLong("re-probes a company with KRZ entries (Ultinon)", async () => {
      const dane = await probe("dane", { krs: "0000060888" }, "krz-upadlosc.json");
      const company = companyOf(dane.json);
      expect(company).not.toBeNull();
      expect(Array.isArray(company!.krz) && company!.krz!.length > 0).toBe(true);
    });

    itLong("re-probes Jeronimo with expanded connections", async () => {
      const dane = await probe("dane", { krs: "0000222483", rozszerz_polaczenia: "tak" }, "jeronimo-graf.json");
      const company = companyOf(dane.json);
      expect(company).not.toBeNull();
      const expanded = (company!.powiazania ?? []).filter((item) => item.powiazania_rozszerzone);
      expect(expanded.length).toBeGreaterThan(0);
    });

    itLong("probes statements for a komandytowa", async () => {
      const result = await probe("sprawozdania", { krs: "0000597711" }, "sprawozdania-komandytowa.json");
      expect(companyOf(result.json)).not.toBeNull();
    });
  });

  describe("katalog filters", () => {
    itLong("filters by PKD section and voivodeship", async () => {
      const result = await probe("katalog", { pkd_sekcja: "J", wojewodztwo: "MAZOWIECKIE" }, "katalog-pkd-maz-fresh.json", true);
      expect(result.status).toBe(200);
      expect(result.json.count).toBeGreaterThan(0);
    });

    itLong("filters by ROE percentage scale", async () => {
      const result = await probe("katalog", { roa_od: "15", nie_wykreslona: "tak" }, "katalog-roa-fresh.json", true);
      expect(result.status).toBe(200);
      expect(result.json.count).toBeGreaterThan(0);
    });

    itLong("filters by CIT estoński flag", async () => {
      const result = await probe("katalog", { cit_estonski: "tak" }, "katalog-cit-fresh.json", true);
      expect(result.status).toBe(200);
      expect(result.json.count).toBeGreaterThan(0);
    });

    itLong("filters by recent KRZ entries", async () => {
      const result = await probe("katalog", { ostatni_krz: "90" }, "katalog-krz-fresh.json", true);
      expect(result.status).toBe(200);
      expect(result.json.count).toBeGreaterThan(0);
    });

    it("returns an empty list for a nonexistent PKD class", async () => {
      const result = await probe("katalog", { pkd_podklasa: "99.99.Z" }, "katalog-zero.json", true);
      expect(result.status).toBe(200);
      expect(result.json.count).toBe(0);
      expect(result.json.data).toEqual([]);
      expect(result.credits).toBe(0);
    });
  });

  describe("szukaj modes", () => {
    itLong("searches by name fragment", async () => {
      const result = await probe("szukaj", { q: "baseli" }, "szukaj-fragment-fresh.json");
      expect(result.status).toBe(200);
      expect((result.json.data as unknown[]).length).toBeGreaterThan(0);
    });

    itLong("searches by NIP", async () => {
      const result = await probe("szukaj", { q: "8971868567" }, "szukaj-nip-fresh.json");
      expect(result.status).toBe(200);
      expect((result.json.data as unknown[]).length).toBeGreaterThan(0);
    });

    itLong("searches by KRS", async () => {
      const result = await probe("szukaj", { q: "0000795513" }, "szukaj-krs-fresh.json");
      expect(result.status).toBe(200);
      expect((result.json.data as unknown[]).length).toBeGreaterThan(0);
    });

    itLong("searches by REGON", async () => {
      const result = await probe("szukaj", { q: "361587283" }, "szukaj-regon-fresh.json");
      expect(result.status).toBe(200);
    });
  });
});
