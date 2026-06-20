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

/** Escape a string for safe embedding inside a JS template literal. */
function escapeForTemplate(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
}

/**
 * Body of a JSON-string bundle: the named sections serialised to one JSON
 * object, one record per line, escaped for embedding inside a JS template
 * literal. The caller wraps the returned text in backticks and `JSON.parse`.
 *
 * Use this instead of {@link bundleSection} for sections large or wide enough
 * that a TS object literal overflows the compiler's union-complexity limit
 * (TS2590). Parsing a JSON string yields `any`, so no per-literal type is
 * formed — while one-record-per-line keeps the generated file's diffs
 * reviewable across scrapes.
 */
export function bundleJsonParseBody(sections: Record<string, Record<string, unknown>[]>): string {
  const parts = Object.entries(sections).map(([name, records]) => {
    const items = records.map(stringifyRecord).join(",\n");
    return `${JSON.stringify(name)}:[\n${items}\n]`;
  });
  return escapeForTemplate(`{${parts.join(",")}}`);
}
