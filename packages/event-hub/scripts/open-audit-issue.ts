/**
 * Files the scraper-audit findings as a GitHub issue.
 *
 * Opens (or, if one is already open, refreshes) a single issue labelled
 * `scraper-audit`. Reusing the open issue means a daily run comments rather
 * than piling up duplicates.
 *
 * Reads the report written by audit-scrapers.ts.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { ensureLabel, gh } from "./lib/github";

const LABEL = "scraper-audit";
const TITLE = "Scraper audit: under-delivering scrapers need a look";

const [owner, repo] = (process.env.GITHUB_REPOSITORY ?? "").split("/");
if (!owner || !repo) throw new Error("GITHUB_REPOSITORY (owner/repo) is not set");
if (!process.env.GH_TOKEN && !process.env.GITHUB_TOKEN) throw new Error("GH_TOKEN is required");

const report = readFileSync(process.env.AUDIT_REPORT_PATH ?? "scraper-audit-report.md", "utf8");

ensureLabel(LABEL, "B60205", "Daily scraper health audit findings");

const open = JSON.parse(
  gh(["issue", "list", "--label", LABEL, "--state", "open", "--json", "number,id", "--limit", "1"]),
) as {
  number: number;
  id: string;
}[];

if (open.length > 0) {
  const { number } = open[0];
  const bodyFile = "/tmp/scraper-audit-comment.md";
  writeFileSync(bodyFile, `Refreshed audit (${new Date().toISOString().slice(0, 10)}):\n\n${report}`);
  gh(["issue", "comment", String(number), "--body-file", bodyFile]);
  console.log(`Refreshed existing audit issue #${number}.`);
  process.exit(0);
}

const bodyFile = "/tmp/scraper-audit-body.md";
writeFileSync(
  bodyFile,
  `${report}\n\n---\n_Opened automatically by the daily scraper-audit workflow. Closing this issue stops the reminder until the next regression._`,
);
const issueUrl = gh(["issue", "create", "--title", TITLE, "--label", LABEL, "--body-file", bodyFile]);
console.log(`Created ${issueUrl}.`);
