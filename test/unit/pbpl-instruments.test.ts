import { describe, expect, it } from "vitest";
import {
  Instrument,
  normalizeName,
  nameTokens,
  parseInstrumentTable,
  nameMatchesInstrument,
  confirmedInstrument,
  resolveInstrument,
} from "../../src/sources/pbpl/instruments";

const STOCKTABLE_HTML = `<html><body><div class="stock-table">
  <table>
    <tr><td><a href="/instrument/PLPEKAO00016/pekao">Bank Pekao SA</a></td><td>Bank</td></tr>
    <tr><td><a href="/instrument/PLPKO0000016/pkobp">PKO BP SA</a></td><td>Bank</td></tr>
    <tr><td><a href="/instrument/PLPZU0000011/pzu">PZU SA</a></td><td>Insurance</td></tr>
    <tr><td><a href="/instrument/PLPKN0000018/orlen">Orlen SA</a></td><td>Fuel</td></tr>
  </table>
</div></body></html>`;

describe("normalizeName", () => {
  it("strips case, diacritics and the stroke-l", () => {
    expect(normalizeName("Żółć Łódź")).toBe("zolc lodz");
    expect(normalizeName("  BANK   PEKAO  ")).toBe("bank pekao");
  });

  it("returns an empty key for empty input", () => {
    expect(normalizeName("")).toBe("");
    expect(normalizeName("   ")).toBe("");
  });
});

describe("nameTokens", () => {
  it("drops the legal-entity stopwords", () => {
    expect(nameTokens("POWSZECHNY ZAKŁAD UBEZPIECZEŃ SPÓŁKA AKCYJNA")).toEqual([
      "powszechny",
      "zaklad",
      "ubezpieczen",
    ]);
    expect(nameTokens("Orlen Spółka Akcyjna")).toEqual(["orlen"]);
  });
});

describe("parseInstrumentTable", () => {
  it("parses instruments with ISIN, symbol and a name", () => {
    const instruments = parseInstrumentTable(STOCKTABLE_HTML);
    expect(instruments).toHaveLength(4);
    const pekao = instruments.find((i) => i.isin === "PLPEKAO00016")!;
    expect(pekao.symbol).toBe("pekao");
    expect(pekao.name).toContain("Bank Pekao");
    expect(instruments.some((i) => i.isin === "PLPZU0000011")).toBe(true);
  });

  it("skips duplicate instruments", () => {
    const html = STOCKTABLE_HTML + `<tr><td><a href="/instrument/PLPEKAO00016/pekao">duplicate</a></td></tr>`;
    expect(parseInstrumentTable(html)).toHaveLength(4);
  });

  it("returns an empty list for a page without instruments", () => {
    expect(parseInstrumentTable("<html><p>nothing</p></html>")).toEqual([]);
  });
});

describe("confirmedInstrument", () => {
  const instruments = parseInstrumentTable(STOCKTABLE_HTML);

  it("resolves an acronym-style company to its confirmed instrument", () => {
    const found = confirmedInstrument(instruments, "POWSZECHNY ZAKŁAD UBEZPIECZEŃ SPÓŁKA AKCYJNA");
    expect(found?.isin).toBe("PLPZU0000011");
    expect(found?.symbol).toBe("pzu");
  });

  it("resolves Bank Pekao by its distinctive token", () => {
    const found = confirmedInstrument(instruments, "BANK POLSKA KASA OPIEKI - SPÓŁKA AKCYJNA");
    expect(found?.isin).toBe("PLPEKAO00016");
  });

  it("returns null for an unmapped company", () => {
    expect(confirmedInstrument(instruments, "FUNDACJA STO POCIECH")).toBeNull();
  });
});

describe("nameMatchesInstrument", () => {
  it("matches when the short name is contained in the KRS name", () => {
    expect(nameMatchesInstrument({ isin: "PLPKN0000018", symbol: "orlen", name: "Orlen SA" }, "Orlen Spółka Akcyjna")).toBe(true);
  });

  it("rejects a name without token overlap", () => {
    expect(nameMatchesInstrument({ isin: "PLPKN0000018", symbol: "orlen", name: "Orlen SA" }, "LOTOS SPÓŁKA AKCYJNA")).toBe(false);
  });

  it("returns false when the instrument has no name", () => {
    expect(nameMatchesInstrument({ isin: "X", symbol: "x", name: null }, "anything")).toBe(false);
  });
});

describe("resolveInstrument", () => {
  const instruments = parseInstrumentTable(STOCKTABLE_HTML);

  it("resolves a confirmed company by name", () => {
    const found = resolveInstrument(instruments, "BANK POLSKA KASA OPIEKI - SPÓŁKA AKCYJNA");
    expect(found?.isin).toBe("PLPEKAO00016");
  });

  it("resolves an unmapped company by token-subset match", () => {
    const found = resolveInstrument(instruments, "ORLEN SPÓŁKA AKCYJNA");
    expect(found?.isin).toBe("PLPKN0000018");
  });

  it("returns null for an ambiguous or unmatched company", () => {
    expect(resolveInstrument(instruments, "FUNDACJA STO POCIECH")).toBeNull();
  });

  it("returns null for an empty company name", () => {
    expect(resolveInstrument(instruments, "")).toBeNull();
  });
});

describe("fixture sanity", () => {
  it("builds the expected inventory from the stock-table fixture", () => {
    const instruments: Instrument[] = parseInstrumentTable(STOCKTABLE_HTML);
    expect(instruments.map((i) => i.symbol)).toEqual(["pekao", "pkobp", "pzu", "orlen"]);
  });
});
