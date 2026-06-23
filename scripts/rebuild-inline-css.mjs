#!/usr/bin/env bun
/**
 * Pre-commit guard: keep each app's committed, inlined `src/styles-inline.ts`
 * (the CSS the worker actually serves) in sync with its source stylesheet.
 *
 * Editing `apps/<app>/src/styles.css` (or `app.css`) without re-running
 * `bun run css` leaves a stale `styles-inline.ts` — the markup ships without
 * its styles. lefthook invokes this with the staged source-CSS files; for each
 * affected app it re-runs the `css` build and re-stages the generated
 * `styles-inline.ts` + `public/styles.css`.
 */
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";

const SRC_CSS = /^(apps\/[^/]+)\/src\/[^/]+\.css$/;

const apps = new Set();
for (const file of process.argv.slice(2)) {
  const m = file.match(SRC_CSS);
  if (m) apps.add(m[1]);
}

for (const app of apps) {
  process.stderr.write(`rebuild-inline-css: ${app}\n`);
  execFileSync("bun", ["run", "css"], { cwd: app, stdio: "inherit" });
  const outputs = [`${app}/src/styles-inline.ts`, `${app}/public/styles.css`].filter((p) => existsSync(p));
  if (outputs.length > 0) execFileSync("git", ["add", ...outputs], { stdio: "inherit" });
}
