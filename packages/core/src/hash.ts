/**
 * FNV-1a 32-bit hash. Used for translation cache keys (museums) and
 * synthesising stable IDs from composite scrape keys (theaters). Returns
 * an 8-char zero-padded hex string.
 */
export function fnv1a(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

/** Same hash but returned as a positive 32-bit integer — fits inside JS safe ints
 *  and is what we want for synthetic Performance IDs (the URL shape `?item=perf-{n}`
 *  treats the suffix as numeric). */
export function fnv1aInt(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }
  return hash >>> 0;
}
