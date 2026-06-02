/**
 * Hands the scraper-audit findings to the GitHub Copilot coding agent.
 *
 * Opens (or, if one is already open, refreshes) a single issue labelled
 * `scraper-audit` and assigns it to the Copilot bot (`copilot-swe-agent`),
 * which makes Copilot investigate and open a fix PR. Reuses the open issue so
 * a daily run never piles up duplicates.
 *
 * Requires a user PAT in GH_TOKEN (the default GITHUB_TOKEN cannot assign
 * Copilot, and the token's user must have Copilot enabled). Reads the report
 * written by audit-scrapers.ts.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const LABEL = "scraper-audit";
const TITLE = "Scraper audit: under-delivering scrapers need a look";
const COPILOT_ASSIGNEE = "copilot-swe-agent[bot]";

const [owner, repo] = (process.env.GITHUB_REPOSITORY ?? "").split("/");
if (!owner || !repo) throw new Error("GITHUB_REPOSITORY (owner/repo) is not set");
if (!process.env.GH_TOKEN && !process.env.GITHUB_TOKEN) throw new Error("GH_TOKEN (a user PAT) is required");

const gh = (args: string[]) => execFileSync("gh", args, { encoding: "utf8" }).trim();

const report = readFileSync(process.env.AUDIT_REPORT_PATH ?? "scraper-audit-report.md", "utf8");

gh(["label", "create", LABEL, "--force", "--color", "B60205", "--description", "Daily scraper health audit findings"]);

const open = JSON.parse(gh(["issue", "list", "--label", LABEL, "--state", "open", "--json", "number,id", "--limit", "1"])) as {
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
  `${report}\n\n---\n_Opened automatically by the daily scraper-audit workflow and assigned to Copilot. Closing this issue stops the reminder until the next regression._`,
);
const issueUrl = gh(["issue", "create", "--title", TITLE, "--label", LABEL, "--body-file", bodyFile]);
const number = issueUrl.split("/").pop();

// Assign the Copilot coding agent via the documented REST agent-assignment
// body. We deliberately don't gate on the GraphQL suggestedActors query: it
// unreliably omits the bot for fine-grained PATs even when assignment works.
// NOTE: GH_TOKEN must have Contents + Pull requests + Actions write (not just
// Issues) — assigning the agent creates a branch/PR, so a token with only
// Issues:write gets HTTP 403 here even though it can create the issue.
const payloadFile = "/tmp/copilot-assign.json";
writeFileSync(
  payloadFile,
  JSON.stringify({
    assignees: [COPILOT_ASSIGNEE],
    agent_assignment: { target_repo: `${owner}/${repo}`, base_branch: "main", custom_instructions: "", custom_agent: "", model: "" },
  }),
);

let assigned: { assignees?: { login: string }[] } | null = null;
try {
  assigned = JSON.parse(
    gh([
      "api",
      "--method",
      "POST",
      "-H",
      "Accept: application/vnd.github+json",
      `/repos/${owner}/${repo}/issues/${number}/assignees`,
      "--input",
      payloadFile,
    ]),
  );
} catch (e) {
  console.error(
    `Created ${issueUrl} but assigning the Copilot agent failed (likely the PAT lacks Contents/Pull-requests/Actions write):\n${(e as Error).message}`,
  );
  process.exit(0);
}

if (assigned?.assignees?.some((a) => /copilot/i.test(a.login))) {
  console.log(`Created ${issueUrl} and assigned the Copilot coding agent.`);
} else {
  console.error(
    `Created ${issueUrl} but the Copilot coding agent did not stick as an assignee — assign it from the issue's Assignees menu, or confirm the agent is enabled for the repo. The issue remains as a tracker.`,
  );
}
