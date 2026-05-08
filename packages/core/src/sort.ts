/** Three-way comparator that puts null/undefined at the end —
 *  matches the SQL `ORDER BY x NULLS LAST` semantic. Used by both
 *  apps to sort performances/events by time when the time column
 *  is optional. */
export function compareNullsLast<T>(a: T | null | undefined, b: T | null | undefined): number {
  if (a === b) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === "string" && typeof b === "string") return a.localeCompare(b);
  return a < b ? -1 : a > b ? 1 : 0;
}
