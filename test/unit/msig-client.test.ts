import { describe, expect, it, vi, afterEach } from "vitest";
import { searchMsig, msigDetail, fetchMonitorForKrs } from "../../src/sources/msig/client";

afterEach(() => vi.unstubAllGlobals());

function stubFetch(routes: (url: string) => Response) {
  const mock = vi.fn(async (input: RequestInfo | URL) => routes(String(input)));
  vi.stubGlobal("fetch", mock);
  return mock;
}

const SEARCH = {
  countPages: 1,
  list: [
    { id: 9209359, sequenceNumber: 1, monitorNumber: "72/2002", dateOfPublication: "2002-04-12T00:00:00", entityName: "PKP CARGO SPÓŁKA AKCYJNA.", signatureOfCase: null, signatureKRS: "[KA.VIII NS-REJ.KRS/2574/2/504]" },
  ],
};

const DETAIL = {
  entityName: "PKP CARGO SPÓŁKA AKCYJNA.",
  numberOfNotice: "35971",
  signatureOfCase: null,
  krs: "0000027702",
  nip: null,
  page: 144,
  chapterName: "XV.WPISY DO KRAJOWEGO REJESTRU SĄDOWEGO /2. Wpisy kolejne",
  monitorNumber: "72/2002",
  dateOfPublication: "2002-04-12T00:00:00",
  textInPosition: "Poz. 35971. PKP CARGO SPÓŁKA AKCYJNA. KRS 0000027702.",
  textInBody: "W dniu 22.03.2002 dokonano wpisu.",
  id: 9209359,
};

describe("MSiG client — public search API", () => {
  it("searches announcements by KRS and parses the list", async () => {
    const mock = stubFetch((url) => new Response(url.includes("/Search") ? JSON.stringify(SEARCH) : "{}", { status: 200 }));
    const items = await searchMsig("0000027702", "B");
    expect(items.length).toBe(1);
    expect(items[0]!.monitorNumber).toBe("72/2002");
    expect(items[0]!.signatureKRS).toContain("NS-REJ.KRS");
    expect(mock.mock.calls.length).toBeGreaterThan(0);
  });

  it("throws on a non-OK response", async () => {
    stubFetch(() => new Response("boom", { status: 500 }));
    await expect(searchMsig("0000027702")).rejects.toThrow(/HTTP 500/);
  });

  it("fetchMonitorForKrs maps search + detail to MonitorEntry", async () => {
    stubFetch((url) => {
      if (url.includes("/Search")) return new Response(JSON.stringify(SEARCH), { status: 200 });
      if (url.includes("/Detalis")) return new Response(JSON.stringify(DETAIL), { status: 200 });
      return new Response("{}", { status: 200 });
    });
    const entries = await fetchMonitorForKrs("0000027702");
    expect(entries.length).toBe(2); // signatureType B + A, one item each
    const first = entries[0]!;
    expect(first.numerOgloszenia).toBe("35971");
    expect(first.sygnaturaSprawy).toContain("NS-REJ.KRS");
    expect(first.nrMonitora).toBe("72/2002");
    expect(first.rozdzial).toContain("WPISY");
    expect(first.trescNaglowka).toContain("Poz. 35971");
    expect(first.dataPublikacji).toBe("2002-04-12");
  });

  it("keeps entries when a detail call fails (resilient)", async () => {
    stubFetch((url) => {
      if (url.includes("/Search")) return new Response(JSON.stringify(SEARCH), { status: 200 });
      return new Response("boom", { status: 500 });
    });
    const entries = await fetchMonitorForKrs("0000027702");
    expect(entries).toEqual([]);
  });
});
