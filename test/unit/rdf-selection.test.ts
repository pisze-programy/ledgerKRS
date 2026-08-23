import { describe, expect, it } from "vitest";
import { selectAnnualYears, type AnnualCandidate } from "../../src/sources/rdf/selection";

function candidate(id: string, rodzaj: string, okres: string | null, dataDodania: string | null = null): AnnualCandidate {
  return { id, rodzaj, okres, dataDodania };
}

describe("selectAnnualYears — one primary statement per fiscal year", () => {
  it("keeps one statement per distinct fiscal year", () => {
    const selected = selectAnnualYears([
      candidate("a", "18", "2020-01-01_2020-12-31"),
      candidate("b", "18", "2021-01-01_2021-12-31"),
      candidate("c", "18", "2022-01-01_2022-12-31"),
    ]);
    expect(selected.map((s) => s.rok)).toEqual([2020, 2021, 2022]);
    expect(selected.map((s) => s.candidate.id)).toEqual(["a", "b", "c"]);
    expect(selected.every((s) => s.reason === "only-filing")).toBe(true);
  });

  it("prefers the consolidated group statement (rodzaj 22) over the standalone (18) for the same year", () => {
    const selected = selectAnnualYears([
      candidate("standalone", "18", "2025-01-01_2025-12-31"),
      candidate("consolidated", "22", "2025-01-01_2025-12-31"),
    ]);
    expect(selected).toHaveLength(1);
    expect(selected[0]!.candidate.id).toBe("consolidated");
    expect(selected[0]!.reason).toContain("consolidated(22)>standalone(18)");
  });

  it("maps a 16-month transitional period and the following calendar year to separate years", () => {
    const selected = selectAnnualYears([
      candidate("transitional", "18", "2020-01-01_2021-04-30"),
      candidate("calendar", "18", "2021-01-01_2021-12-31"),
    ]);
    expect(selected.map((s) => s.rok)).toEqual([2020, 2021]);
    expect(selected.map((s) => s.candidate.id)).toEqual(["transitional", "calendar"]);
  });

  it("prefers a genuine annual statement over a partial one landing on the same year", () => {
    const selected = selectAnnualYears([
      candidate("partial", "18", "2021-07-01_2021-12-31"),
      candidate("annual", "18", "2021-01-01_2021-12-31"),
    ]);
    expect(selected).toHaveLength(1);
    expect(selected[0]!.candidate.id).toBe("annual");
    expect(selected[0]!.reason).toContain("annual>partial");
  });

  it("prefers a later filing over an earlier one for the same period (correction supersedes)", () => {
    const selected = selectAnnualYears([
      candidate("first", "18", "2020-01-01_2020-12-31", "2021-04-10"),
      candidate("second", "18", "2020-01-01_2020-12-31", "2022-02-01"),
    ]);
    expect(selected).toHaveLength(1);
    expect(selected[0]!.candidate.id).toBe("second");
    expect(selected[0]!.reason).toContain("latest-filing");
  });

  it("prefers the longer part of a split fiscal year over the short opening one (0000802552 2021)", () => {
    const selected = selectAnnualYears([
      candidate("short", "18", "2021-01-01_2021-02-25"),
      candidate("main", "18", "2021-02-26_2021-12-31"),
    ]);
    expect(selected).toHaveLength(1);
    expect(selected[0]!.candidate.id).toBe("main");
    expect(selected[0]!.reason).toContain("longer-period");
  });

  it("breaks ties deterministically by id", () => {
    const selected = selectAnnualYears([
      candidate("z9", "18", "2020-01-01_2020-12-31", "2021-04-10"),
      candidate("a1", "18", "2020-01-01_2020-12-31", "2021-04-10"),
    ]);
    expect(selected[0]!.candidate.id).toBe("a1");
  });

  it("sorts selected years ascending", () => {
    const selected = selectAnnualYears([
      candidate("b", "18", "2022-01-01_2022-12-31"),
      candidate("a", "18", "2020-01-01_2020-12-31"),
    ]);
    expect(selected.map((s) => s.rok)).toEqual([2020, 2022]);
  });

  it("skips candidates without a usable period", () => {
    const selected = selectAnnualYears([
      candidate("no-period", "18", null),
      candidate("ok", "18", "2020-01-01_2020-12-31"),
    ]);
    expect(selected.map((s) => s.candidate.id)).toEqual(["ok"]);
  });
});
