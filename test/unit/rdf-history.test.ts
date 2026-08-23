import { describe, expect, it } from "vitest";
import { terminZlozeniaFor, historyEntryFromMeta } from "../../src/sources/rdf/history";

describe("terminZlozeniaFor — statutory filing deadline", () => {
  it("adds 6 months + 15 days to a calendar-year period end (2025 -> 2026-07-15)", () => {
    expect(terminZlozeniaFor("2025-12-31")).toBe("2026-07-15");
  });

  it("handles a non-calendar fiscal year end", () => {
    expect(terminZlozeniaFor("2021-05-31")).toBe("2021-12-15");
  });

  it("returns null for a null/undefined period end", () => {
    expect(terminZlozeniaFor(null)).toBeNull();
    expect(terminZlozeniaFor(undefined)).toBeNull();
  });

  it("returns null for a malformed date", () => {
    expect(terminZlozeniaFor("2025/12/31")).toBeNull();
    expect(terminZlozeniaFor("not-a-date")).toBeNull();
  });
});

describe("historyEntryFromMeta — RDF document metadata mapping", () => {
  it("maps dataDodania and the computed deadline", () => {
    const entry = historyEntryFromMeta(
      { dataDodania: "2026-07-06", dataSporzadzenia: "2026-03-25" },
      "2025-01-01_2025-12-31",
      2025,
    );
    expect(entry.okresSprawozdawczy).toBe("2025-01-01_2025-12-31");
    expect(entry.rok).toBe(2025);
    expect(entry.terminZlozenia).toBe("2026-07-15");
    expect(entry.dataDodaniaDoKrs).toBe("2026-07-06");
  });

  it("handles missing metadata gracefully", () => {
    const entry = historyEntryFromMeta({}, null, null);
    expect(entry.okresSprawozdawczy).toBeNull();
    expect(entry.rok).toBeNull();
    expect(entry.terminZlozenia).toBeNull();
    expect(entry.dataDodaniaDoKrs).toBeNull();
  });
});
