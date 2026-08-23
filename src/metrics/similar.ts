export interface SimilarFirm {
  krs: string;
  pkd: string;
  aktywa?: number | null;
  przychody?: number | null;
}

/** "Podobne organizacje": same PKD, closest by normalized scale (aktywa/przychody). */
export function findSimilarOrganizations(firms: SimilarFirm[], target: SimilarFirm, limit = 5): SimilarFirm[] {
  const peers = firms.filter((f) => f.krs !== target.krs && f.pkd === target.pkd);
  const scored = peers
    .map((firm) => ({
      firm,
      score: scaleDistance(firm, target),
    }))
    .filter((s) => s.score !== null)
    .sort((a, b) => (a.score! - b.score!));
  return scored.slice(0, limit).map((s) => s.firm);
}

function scaleDistance(a: SimilarFirm, b: SimilarFirm): number | null {
  const aScale = scaleOf(a);
  const bScale = scaleOf(b);
  if (aScale === null || bScale === null) {
    return null;
  }
  return Math.abs(Math.log2(aScale) - Math.log2(bScale));
}

function scaleOf(f: SimilarFirm): number | null {
  if (typeof f.aktywa === "number" && f.aktywa > 0) {
    return f.aktywa;
  }
  if (typeof f.przychody === "number" && f.przychody > 0) {
    return f.przychody;
  }
  return null;
}
