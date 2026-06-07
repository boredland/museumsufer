/**
 * Shared helpers for handing an issue to the GitHub Copilot coding agent.
 *
 * Assignment goes through the documented REST agent-assignment body rather
 * than the GraphQL suggestedActors query, which unreliably omits the bot for
 * fine-grained PATs even when assignment works. Requires a user PAT in
 * GH_TOKEN with Contents + Pull requests + Actions write (not just Issues) —
 * assigning the agent creates a branch/PR, so an Issues-only token gets 403.
 */
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

export const COPILOT_ASSIGNEE = "copilot-swe-agent[bot]";

export const gh = (args: string[]): string => execFileSync("gh", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).trim();

export function ensureLabel(name: string, color: string, description: string): void {
  gh(["label", "create", name, "--force", "--color", color, "--description", description]);
}

/** Returns true once the Copilot agent sticks as an assignee on the issue. */
export function assignCopilot(owner: string, repo: string, issueNumber: string | number): boolean {
  const payloadFile = "/tmp/copilot-assign.json";
  writeFileSync(
    payloadFile,
    JSON.stringify({
      assignees: [COPILOT_ASSIGNEE],
      agent_assignment: { target_repo: `${owner}/${repo}`, base_branch: "main", custom_instructions: "", custom_agent: "", model: "" },
    }),
  );
  const assigned = JSON.parse(
    gh([
      "api",
      "--method",
      "POST",
      "-H",
      "Accept: application/vnd.github+json",
      `/repos/${owner}/${repo}/issues/${issueNumber}/assignees`,
      "--input",
      payloadFile,
    ]),
  ) as { assignees?: { login: string }[] };
  return assigned?.assignees?.some((a) => /copilot/i.test(a.login)) ?? false;
}
