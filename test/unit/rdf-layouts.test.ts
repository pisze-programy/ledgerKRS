import { describe, expect, it } from "vitest";
import { detectLayout, detectWariant, detectVersion, hasDokumentWrapper, isXadesWrapped, statementMeta } from "../../src/sources/rdf/layouts";

describe("detectLayout", () => {
  it("detects new-schema layouts from the layout element", () => {
    expect(detectLayout('<Dokument xmlns="x"><TrescDokumentu><JednostkaMikro><BilansJednostkaMikro>' )).toBe("SFJMIZ");
    expect(detectLayout("<JednostkaMala><BilansJednostkaMala>")).toBe("SFJMAZ");
    expect(detectLayout("<JednostkaInna><BilansJednostkaInna>")).toBe("SFJINZ");
    expect(detectLayout("<JednostkaOp><BilansJednostkaOp>")).toBe("SFJOPZ");
    expect(detectLayout("<Bank><BilansBank>")).toBe("SFBNKZ");
  });

  it("falls back to LEGACY for old-schema roots", () => {
    expect(detectLayout("<JednostkaInna xmlns=\"http://www.mf.gov.pl/schematy/SF/...\"><Bilans>")).toBe("SFJINZ");
    expect(detectLayout("<SprawozdanieFinansowe><Bilans>")).toBe("LEGACY");
    expect(detectLayout("")).toBe("LEGACY");
  });
});

describe("detectWariant / detectVersion", () => {
  it("reads WariantSprawozdania and wersjaSchemy", () => {
    const xml = "<Naglowek><jin:WariantSprawozdania>2</jin:WariantSprawozdania><jin:KodSprawozdania wersjaSchemy=\"1-2\"/></Naglowek>";
    expect(detectWariant(xml)).toBe(2);
    expect(detectVersion(xml)).toBe("1-2");
    expect(detectWariant("<Naglowek/>")).toBeNull();
  });
});

describe("wrappers", () => {
  it("detects Dokument wrapper and XAdES signature", () => {
    expect(hasDokumentWrapper("<Dokument xmlns=\"http://crd.gov.pl/wzor/2025/08/12/13821/\"><TrescDokumentu>")).toBe(true);
    expect(hasDokumentWrapper("<JednostkaInna><Bilans>")).toBe(false);
    expect(isXadesWrapped("<ds:Signature xmlns:ds=\"http://www.w3.org/2000/09/xmldsig#\"><ds:Object>")).toBe(true);
    expect(isXadesWrapped("<JednostkaInna><Bilans>")).toBe(false);
  });
});

describe("statementMeta", () => {
  it("combines layout + wariant + version", () => {
    const xml = "<Dokument xmlns=\"http://crd.gov.pl/wzor/2025/08/07/13817/\"><TrescDokumentu><JednostkaInna><Naglowek><jin:WariantSprawozdania>1</jin:WariantSprawozdania></Naglowek>";
    const meta = statementMeta(xml);
    expect(meta.layout).toBe("SFJINZ");
    expect(meta.wariant).toBe(1);
    expect(meta.version).toBeNull();
  });
});
