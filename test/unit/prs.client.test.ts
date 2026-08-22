import { describe, expect, it } from "vitest";
import { createPrsClient, parseKrz } from "../../src/sources/prs/client";

const SAMPLE = {
  data: [
    {
      data_krz: "2026-08-04",
      kategoria_tytul: "Wniosek restrukturyzacyjny złożony przez dłużnika",
      numer_obwieszczenia: "1234",
      tytul_obwieszczenia: "Obwieszczenie o restrukturyzacji",
      sygnatura_akt: "WA.XII NS-REJ.KRS/123/26",
      sad: "Sąd Rejonowy Warszawa",
      tresc: "Treść obwieszczenia",
    },
  ],
};

describe("parseKrz", () => {
  it("maps announcement entries", () => {
    const entries = parseKrz("0000060888", SAMPLE);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual({
      krs: "0000060888",
      date: "2026-08-04",
      category: "Wniosek restrukturyzacyjny złożony przez dłużnika",
      announcementNumber: "1234",
      title: "Obwieszczenie o restrukturyzacji",
      caseNumber: "WA.XII NS-REJ.KRS/123/26",
      court: "Sąd Rejonowy Warszawa",
      content: "Treść obwieszczenia",
    });
  });

  it("returns empty for empty body", () => {
    expect(parseKrz("1", {})).toEqual([]);
    expect(parseKrz("1", null)).toEqual([]);
  });
});

describe("createPrsClient", () => {
  it("fetches krz entries through the transport", async () => {
    const client = createPrsClient({ baseUrl: "https://prs.ms.gov.pl", transport: async () => SAMPLE });
    const entries = await client.getKrzEntries("0000060888");
    expect(entries[0]!.category).toContain("restrukturyzacyjny");
  });
});
