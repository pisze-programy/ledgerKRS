import { describe, expect, it } from "vitest";
import { buildTaxonomy, divisionOf, levelOf, sectionLetterOf, slugify } from "../../src/sources/pkd/taxonomy";

describe("levelOf", () => {
  it("detects taxonomy levels", () => {
    expect(levelOf("J")).toBe("section");
    expect(levelOf("62")).toBe("division");
    expect(levelOf("62.0")).toBe("group");
    expect(levelOf("62.01.Z")).toBe("class");
  });
});

describe("buildTaxonomy", () => {
  it("assigns parents and sections", () => {
    const taxonomy = buildTaxonomy([
      { code: "J", name: "Informacja i komunikacja" },
      { code: "62", name: "Dział programowania" },
      { code: "62.0", name: "Grupa" },
      { code: "62.01.Z", name: "Podklasa" },
    ]);
    expect(taxonomy[0]!.level).toBe("section");
    expect(taxonomy[0]!.parent).toBeNull();
    expect(taxonomy[1]!.parent).toBe("J");
    expect(taxonomy[1]!.section).toBe("J");
    expect(taxonomy[2]!.parent).toBe("62");
    expect(taxonomy[3]!.parent).toBe("62.0");
    expect(taxonomy[3]!.section).toBe("J");
  });
});

describe("divisionOf / sectionLetterOf", () => {
  it("derives division and section from a class", () => {
    expect(divisionOf("62.01.Z")).toBe("62");
    expect(sectionLetterOf("47.11.Z")).toBeTruthy();
  });
});

describe("slugify", () => {
  it("slugifies polish names", () => {
    expect(slugify("Działalność związana z oprogramowaniem")).toBe("dzialalnosc-zwiazana-z-oprogramowaniem");
    expect(slugify("   ")).toBe("branch");
  });
});
