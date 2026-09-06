export const ACTION_DIGEST_LIMIT = 8;

/** Soonest-deadline first, capped. Null deadlines sort last. */
export function selectActionDigest<T extends { responseDeadline: string | null }>(
  items: T[],
  limit = ACTION_DIGEST_LIMIT
): { selected: T[]; omitted: number } {
  const sorted = [...items].sort((a, b) => {
    const at = a.responseDeadline ? Date.parse(a.responseDeadline) : Number.POSITIVE_INFINITY;
    const bt = b.responseDeadline ? Date.parse(b.responseDeadline) : Number.POSITIVE_INFINITY;
    const aN = Number.isNaN(at) ? Number.POSITIVE_INFINITY : at;
    const bN = Number.isNaN(bt) ? Number.POSITIVE_INFINITY : bt;
    return aN - bN;
  });
  const selected = sorted.slice(0, limit);
  return { selected, omitted: Math.max(0, items.length - selected.length) };
}
