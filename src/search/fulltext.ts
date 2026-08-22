export const SEARCH_CAP = 100_000;

export interface SearchQuery {
  where: string;
  params: unknown[];
  orderBy: string;
  limit: number;
}

export function buildSearchQuery(q: string, limit = 1000): SearchQuery {
  const term = q.trim();
  const like = `%${term}%`;
  return {
    where: ` WHERE name LIKE ? OR nip LIKE ? OR krs LIKE ? OR regon LIKE ?`,
    params: [like, like, like, like],
    orderBy: ` ORDER BY length(name) ASC`,
    limit: Math.min(limit, SEARCH_CAP),
  };
}
