import { describe, expect, it } from "vitest";
import { htmlToText } from "../../src/sources/rdf/htmlToText";
import { pdfPositions, detectScale } from "../../src/sources/rdf/pdf";

describe("htmlToText", () => {
  it("strips tags, styles, scripts and entities into data lines", () => {
    const html = `<html><head><style>@page { size: A4 } .x { font:bold }</style><script>var x=1;</script></head>
<body><table><tr><td>AKTYWA RAZEM</td></tr><tr><td>222&nbsp;380&nbsp;996</td></tr></table></body></html>`;
    const lines = htmlToText(html);
    expect(lines).toContain("AKTYWA RAZEM");
    expect(lines).toContain("222 380 996");
    expect(lines.some((l) => l.includes("@page"))).toBe(false);
    expect(lines.some((l) => l.includes("var x"))).toBe(false);
  });

  it("splits table cells into separate lines", () => {
    const lines = htmlToText(`<table><tr><td>ZYSK NETTO</td></tr><tr><td>1 126 424</td></tr></table>`);
    expect(lines).toEqual(["ZYSK NETTO", "1 126 424"]);
  });
});

describe("detectScale", () => {
  it("detects thousands-declared statements", () => {
    expect(detectScale(["w tysiącach zł"])).toBe(1000);
    expect(detectScale(["dane w tys. zł"])).toBe(1000);
    expect(detectScale(["Sprawozdanie finansowe"])).toBe(1);
  });
});

describe("pdfPositions", () => {
  it("matches a two-line name→amount pair and scales it", () => {
    const text = `<html><table><tr><td>AKTYWA RAZEM</td></tr><tr><td>222 380 996</td></tr></table>
      <p>w tysiącach zł</p>`;
    // SFBNKZ dict has a Bilans position matching "Aktywa" (bank total).
    const positions = pdfPositions(text, { layout: "SFBNKZ" });
    const aktywa = positions.find((p) => p.kod === "Aktywa");
    expect(aktywa).toBeDefined();
    expect(aktywa!.kwota).toBe(222380996000);
  });

  it("matches an amount on the same line as the name", () => {
    const positions = pdfPositions(
      `<table><tr><td>AKTYWA RAZEM 222 380 996</td></tr></table><p>w tysiącach zł</p>`,
      { layout: "SFBNKZ" },
    );
    const aktywa = positions.find((p) => p.kod === "Aktywa");
    expect(aktywa?.kwota).toBe(222380996000);
  });

  it("returns no positions when nothing matches", () => {
    expect(pdfPositions("<html><p>Brak danych</p></html>", { layout: "SFBNKZ" })).toEqual([]);
  });
});
