import { describe, expect, it } from "vitest";
import layoutDicts from "../../src/sources/rdf/data/layout-dicts.json";
import { entriesFor } from "../../src/sources/rdf/names";

const LAYOUTS = ["SFJINZ", "SFJMAZ", "SFJMIZ", "SFJOPZ", "SFBNKZ", "SFSINZ"] as const;

const REQUIRED_SECTIONS: Record<(typeof LAYOUTS)[number], string[]> = {
  // Every layout must describe the balance sheet, both RZiS variants, the
  // statement of changes in equity and the cash-flow statement.
  SFJINZ: ["Bilans", "RZiSKalk", "RZiSPor", "ZestZmianWKapitale", "RachPrzeplywow"],
  SFJMAZ: ["Bilans", "RZiSKalk", "RZiSPor", "ZestZmianWKapitale", "RachPrzeplywow"],
  SFJMIZ: ["Bilans", "RZiSKalk", "RZiSPor", "ZestZmianWKapitale", "RachPrzeplywow"],
  SFJOPZ: ["Bilans", "RZiSKalk", "RZiSPor", "ZestZmianWKapitale", "RachPrzeplywow"],
  // Banks have a bank-specific balance sheet, a single RZiS form (no kalk/por
  // split) and no separate cash-flow form.
  SFBNKZ: ["Bilans", "RZiS", "ZestZmianWKapitale"],
  // Consolidated statements: the official wzór 13854 uses a consolidated
  // balance sheet and full equity/cash-flow statements.
  SFSINZ: ["Bilans", "RZiSKalk", "RZiSPor", "ZestZmianWKapitale", "RachPrzeplywow"],
};

describe("schema coverage — layout dicts describe every required section", () => {
  for (const layout of LAYOUTS) {
    it(`${layout} covers all required sections`, () => {
      for (const section of REQUIRED_SECTIONS[layout]) {
        const entries =
          section === "RZiSKalk" || section === "RZiSPor"
            ? entriesFor(layout, "RZiS", section)
            : section === "RZiS"
              ? entriesFor(layout, "RZiS")
              : entriesFor(layout, section);
        expect(entries.length, `${layout} ${section} = ${entries.length} entries`).toBeGreaterThan(0);
      }
    });
  }

  it("the dict file has an entry for every supported layout key", () => {
    const dict = layoutDicts as Record<string, { names: Record<string, string> }>;
    for (const layout of LAYOUTS) {
      expect(dict[layout], `dict for ${layout}`).toBeDefined();
      expect(Object.keys(dict[layout]!.names).length).toBeGreaterThan(100);
    }
  });
});
