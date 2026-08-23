import { describe, expect, it } from "vitest";
import {
  decodeEntities,
  parseRawValue,
  toNumber,
  parsePeriodLabel,
  parseHeaders,
  parseFinancialReport,
} from "../../src/sources/pbpl/parse";

describe("decodeEntities", () => {
  it("decodes the entities used in the page attributes", () => {
    expect(decodeEntities("&quot;Aktywa&quot; &#34;Zysk&#34; &amp; &lt; &gt; &nbsp;x")).toBe('"Aktywa" "Zysk" & < >  x');
  });

  it("leaves unknown text unchanged", () => {
    expect(decodeEntities("plain text")).toBe("plain text");
  });
});

describe("parseRawValue", () => {
  it("parses a JSON object value", () => {
    expect(parseRawValue("{&quot;value&quot;:&quot;233217182&quot;}")).toBe("233217182");
    expect(parseRawValue('{"value":"0"}')).toBe("0");
    expect(parseRawValue('{"value": 42}')).toBe("42");
  });

  it("parses a quoted string label", () => {
    expect(parseRawValue("&quot;Wynik z tytułu odsetek&quot;")).toBe("Wynik z tytułu odsetek");
    expect(parseRawValue('"Aktywa (tys. zł)"')).toBe("Aktywa (tys. zł)");
  });

  it("returns null for malformed JSON objects", () => {
    expect(parseRawValue("{broken")).toBeNull();
  });

  it("returns the text for a plain value", () => {
    expect(parseRawValue("123")).toBe("123");
    expect(parseRawValue("")).toBeNull();
  });
});

describe("toNumber", () => {
  it("parses plain and spaced numbers", () => {
    expect(toNumber("233217182")).toBe(233217182);
    expect(toNumber("233 217 182")).toBe(233217182);
  });

  it("parses decimal numbers with comma", () => {
    expect(toNumber("1,5")).toBe(1.5);
    expect(toNumber("-123.5")).toBe(-123.5);
  });

  it("returns null for empty or non-numeric input", () => {
    expect(toNumber(null)).toBeNull();
    expect(toNumber("")).toBeNull();
    expect(toNumber("abc")).toBeNull();
  });
});

describe("parsePeriodLabel", () => {
  it("parses Roman-quarter period labels", () => {
    expect(parsePeriodLabel("IV Q 2020")).toEqual({ quarter: 4, year: 2020 });
    expect(parsePeriodLabel("II Q 1998")).toEqual({ quarter: 2, year: 1998 });
    expect(parsePeriodLabel("I Q 2026")).toEqual({ quarter: 1, year: 2026 });
    expect(parsePeriodLabel("III Q 2021")).toEqual({ quarter: 3, year: 2021 });
  });

  it("returns null for malformed labels", () => {
    expect(parsePeriodLabel("2020")).toBeNull();
    expect(parsePeriodLabel("Q 2020")).toBeNull();
    expect(parsePeriodLabel("V Q 2020")).toBeNull();
    expect(parsePeriodLabel("IV 2020")).toBeNull();
    expect(parsePeriodLabel("")).toBeNull();
  });
});

describe("parseHeaders", () => {
  it("extracts period headers and skips the label columns", () => {
    const html = `<table class="m-quotes-data-table"><thead><tr>
      <th class="-unpaginated"><span data-raw-value="&quot;Wskaźnik&quot;">Wskaźnik</span></th>
      <th class="-unpaginated"><span data-raw-value="&quot;Wykres&quot;">Wykres</span></th>
      <th><span data-raw-value="&quot;II Q 1998&quot;">II Q 1998</span></th>
      <th><span data-raw-value="&quot;IV Q 1998&quot;">IV Q 1998</span></th>
    </tr></thead></table>`;
    expect(parseHeaders(html)).toEqual(["II Q 1998", "IV Q 1998"]);
  });

  it("returns an empty list for a page without a table", () => {
    expect(parseHeaders("<html><p>no table</p></html>")).toEqual([]);
  });
});

describe("parseFinancialReport", () => {
  const html = `<html><body><table class="m-quotes-data-table">
    <thead><tr>
      <th class="-unpaginated"><span data-raw-value="&quot;Wskaźnik&quot;">Wskaźnik</span></th>
      <th><span data-raw-value="&quot;II Q 2020&quot;">II Q 2020</span></th>
      <th><span data-raw-value="&quot;IV Q 2020&quot;">IV Q 2020</span></th>
    </tr></thead>
    <tbody>
      <tr>
        <td class="-unpaginated"><span data-raw-value="&quot;Aktywa (tys. zł)&quot;">Aktywa (tys. zł)</span></td>
        <td><span data-raw-value="{&quot;value&quot;:&quot;222380996&quot;}"><span class="a-quote-item -value">222&nbsp;380&nbsp;996</span></span></td>
        <td><span data-raw-value="{&quot;value&quot;:&quot;233217182&quot;}"><span class="a-quote-item -value">233&nbsp;217&nbsp;182</span></span></td>
      </tr>
      <tr>
        <td class="-unpaginated"><span data-raw-value="&quot;Zysk (strata) netto (tys. zł)*&quot;">Zysk netto</span></td>
        <td><span data-raw-value="{&quot;value&quot;:&quot;1126424&quot;}"></span></td>
        <td><span data-raw-value="{&quot;value&quot;:&quot;2176558&quot;}"></span></td>
      </tr>
    </tbody>
  </table></body></html>`;

  it("parses indicator series with period headers and values", () => {
    const indicators = parseFinancialReport(html);
    expect(indicators).toHaveLength(2);

    const aktywa = indicators[0]!;
    expect(aktywa.name).toBe("Aktywa (tys. zł)");
    expect(aktywa.series).toHaveLength(2);
    expect(aktywa.series[0]).toEqual({ period: "II Q 2020", quarter: 2, year: 2020, value: 222380996 });
    expect(aktywa.series[1]).toEqual({ period: "IV Q 2020", quarter: 4, year: 2020, value: 233217182 });

    const netto = indicators[1]!;
    expect(netto.series[1]!.value).toBe(2176558);
  });

  it("uses the visible text as the label when data-raw-value is absent", () => {
    const simple = `<table class="m-quotes-data-table"><thead><tr><th>II Q 2020</th></tr></thead>
      <tbody><tr><td>Kapitał</td><td>100</td></tr></tbody></table>`;
    const indicators = parseFinancialReport(simple);
    expect(indicators[0]!.name).toBe("Kapitał");
    expect(indicators[0]!.series[0]!.value).toBe(100);
  });

  it("skips rows without a label or with no values", () => {
    const simple = `<table class="m-quotes-data-table"><thead><tr><th>IV Q 2020</th></tr></thead>
      <tbody>
        <tr><td>Wskaźnik</td><td>1</td></tr>
        <tr><td>Wykres</td><td>2</td></tr>
      </tbody></table>`;
    expect(parseFinancialReport(simple)).toEqual([]);
  });

  it("returns an empty list for a page without a table", () => {
    expect(parseFinancialReport("<html><p>no data</p></html>")).toEqual([]);
  });
});
