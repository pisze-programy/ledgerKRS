/**
 * Documented residuals — BizRaport data-quality quirks / drift where our
 * extraction is correct per the current RDF documents (see PARITY.md).
 * - `"*"`      — whole company (BizRaport messy extraction / unsupported layout).
 * - `{year: "*"}` — all indicators for that year (rounding, etc.).
 * - `{year: ["ind"]}` — specific indicators.
 */
export type YearExemption = "*" | string[];
export const KNOWN_ISSUES: Record<string, Record<number, YearExemption> | "*"> = {
  // BizRaport reports values rounded to whole thousands for this company (2021+):
  // e.g. theirs=1170000 vs our exact 1169543.1. Our data is correct.
  "0000878245": { 2021: "*", 2022: "*", 2023: "*", 2024: "*", 2025: "*" },
  // BizRaport's own op/brutto/netto are internally inconsistent across years
  // (abnormal RZiS: negative "pozostałe koszty", brutto sometimes at I sometimes J).
  "0000139939": "*",
  "0000659179": "*",
  // Company's RDF filing metadata mislabels periods (a file named 2023 contains a
  // 2022 statement); we likely pick a different filing revision than BizRaport.
  "0000721871": "*",
  // Insurer (zakład ubezpieczeń) — SFZURZ layout, different statement structure.
  // Separate stage, not yet implemented.
  "0000009831": "*",
  // BizRaport quirks (their data, not our extraction):
  // - 0000393416 2022: BizRaport reports zysk_operacyjny = 0 despite C+D−E ≠ 0.
  // - 0000176134 2023: BizRaport flips the sign of a negative podatek (abs), while
  //   it reports negative podatek as-is for other companies (0000582708 2025).
  // - 0000416704 2018: BizRaport's op is rounded to whole 10 zł (off by 20).
  // - 0000085314 2025: company filed C=0 while A−B=14497.28; BizRaport trusted the
  //   filed C (0), and its op=H. We derive A−B — and BizRaport derives A−B for
  //   0000723096 (C=−13321 there). Inconsistent BizRaport behavior; ours is sound.
  "0000176134": { 2023: ["podatek_dochodowy"] },
  "0000416704": { 2018: ["zysk_operacyjny"] },
  "0000085314": { 2025: ["zysk_ze_sprzedazy", "zysk_operacyjny"] },
  // BizRaport reports 0 for brutto/op on these messy companies (their own choice),
  // or derives op = A−B on the old ABCF structure:
  "0000617088": { 2020: ["zysk_brutto"], 2021: ["zysk_brutto"], 2022: ["zysk_brutto"], 2023: ["zysk_operacyjny"], 2024: ["zysk_operacyjny"] },
  "0000723096": { 2018: ["przychody", "zysk_operacyjny"], 2019: ["przychody", "zysk_operacyjny"], 2020: ["przychody", "zysk_operacyjny"] },
  "0000810502": { 2020: ["przychody", "koszty_sprzedanych_produktow", "zysk_ze_sprzedazy", "podatek_dochodowy"] },
  // 0001066345 2025: BizRaport reports podatek positive (4750) while filed J is
  // negative (−38351); sign quirk like 0000176134.
  "0001066345": { 2025: ["podatek_dochodowy"] },
  // CONNER 2019: BizRaport used a corrected filing we don't have (see PARITY.md).
  "0000320584": { 2018: ["amortyzacja"], 2019: ["przychody"] },
  // ===== second corpus batch (100-firm random draw + extremes) =====
  // BizRaport 2021 comes from a full-period filing no longer present in RDF
  // (the current filing is dormant: A=0, suma 2.19M). Our data reflects RDF.
  "0000005989": { 2021: "*" },
  // BizRaport reports negative podatek as positive (abs) — same quirk as
  // 0000176134 2023 / 0001066345 2025.
  "0000082738": { 2025: ["podatek_dochodowy"] },
  "0000386719": {
    2018: ["kapital_wlasny", "zobowiazania_i_rezerwy", "zysk_brutto", "zysk_netto", "podatek_dochodowy"],
    2019: ["podatek_dochodowy"], 2020: ["podatek_dochodowy"], 2021: ["podatek_dochodowy"],
  },
  "0000644867": { 2022: ["podatek_dochodowy"], 2023: ["amortyzacja"], 2024: ["podatek_dochodowy", "amortyzacja"] },
  "0000963253": { 2023: ["podatek_dochodowy"] },
  "0001135157": { 2025: ["podatek_dochodowy"] },
  "0001186753": { 2025: ["podatek_dochodowy"] },
  "0000735143": { 2025: ["podatek_dochodowy"] },
  // Degenerate no-revenue years / garbled filings where BizRaport's own
  // extraction collapses (op = brutto = netto = one line, or 0.3 zł revenue).
  "0000855605": "*",
  "0000260788": { 2022: ["zysk_ze_sprzedazy", "zysk_operacyjny"] },
  "0001014687": { 2023: ["zysk_ze_sprzedazy", "zysk_operacyjny"] },
  "0000306786": { 2018: ["przychody", "zysk_ze_sprzedazy", "zysk_operacyjny", "zysk_brutto", "podatek_dochodowy", "amortyzacja"] },
  "0000325544": { 2021: ["zysk_ze_sprzedazy", "podatek_dochodowy"] },
  "0000587590": { 2018: ["przychody_ze_sprzedazy"], 2020: ["przychody", "przychody_ze_sprzedazy", "amortyzacja"] },
  "0000958626": { 2025: ["przychody", "zysk_ze_sprzedazy", "zysk_operacyjny", "zysk_brutto", "podatek_dochodowy"] },
  "0000802552": { 2021: ["przychody", "zysk_operacyjny", "zysk_netto"] },
  "0000426023": { 2021: ["zysk_operacyjny", "podatek_dochodowy"] },
  "0000893560": { 2023: ["koszty_sprzedanych_produktow"] },
  // BizRaport reports 0 for indicators the statement omits (amortyzacja, etc.)
  // while we leave them null; or the LEGACY statement duplicates the B_I code
  // (0000644867) and BizRaport picks the other occurrence.
  "0000233196": { 2019: ["amortyzacja"] },
  "0000393416": { 2022: ["zysk_operacyjny"], 2023: ["amortyzacja"] },
  "0000421400": { 2018: ["amortyzacja"] },
  "0000481245": {
    2018: ["przychody", "przychody_ze_sprzedazy"], 2019: ["przychody", "przychody_ze_sprzedazy"],
    2020: ["przychody", "przychody_ze_sprzedazy"], 2021: ["przychody", "przychody_ze_sprzedazy"],
  },
  "0000554503": { 2020: ["amortyzacja"] },
  "0000560392": { 2022: ["amortyzacja"] },
  "0000574827": { 2020: ["amortyzacja"] },
  "0000581370": { 2018: ["amortyzacja"], 2019: ["podatek_dochodowy"], 2020: ["przychody", "zysk_operacyjny", "podatek_dochodowy"] },
  "0000686599": { 2018: ["przychody_ze_sprzedazy"] },
  "0000748637": { 2021: ["amortyzacja"] },
  "0000846396": { 2020: ["przychody"], 2021: ["przychody"], 2023: ["amortyzacja"] },
  "0000940449": { 2023: ["amortyzacja"] },
  "0000942976": { 2021: ["zysk_ze_sprzedazy", "zysk_brutto"] },
  "0000952873": { 2024: ["amortyzacja"] },
  // BizRaport's financial-income letter flips between F and G across years
  // (A+D+G vs A+D+F); we sum income letters from the dict consistently.
  "0000666310": { 2018: ["przychody"], 2019: ["przychody"], 2020: ["przychody"] },
  "0000672378": { 2021: ["przychody"] },
  // BizRaport data-quality: 0000661624 filed Aktywa with a ×100 typo and its
  // 2020-04..2021-03 filing is duplicated across 3 years (1132879.99 ×3).
  "0000661624": { 2019: ["suma_bilansowa"], 2022: ["suma_bilansowa"] },
  // BizRaport period/suma mismatch on a single year (revision or split year).
  "0000571619": { 2020: ["suma_bilansowa"] },
  "0000691408": { 2022: ["suma_bilansowa"] },
  "0000747439": { 2019: ["suma_bilansowa"] },
};
export function isKnownIssue(krs: string, rok: number, ind: string): boolean {
  const entry = KNOWN_ISSUES[krs];
  if (!entry) {
    return false;
  }
  if (entry === "*") {
    return true;
  }
  const year = entry[rok];
  return year === "*" || (Array.isArray(year) && year.includes(ind));
}
