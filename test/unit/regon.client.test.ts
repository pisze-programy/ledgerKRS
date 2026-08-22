import { describe, expect, it } from "vitest";
import { createRegonClient } from "../../src/sources/regon/client";
import { mockRegonEntries, mockRegonXml, pickVariant } from "../../src/sources/regon/mock";
import { SourceError } from "../../src/lib/errors";

function fakeRegon() {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchJson = async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    if (url.endsWith("/ApiZaloguj")) {
      return { dane: { Sesja: "sid-123" } };
    }
    if (url.endsWith("/ApiDaneSzukaj")) {
      return {
        dane: {
          WyszukanePodmioty: [
            { REGON: "123456789", Nazwa: "Przyklad Sp. z o.o.", NIP: "9876543210", Status: "Aktywny" },
          ],
        },
      };
    }
    return {};
  };
  return { client: createRegonClient({ baseUrl: "https://wyszukiwarkaregon.stat.gov.pl/wsBIR/UslugaBIRzewnPubl.svc", apiKey: "test-key", mode: "live", fetchJson }), calls };
}

describe("createRegonClient (live mode)", () => {
  it("throws when no api key", () => {
    expect(() =>
      createRegonClient({ baseUrl: "x", apiKey: "", mode: "live" }),
    ).toThrowError(SourceError);
  });

  it("logs in, searches by nip and logs out", async () => {
    const { client, calls } = fakeRegon();
    const entries = await client.searchByNip("9876543210");
    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual({
      regon: "123456789",
      name: "Przyklad Sp. z o.o.",
      nip: "9876543210",
      status: "Aktywny",
    });
    const urls = calls.map((c) => c.url.split("/").pop());
    expect(urls).toEqual(["ApiZaloguj", "ApiDaneSzukaj", "ApiWyloguj"]);
    expect(calls[1]!.init.headers).toMatchObject({ sid: "sid-123" });
  });
});

describe("createRegonClient (mock mode)", () => {
  it("defaults to mock and returns variants without a key", () => {
    const client = createRegonClient({ baseUrl: "x", apiKey: "" });
    return client.searchByNip("1234567892").then((entries) => {
      expect(entries.length).toBeGreaterThan(0);
    });
  });
});

describe("pickVariant", () => {
  it("maps last nip digit to a variant", () => {
    expect(pickVariant("1234567890")).toBe("error");
    expect(pickVariant("1234567891")).toBe("error");
    expect(pickVariant("1234567899")).toBe("no_data");
    expect(pickVariant("1234567892")).toBe("jdc_micro");
    expect(pickVariant("1234567895")).toBe("jdc_medium");
    expect(pickVariant("1234567898")).toBe("jdc_large");
  });
});

describe("mockRegonEntries", () => {
  it("returns a micro JDG", () => {
    const entries = mockRegonEntries("1234567892");
    expect(entries).toHaveLength(1);
    expect(entries[0]!.name).toContain("KOWALSKI");
    expect(entries[0]!.nip).toBe("1234567892");
    expect(entries[0]!.status).toContain("fizyczna");
  });

  it("returns empty for no data", () => {
    expect(mockRegonEntries("1234567899")).toEqual([]);
  });

  it("throws for the error variant", () => {
    expect(() => mockRegonEntries("1234567890")).toThrow();
  });
});

describe("mockRegonXml", () => {
  it("emits the BIR dane structure", () => {
    const xml = mockRegonXml("1234567895");
    expect(xml).toContain("<dane>");
    expect(xml).toContain("<Regon>");
    expect(xml).toContain("<Nip>1234567895</Nip>");
  });
});
