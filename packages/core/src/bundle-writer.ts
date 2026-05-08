/** Helpers shared by the apps' `scripts/scrape.ts` for emitting the
 *  bundled `src/scrape-data.ts` module. */

/** Compact JSON for one record: keys sorted alphabetically; null and
 *  undefined fields stripped; no internal whitespace. Two consecutive
 *  scrapes on identical data produce byte-identical output, which keeps
 *  the GH Action's commit-if-changed step quiet. */
export function stringifyRecord(record: Record<string, unknown>): string {
  const entries = Object.entries(record)
    .filter(([, v]) => v !== null && v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));
  const parts = entries.map(([k, v]) => `${JSON.stringify(k)}:${JSON.stringify(v)}`);
  return `{${parts.join(",")}}`;
}

/** "  shows: [\n    {…},\n    {…}\n  ]," — one named array of records,
 *  formatted for the surrounding bundle module. */
export function bundleSection(name: string, records: Record<string, unknown>[]): string {
  const items = records.map(stringifyRecord).join(",\n    ");
  return `  ${name}: [\n    ${items}\n  ],`;
}
