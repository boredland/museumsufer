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
const COPILOT_LOGIN = "copilot-swe-agent";

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
const issueId = gh(["issue", "view", String(number), "--json", "id", "--jq", ".id"]);

const actors = JSON.parse(
  gh([
    "api",
    "graphql",
    "-f",
    `query=query($owner:String!,$name:String!){repository(owner:$owner,name:$name){suggestedActors(capabilities:[CAN_BE_ASSIGNED],first:100){nodes{login __typename ... on Bot {id} ... on User {id}}}}}`,
    "-F",
    `owner=${owner}`,
    "-F",
    `name=${repo}`,
  ]),
) as { data: { repository: { suggestedActors: { nodes: { login: string; id: string }[] } } } };

const bot = actors.data.repository.suggestedActors.nodes.find((n) => n.login === COPILOT_LOGIN);
if (!bot) {
  console.error(
    `Copilot coding agent (${COPILOT_LOGIN}) is not assignable for ${owner}/${repo}. Issue ${issueUrl} was created but left unassigned. Check that the PAT's user has Copilot enabled and the repo allows the coding agent.`,
  );
  process.exit(0);
}

gh([
  "api",
  "graphql",
  "-f",
  `query=mutation($assignableId:ID!,$actorIds:[ID!]!){replaceActorsForAssignable(input:{assignableId:$assignableId,actorIds:$actorIds}){assignable{... on Issue{assignees(first:10){nodes{login}}}}}}`,
  "-F",
  `assignableId=${issueId}`,
  "-F",
  `actorIds[]=${bot.id}`,
]);

console.log(`Created ${issueUrl} and assigned ${COPILOT_LOGIN}.`);
