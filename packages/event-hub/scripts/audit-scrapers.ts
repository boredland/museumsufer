/**
 * Daily scraper health audit. Reproduces the manual check that surfaced the
 * juedisches/fdh/caricatura bugs: a scraper that under-delivers usually points
 * at stale markup or a broken filter, not a genuinely empty venue.
 *
 * Signals (any hit makes the scraper a "suspect"):
 *   - a museum with an eventApi whose bundle entries are ALL exhibitions
 *     (zero actual events) — the fdh/caricatura/juedisches failure mode;
 *   - a registered venue scraper with zero bundle entries at all.
 *
 * Aggregators (which emit differently-named child slugs) and verified-empty
 * seasonal venues are exempted via audit-allowlist.json.
 *
 * Run locally: `bun packages/event-hub/scripts/audit-scrapers.ts`
 * In CI it also writes `suspects=<n>` to $GITHUB_OUTPUT, the report to
 * $GITHUB_STEP_SUMMARY, and a copy to $AUDIT_REPORT_PATH for the assign step.
 */
import { appendFileSync, writeFileSync } from "node:fs";
import { MUSEUMS, VENUE_SCRAPERS } from "@museumsufer/scrapers";
import { EVENTS } from "../data/events";
import allowlist from "./audit-allowlist.json" with { type: "json" };

const EXHIBITION_LABEL = "museum:ausstellung";
const EXEMPT = new Set(Object.keys(allowlist).filter((k) => !k.startsWith("_")));

const isExhibition = (e: (typeof EVENTS)[number]) => e.labels?.some((l) => l.label === EXHIBITION_LABEL);

const totalBySlug = new Map<string, number>();
const eventsBySlug = new Map<string, number>();
for (const e of EVENTS) {
  const slug = e.source_slug;
  if (!slug) continue;
  totalBySlug.set(slug, (totalBySlug.get(slug) ?? 0) + 1);
  if (!isExhibition(e)) eventsBySlug.set(slug, (eventsBySlug.get(slug) ?? 0) + 1);
}

interface Suspect {
  slug: string;
  kind: "museum-events" | "venue";
  detail: string;
}

const suspects: Suspect[] = [];

for (const [slug, cfg] of Object.entries(MUSEUMS)) {
  if (!cfg.eventApi || EXEMPT.has(slug)) continue;
  if ((eventsBySlug.get(slug) ?? 0) === 0) {
    const exhibitions = totalBySlug.get(slug) ?? 0;
    suspects.push({
      slug,
      kind: "museum-events",
      detail: `eventApi "${cfg.eventApi.type}" → 0 events in bundle${exhibitions ? ` (${exhibitions} exhibitions present)` : ""}. Endpoint: ${cfg.eventApi.endpoint}`,
    });
  }
}

for (const { slug } of VENUE_SCRAPERS) {
  if (EXEMPT.has(slug)) continue;
  if ((totalBySlug.get(slug) ?? 0) === 0) {
    suspects.push({ slug, kind: "venue", detail: "venue scraper → 0 entries in bundle" });
  }
}

const lines: string[] = [];
lines.push("## Scraper health audit");
lines.push("");
if (suspects.length === 0) {
  lines.push(`✅ All configured scrapers are delivering. ${EVENTS.length} events across ${totalBySlug.size} sources.`);
} else {
  lines.push(
    `⚠️ ${suspects.length} scraper(s) appear to under-deliver. Each likely points at stale markup, a moved endpoint, or a filter dropping valid events — verify against the live source before assuming the venue is simply empty.`,
  );
  lines.push("");
  lines.push("| Scraper | Kind | Finding |");
  lines.push("| --- | --- | --- |");
  for (const s of suspects) lines.push(`| \`${s.slug}\` | ${s.kind} | ${s.detail} |`);
  lines.push("");
  lines.push("### What to do");
  lines.push(
    "For each scraper above: read its parser, fetch the live endpoint, and determine whether the source actually lists upcoming events (after today) that the scraper fails to extract. If broken, fix the parser and add a brief note; if the venue is genuinely/seasonally empty, add the slug to `packages/event-hub/scripts/audit-allowlist.json` with a one-line reason instead of changing code.",
  );
  lines.push("");
  lines.push(
    "Scrapers live in `packages/scrapers/src/venues/<slug>.ts`; museum event APIs in `packages/scrapers/src/_museums/api.ts` (parser) and `config.ts` (endpoint). Verify a fix with a small bun script calling the scraper/parser against the live source.",
  );
}
const report = lines.join("\n");

console.log(report);

if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `suspects=${suspects.length}\n`);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${report}\n`);
writeFileSync(process.env.AUDIT_REPORT_PATH ?? "scraper-audit-report.md", report);
