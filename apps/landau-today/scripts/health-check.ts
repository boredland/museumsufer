#!/usr/bin/env bun
/**
 * Run all source health checks and exit non-zero on any failure.
 * Wire-up matches the museumsufer pattern so the GH Action only needs
 * a single line to invoke.
 */
import { formatResults, runHealthChecks } from "../src/health-check";

const results = await runHealthChecks();
console.log(formatResults(results));

const failed = results.filter((r) => !r.ok);
if (failed.length > 0) {
  console.error(`\n${failed.length} check(s) failed.`);
  process.exit(1);
}
