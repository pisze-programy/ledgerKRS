import { describe, expect, it } from "vitest";
import { findSimilarOrganizations, type SimilarFirm } from "../../src/metrics/similar";

const FIRMS: SimilarFirm[] = [
  { krs: "A", pkd: "49.41.Z", aktywa: 1000 },
  { krs: "B", pkd: "49.41.Z", aktywa: 1100 },
  { krs: "C", pkd: "49.41.Z", aktywa: 10_000_000 },
  { krs: "D", pkd: "55.10.Z", aktywa: 1500 },
];

describe("findSimilarOrganizations — same PKD, closest scale", () => {
  it("returns same-PKD firms ordered by closest scale, excluding the target", () => {
    const result = findSimilarOrganizations(FIRMS, FIRMS[0]!, 2);
    expect(result.map((f) => f.krs)).toEqual(["B", "C"]);
  });

  it("never returns a firm from a different PKD", () => {
    const result = findSimilarOrganizations(FIRMS, FIRMS[0]!, 10);
    expect(result.some((f) => f.pkd !== "49.41.Z")).toBe(false);
  });

  it("returns an empty list when there are no peers", () => {
    const result = findSimilarOrganizations([{ krs: "A", pkd: "49.41.Z", aktywa: 100 }], FIRMS[0]!, 5);
    expect(result).toEqual([]);
  });
});
