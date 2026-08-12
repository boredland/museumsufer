/**
 * Opens (or refreshes) a GitHub issue when the scrape workflow fails and hands
 * it to the Copilot coding agent.
 *
 * Runs as the scrape job's `if: failure()` step. It pulls the failed run's
 * metadata and failed-step logs, distils them into a digest (root-cause error
 * block, per-venue FAIL lines, and the raw log tail), then reuses a single
 * open `scrape-failure` issue so back-to-back failures comment rather than
 * pile up new issues.
 *
 * Requires a user PAT in GH_TOKEN with Actions read (to fetch logs) plus the
 * Contents/Pull-requests/Actions write that Copilot assignment needs.
 */
import { writeFileSync } from "node:fs";
import { assignCopilot, ensureLabel, gh } from "./lib/github";

const LABEL = "scrape-failure";

const [owner, repo] = (process.env.GITHUB_REPOSITORY ?? "").split("/");
const runId = process.env.GITHUB_RUN_ID;
if (!owner || !repo) throw new Error("GITHUB_REPOSITORY (owner/repo) is not set");
if (!runId) throw new Error("GITHUB_RUN_ID is not set");
if (!process.env.GH_TOKEN && !process.env.GITHUB_TOKEN) throw new Error("GH_TOKEN (a user PAT) is required");

interface RunStep {
  name: string;
  conclusion: string | null;
  number: number;
}
interface RunJob {
  name: string;
  conclusion: string | null;
  steps: RunStep[];
}
interface RunView {
  displayTitle: string;
  headBranch: string;
  event: string;
  attempt: number;
  url: string;
  workflowName: string;
  jobs: RunJob[];
}

const run = JSON.parse(
  gh(["run", "view", runId, "--json", "displayTitle,headBranch,event,attempt,url,workflowName,jobs"]),
) as RunView;

const failedSteps = run.jobs.flatMap((job) =>
  job.steps.filter((s) => s.conclusion === "failure").map((s) => `${job.name} → ${s.name}`),
);

const rawLog = safeFailedLog(runId);
const cleaned = rawLog.split("\n").map(stripLogPrefix);

const errorBlocks = extractErrorBlocks(cleaned);
const failLines = dedupe(cleaned.filter((l) => /:\s*FAIL\s+—/.test(l) || /\bbatch failed\b/.test(l)));
const tail = cleaned.filter((l) => l.trim().length > 0).slice(-150);

const title = `Scrape workflow failed: ${run.displayTitle}`;
const body = [
  `## ${run.workflowName} run failed`,
  "",
  `- **Run:** ${run.url}`,
  `- **Branch:** \`${run.headBranch}\` · **Trigger:** \`${run.event}\` · **Attempt:** ${run.attempt}`,
  `- **Failed step(s):** ${failedSteps.length ? failedSteps.map((s) => `\`${s}\``).join(", ") : "_unknown_"}`,
  `- **Detected at (UTC):** ${new Date().toISOString()}`,
  "",
  "### Likely root cause",
  errorBlocks.length ? fence(errorBlocks.join("\n\n")) : "_No uncaught error block found in the failed-step log — see the tail below and the linked run._",
  "",
  `### Venue / pipeline failures this run (${failLines.length})`,
  failLines.length ? fence(failLines.join("\n")) : "_None recorded._",
  "",
  "### Failed-step log tail",
  fence(tail.join("\n")),
  "",
  "---",
  "_Opened automatically by the scrape workflow's failure handler and assigned to Copilot. Closing this issue stops the reminder until the next failure._",
].join("\n");

ensureLabel(LABEL, "D93F0B", "Automated scrape workflow failure reports");

const open = JSON.parse(
  gh(["issue", "list", "--label", LABEL, "--state", "open", "--json", "number", "--limit", "1"]),
) as { number: number }[];

if (open.length > 0) {
  const { number } = open[0];
  const commentFile = "/tmp/scrape-failure-comment.md";
  writeFileSync(commentFile, `Another failure — ${run.url}\n\n${body}`);
  gh(["issue", "comment", String(number), "--body-file", commentFile]);
  console.log(`Refreshed existing scrape-failure issue #${number}.`);
  process.exit(0);
}

const bodyFile = "/tmp/scrape-failure-body.md";
writeFileSync(bodyFile, body);
const issueUrl = gh(["issue", "create", "--title", title, "--label", LABEL, "--body-file", bodyFile]);
const number = issueUrl.split("/").pop();
if (!number) throw new Error(`could not parse issue number from ${issueUrl}`);

try {
  if (assignCopilot(owner, repo, number)) {
    console.log(`Created ${issueUrl} and assigned the Copilot coding agent.`);
  } else {
    console.error(
      `Created ${issueUrl} but the Copilot coding agent did not stick as an assignee — assign it manually or confirm the agent is enabled for the repo.`,
    );
  }
} catch (e) {
  console.error(
    `Created ${issueUrl} but assigning the Copilot agent failed (likely the PAT lacks Contents/Pull-requests/Actions write):\n${(e as Error).message}`,
  );
}

function safeFailedLog(id: string): string {
  try {
    return gh(["run", "view", id, "--log-failed"]);
  } catch {
    // A job that crashed the runner (or was cancelled) may have no per-step
    // failed log; fall back to the full log so the issue still has context.
    try {
      return gh(["run", "view", id, "--log"]);
    } catch {
      return "";
    }
  }
}

/** `gh run view --log` prefixes each line with `job\tstep\t<ISO timestamp> `. */
function stripLogPrefix(line: string): string {
  const afterTabs = line.split("\t").slice(2).join("\t");
  const content = afterTabs || line;
  return content.replace(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z\s/, "");
}

/**
 * Bun prints uncaught errors and unhandled rejections as an `error:` line
 * followed by a code frame and stack, terminating in a `Bun vX.Y.Z` banner.
 * Capture each such run of lines so the digest leads with the actual crash.
 */
function extractErrorBlocks(lines: string[]): string[] {
  const blocks: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (!/^error:/.test(lines[i])) continue;
    const block: string[] = [lines[i]];
    for (let j = i + 1; j < lines.length && block.length < 30; j++) {
      const l = lines[j];
      // A normal log line (or the next error) means the stack has ended.
      if (/^error:/.test(l) || /^\[event-hub\]/.test(l)) break;
      block.push(l);
      if (/^Bun v\d/.test(l)) break;
    }
    blocks.push(block.join("\n").trimEnd());
  }
  return dedupe(blocks).slice(0, 5);
}

function dedupe(items: string[]): string[] {
  return [...new Set(items.map((s) => s.trim()))].filter((s) => s.length > 0);
}

function fence(content: string): string {
  const clipped = content.length > 12_000 ? `${content.slice(0, 12_000)}\n… (truncated)` : content;
  return ["```", clipped.replace(/```/g, "ʼʼʼ"), "```"].join("\n");
}
