import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { parseSprawozdanie } from "../../src/sources/rdf/parser";
import { statementMeta } from "../../src/sources/rdf/layouts";
import { rzisRoles } from "../../src/sources/rdf/rzis";
import { extractFinancialInput } from "../../src/sources/rdf/indicators";

function load(name: string): string {
  return fs.readFileSync(path.join(__dirname, "..", "fixtures", name), "utf8");
}

describe("rzisRoles", () => {
  it("extracts RZiS roles via the value chain (GOING)", () => {
    const xml = load("rdf-jednostka-inna.xml");
    const meta = statementMeta(xml);
    const roles = rzisRoles(parseSprawozdanie(xml)!, meta);
    expect(roles.przychody).toBeCloseTo(133252762.98, 2);
    expect(roles.zyskOperacyjny).toBeCloseTo(-2078243.8, 1);
    expect(roles.zyskNetto).toBeCloseTo(-3014231.1, 1);
  });

  it("extracts RZiS roles via the value chain (JPK_SF, matches BizRaport)", () => {
    const xml = load("rdf-xades-jpk.xml");
    const meta = statementMeta(xml);
    const roles = rzisRoles(parseSprawozdanie(xml)!, meta);
    expect(roles.przychody).toBeCloseTo(38609746.87, 1);
    expect(roles.zyskOperacyjny).toBeCloseTo(55955.74, 1);
    expect(roles.zyskNetto).toBeCloseTo(86544.95, 1);
  });
});

describe("extractFinancialInput", () => {
  it("produces a FinancialInput that feeds computeIndicators (amortyzacja from RZiS.B_I)", () => {
    const xml = load("rdf-xades-jpk.xml");
    const meta = statementMeta(xml);
    const year = extractFinancialInput(parseSprawozdanie(xml)!, meta)!;
    expect(year.input.amortization).toBeCloseTo(5241.08, 2);
    expect(year.input.revenue).toBeCloseTo(38720880.34, 1);
    expect(year.input.salesRevenue).toBeCloseTo(38609746.87, 1);
    expect(year.input.netProfit).toBeCloseTo(86544.95, 1);
    expect(year.input.totalAssets).toBeCloseTo(8046252.06, 1);
  });

  it("extracts balance-sheet positions for the legacy fixture", () => {
    const xml = load("rdf-jednostka-inna.xml");
    const meta = statementMeta(xml);
    const year = extractFinancialInput(parseSprawozdanie(xml)!, meta)!;
    expect(year.input.totalAssets).toBeCloseTo(16855641.66, 1);
    expect(year.input.equity).toBeCloseTo(-32890677.18, 1);
  });

  it("applies BizRaport revenue definitions (income letters from the dict; RZiSPor = A+D+G)", () => {
    const xml = load("rdf-jednostka-inna.xml");
    const meta = statementMeta(xml);
    const year = extractFinancialInput(parseSprawozdanie(xml)!, meta)!;
    expect(year.input.salesRevenue).toBeCloseTo(133252762.98, 1);
    expect(year.input.operatingRevenue).toBeCloseTo(134381535.36, 1);
    expect(year.input.revenue).toBeCloseTo(134496967.7, 1);
    expect(year.input.costOfGoodsSold).toBeCloseTo(134273963.29, 1);
  });

  it("handles simplified porównawczy (old Mala/Mikro): revenue = A+D+F, brutto = op+F-G, podatek=I, netto=J (CONNER 2024 vs BizRaport)", () => {
    const xml = fs.readFileSync(path.join(__dirname, "..", "fixtures", "rdf-corpus", "0000320584", "20240101_20241231.xml"), "utf8");
    const meta = statementMeta(xml);
    const year = extractFinancialInput(parseSprawozdanie(xml)!, meta)!;
    expect(year.input.revenue).toBeCloseTo(5917627.34, 2);
    expect(year.input.salesRevenue).toBeCloseTo(5912524.58, 2);
    expect(year.input.operatingRevenue).toBeCloseTo(5917263.99, 2);
    expect(year.input.costOfGoodsSold).toBeCloseTo(5618153.79, 2);
    expect(year.input.operatingProfit).toBeCloseTo(99708.57, 2);
    expect(year.input.grossProfit).toBeCloseTo(83210.77, 2);
    expect(year.input.incomeTax).toBeCloseTo(9945, 2);
    expect(year.input.netProfit).toBeCloseTo(73265.77, 2);
  });

  it("handles old-schema JednostkaOp statutory RZiS: op=H, brutto=M, netto=O, podatek=0, revenue=A+D+I+K (0000278980 2018 vs BizRaport)", () => {
    const xml = fs.readFileSync(path.join(__dirname, "..", "fixtures", "rdf-corpus", "0000278980", "20180101_20181231.xml"), "utf8");
    const meta = statementMeta(xml);
    expect(meta.layout).toBe("SFJOPZ");
    const year = extractFinancialInput(parseSprawozdanie(xml)!, meta)!;
    expect(year.input.revenue).toBeCloseTo(1183737.79, 2);
    expect(year.input.operatingRevenue).toBeCloseTo(1183735.79, 2);
    expect(year.input.costOfGoodsSold).toBeCloseTo(1134144.01, 2);
    expect(year.input.operatingProfit).toBeCloseTo(4131.42, 2);
    expect(year.input.grossProfit).toBeCloseTo(3924.62, 2);
    expect(year.input.incomeTax).toBe(0);
    expect(year.input.netProfit).toBeCloseTo(3924.62, 2);
  });

  it("handles truncated Mikro (A..F, no H..L): revenue = A+C, netto = last letter (0000554503 2021 vs BizRaport)", () => {
    const xml = fs.readFileSync(path.join(__dirname, "..", "fixtures", "rdf-corpus", "0000554503", "20210101_20211231.xml"), "utf8");
    const meta = statementMeta(xml);
    const year = extractFinancialInput(parseSprawozdanie(xml)!, meta)!;
    expect(year.input.revenue).toBeCloseTo(1441965.6, 2);
    expect(year.input.salesRevenue).toBeCloseTo(1432600.72, 2);
    expect(year.input.costOfGoodsSold).toBeCloseTo(1428261.14, 2);
    expect(year.input.netProfit).toBeCloseTo(8691.07, 2);
  });

  it("truncated Mikro: BizRaport reads op=A−B, podatek=E, netto=F, operatingCosts=B (0000554503 2021 vs BizRaport)", () => {
    const xml = fs.readFileSync(path.join(__dirname, "..", "fixtures", "rdf-corpus", "0000554503", "20210101_20211231.xml"), "utf8");
    const meta = statementMeta(xml);
    const year = extractFinancialInput(parseSprawozdanie(xml)!, meta)!;
    expect(year.input.operatingProfit).toBeCloseTo(4339.58, 2); // A − B = 1432600.72 − 1428261.14
    expect(year.input.incomeTax).toBe(0);                        // E
    expect(year.input.grossProfit).toBeNull();                   // BizRaport does not report brutto
    expect(year.input.grossProfitOnSales).toBeNull();
    expect(year.input.profitOnSales).toBeNull();
    expect(year.input.operatingCosts).toBeCloseTo(1428261.14, 2); // B only — E is the tax, not an operating cost
  });

  it("truncated Mikro with a nonzero E reports E as the tax and keeps it out of operating costs", () => {
    const xml = `<?xml version="1.0" encoding="utf-8" standalone="no"?>
<Dokument>
  <OkresOd>2021-01-01</OkresOd>
  <OkresDo>2021-12-31</OkresDo>
  <JednostkaMikro>
    <RZiS>
      <A><dtsf:KwotaA>1000</dtsf:KwotaA><dtsf:KwotaB>800</dtsf:KwotaB></A>
      <B><dtsf:KwotaA>600</dtsf:KwotaA><dtsf:KwotaB>500</dtsf:KwotaB></B>
      <C><dtsf:KwotaA>0</dtsf:KwotaA><dtsf:KwotaB>0</dtsf:KwotaB></C>
      <D><dtsf:KwotaA>50</dtsf:KwotaA><dtsf:KwotaB>0</dtsf:KwotaB></D>
      <E><dtsf:KwotaA>40</dtsf:KwotaA><dtsf:KwotaB>0</dtsf:KwotaB></E>
      <F><dtsf:KwotaA>310</dtsf:KwotaA><dtsf:KwotaB>0</dtsf:KwotaB></F>
    </RZiS>
  </JednostkaMikro>
</Dokument>`;
    const meta = statementMeta(xml);
    expect(meta.layout).toBe("SFJMIZ");
    const year = extractFinancialInput(parseSprawozdanie(xml)!, meta)!;
    expect(year.input.operatingProfit).toBe(400);  // A − B
    expect(year.input.incomeTax).toBe(40);         // E
    expect(year.input.netProfit).toBe(310);        // F
    expect(year.input.operatingCosts).toBe(600);   // B, not B + E
    expect(year.input.revenue).toBe(1000);         // A + C
  });

  it("uses the internally consistent balance-sheet side when Aktywa and Pasywa disagree (0000450927 2018 vs BizRaport)", () => {
    const xml = `<?xml version="1.0" encoding="utf-8" standalone="no"?>
<Dokument>
  <OkresOd>2018-01-01</OkresOd>
  <OkresDo>2018-12-31</OkresDo>
  <JednostkaInna>
    <Bilans>
      <Aktywa><dtsf:KwotaA>1047768.58</dtsf:KwotaA></Aktywa>
      <Aktywa_A><dtsf:KwotaA>0</dtsf:KwotaA></Aktywa_A>
      <Aktywa_B><dtsf:KwotaA>4891524.75</dtsf:KwotaA></Aktywa_B>
      <Pasywa><dtsf:KwotaA>5939293.33</dtsf:KwotaA></Pasywa>
      <Pasywa_A><dtsf:KwotaA>314282.87</dtsf:KwotaA></Pasywa_A>
      <Pasywa_B><dtsf:KwotaA>5625010.46</dtsf:KwotaA></Pasywa_B>
    </Bilans>
    <RZiS>
      <A><dtsf:KwotaA>1000</dtsf:KwotaA></A><B><dtsf:KwotaA>600</dtsf:KwotaA></B>
      <C><dtsf:KwotaA>400</dtsf:KwotaA></C><D><dtsf:KwotaA>50</dtsf:KwotaA></D>
      <E><dtsf:KwotaA>0</dtsf:KwotaA></E><F><dtsf:KwotaA>450</dtsf:KwotaA></F>
      <G><dtsf:KwotaA>100</dtsf:KwotaA></G><H><dtsf:KwotaA>50</dtsf:KwotaA></H>
      <I><dtsf:KwotaA>20</dtsf:KwotaA></I><J><dtsf:KwotaA>30</dtsf:KwotaA></J>
      <K><dtsf:KwotaA>0</dtsf:KwotaA></K><L><dtsf:KwotaA>30</dtsf:KwotaA></L>
    </RZiS>
  </JednostkaInna>
</Dokument>`;
    const meta = statementMeta(xml);
    const year = extractFinancialInput(parseSprawozdanie(xml)!, meta)!;
    expect(year.input.totalAssets).toBe(5939293.33); // the coherent Pasywa side
  });

  it("chain recognises a no-tax filing (brutto == netto) and fills podatek = 0", () => {
    const xml = `<?xml version="1.0" encoding="utf-8" standalone="no"?>
<Dokument>
  <OkresOd>2021-01-01</OkresOd>
  <OkresDo>2021-12-31</OkresDo>
  <JednostkaMikro>
    <RZiS>
      <A><dtsf:KwotaA>100</dtsf:KwotaA></A><B><dtsf:KwotaA>60</dtsf:KwotaA></B>
      <C><dtsf:KwotaA>40</dtsf:KwotaA></C>
      <H><dtsf:KwotaA>50</dtsf:KwotaA></H><J><dtsf:KwotaA>50</dtsf:KwotaA></J>
    </RZiS>
  </JednostkaMikro>
</Dokument>`;
    const meta = statementMeta(xml);
    const year = extractFinancialInput(parseSprawozdanie(xml)!, meta)!;
    expect(year.input.grossProfit).toBe(50);  // H
    expect(year.input.incomeTax).toBe(0);     // brutto == netto -> no tax
    expect(year.input.netProfit).toBe(50);    // J
  });

  it("maps the WTys layout (filed in thousands of zł) to its base key and scales amounts ×1000", () => {
    const xml = `<?xml version="1.0" encoding="utf-8" standalone="no"?>
<Dokument>
  <OkresOd>2025-01-01</OkresOd>
  <OkresDo>2025-12-31</OkresDo>
  <JednostkaMikroWTys>
    <Bilans><Aktywa><dtsf:KwotaA>211</dtsf:KwotaA></Aktywa></Bilans>
    <RZiS>
      <A><dtsf:KwotaA>100</dtsf:KwotaA></A><B><dtsf:KwotaA>60</dtsf:KwotaA></B>
      <C><dtsf:KwotaA>40</dtsf:KwotaA></C><D><dtsf:KwotaA>0</dtsf:KwotaA></D>
      <E><dtsf:KwotaA>0</dtsf:KwotaA></E><F><dtsf:KwotaA>50</dtsf:KwotaA></F>
    </RZiS>
  </JednostkaMikroWTys>
</Dokument>`;
    const meta = statementMeta(xml);
    expect(meta.layout).toBe("SFJMIZ");
    expect(meta.scale).toBe(1000);
    const year = extractFinancialInput(parseSprawozdanie(xml)!, meta)!;
    expect(year.input.revenue).toBe(140000);   // (A + C) × 1000
    expect(year.input.totalAssets).toBe(211000);
    expect(year.input.netProfit).toBe(50000);  // F × 1000
  });

  it("handles the minimal Mikro statement (single F line) — netto only, revenue stays null (0000672378)", () => {
    const xml = `<?xml version="1.0" encoding="utf-8" standalone="no"?>
<Dokument>
  <OkresOd>2020-01-01</OkresOd>
  <OkresDo>2020-12-31</OkresDo>
  <JednostkaMikroWTys>
    <Bilans><Aktywa><dtsf:KwotaA>122607</dtsf:KwotaA></Aktywa></Bilans>
    <RZiS><F><dtsf:KwotaA>-29643</dtsf:KwotaA></F></RZiS>
  </JednostkaMikroWTys>
</Dokument>`;
    const meta = statementMeta(xml);
    const year = extractFinancialInput(parseSprawozdanie(xml)!, meta)!;
    expect(year.input.revenue).toBeNull();
    expect(year.input.netProfit).toBe(-29643000);  // F × 1000
    expect(year.input.totalAssets).toBe(122607000);
  });

  it("handles consolidated group statement (SFSINZ, kalk A..W): revenue=A+G+J, op=I, brutto=R, podatek=S, netto=W — matches BizRaport (Totalizator 2025)", () => {
    const xml = fs.readFileSync(path.join(__dirname, "..", "fixtures", "rdf-consolidated-2025.xml"), "utf8");
    const meta = statementMeta(xml);
    expect(meta.layout).toBe("SFSINZ");
    const year = extractFinancialInput(parseSprawozdanie(xml)!, meta)!;
    expect(year.input.revenue).toBeCloseTo(89840026952.21, 2);
    expect(year.input.operatingRevenue).toBeCloseTo(89740566299.4, 2);
    expect(year.input.operatingProfit).toBeCloseTo(751416409.1, 2);
    expect(year.input.grossProfit).toBeCloseTo(823900112.1, 2);
    expect(year.input.incomeTax).toBeCloseTo(155251816, 2);
    expect(year.input.netProfit).toBeCloseTo(668648296.1, 2);
    expect(year.input.totalAssets).toBeCloseTo(3688572244.15, 2);
  });

  it("extracts wages from the porównawczy RZiS B_V line (0000085314 2018)", () => {
    const xml = fs.readFileSync(path.join(__dirname, "..", "fixtures", "rdf-corpus", "0000085314", "20180101_20181231.xml"), "utf8");
    const meta = statementMeta(xml);
    const year = extractFinancialInput(parseSprawozdanie(xml)!, meta)!;
    expect(year.input.wages).toBeCloseTo(201874.82, 2);
  });

  it("leaves wages null when the statement has no separate wages line (kalkulacyjny consolidated)", () => {
    const xml = fs.readFileSync(path.join(__dirname, "..", "fixtures", "rdf-consolidated-2025.xml"), "utf8");
    const meta = statementMeta(xml);
    const year = extractFinancialInput(parseSprawozdanie(xml)!, meta)!;
    expect(year.input.wages).toBeNull();
  });
});
