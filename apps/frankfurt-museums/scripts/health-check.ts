import { formatResults, runHealthChecks } from "../src/health-check";

async function main() {
  console.log("Running health checks...\n");
  const results = await runHealthChecks();
  const report = formatResults(results);
  console.log(report);

  const failed = results.filter((r) => !r.ok);
  if (failed.length > 0) {
    console.error(`\n${failed.length} check(s) failed.`);
    process.exit(1);
  }
}

main();
