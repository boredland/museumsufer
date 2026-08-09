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

/** Fraction of audited scrapers that must come back empty before the run is
 *  treated as a pipeline-wide failure rather than a set of quiet venues.
 *  Chosen well above normal seasonal noise: the allowlist already absorbs the
 *  handful of houses that legitimately go dark. */
const MASS_FAILURE_RATIO = 0.5;

const isExhibition = (e: (typeof EVENTS)[number]) => e.labels?.some((l) => l.label === EXHIBITION_LABEL);

const totalBySlug = new Map<string, number>();
const eventsBySlug = new Map<string, number>();
// Map from config slug → set of child slugs that the eventApi fans out to
// (e.g. museum-mmk-* → {zollamt-mmk-*, tower-mmk-*} via museum_slug_override).
const childSlugsByConfig = new Map<string, Set<string>>();
for (const e of EVENTS) {
  const slug = e.source_slug;
  if (!slug) continue;
  totalBySlug.set(slug, (totalBySlug.get(slug) ?? 0) + 1);
  if (!isExhibition(e)) eventsBySlug.set(slug, (eventsBySlug.get(slug) ?? 0) + 1);
  // Detect fan-out: events whose source_event_id is prefixed with a config
  // slug but landed on a different source_slug (museum_slug_override).
  const pipeIdx = e.source_event_id?.indexOf("|") ?? -1;
  if (pipeIdx > 0) {
    const prefix = e.source_event_id.slice(0, pipeIdx);
    if (prefix !== slug) {
      let set = childSlugsByConfig.get(prefix);
      if (!set) { set = new Set(); childSlugsByConfig.set(prefix, set); }
      set.add(slug);
    }
  }
}

function eventCountIncludingChildren(slug: string): number {
  let n = eventsBySlug.get(slug) ?? 0;
  for (const child of childSlugsByConfig.get(slug) ?? []) {
    n += eventsBySlug.get(child) ?? 0;
  }
  return n;
}

interface Suspect {
  slug: string;
  kind: "museum-events" | "venue";
  detail: string;
}

const suspects: Suspect[] = [];
/** Every slug actually checked this run — the denominator for the mass-failure
 *  ratio below. Excludes allowlisted slugs so growing the allowlist can never
 *  push the ratio over the threshold on its own. */
const auditedSlugs = new Set<string>();

for (const [slug, cfg] of Object.entries(MUSEUMS)) {
  if (!cfg.eventApi || EXEMPT.has(slug)) continue;
  auditedSlugs.add(slug);
  if (eventCountIncludingChildren(slug) === 0) {
    let exhibitions = totalBySlug.get(slug) ?? 0;
    for (const child of childSlugsByConfig.get(slug) ?? []) exhibitions += totalBySlug.get(child) ?? 0;
    suspects.push({
      slug,
      kind: "museum-events",
      detail: `eventApi "${cfg.eventApi.type}" → 0 events in bundle${exhibitions ? ` (${exhibitions} exhibitions present)` : ""}. Endpoint: ${cfg.eventApi.endpoint}`,
    });
  }
}

for (const { slug } of VENUE_SCRAPERS) {
  if (EXEMPT.has(slug)) continue;
  auditedSlugs.add(slug);
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

// A handful of empty venues is normal (seasonal breaks, genuinely idle houses)
// and is handled by the Copilot hand-off. A *large* fraction going quiet at
// once is not a venue problem — it's an upstream shape change, a proxy outage,
// or a broken shared helper. Exiting 0 in that case makes the workflow report
// green precisely when the whole pipeline has stopped working, and the only
// signal, the hand-off step, depends on a PAT nothing else monitors. Fail the
// job so the run itself turns red.
const auditedCount = auditedSlugs.size;
const suspectRatio = auditedCount > 0 ? suspects.length / auditedCount : 0;
if (suspectRatio >= MASS_FAILURE_RATIO) {
  console.error(
    `\naudit: ${suspects.length}/${auditedCount} scrapers (${Math.round(suspectRatio * 100)}%) produced no events — ` +
      `at or above the ${Math.round(MASS_FAILURE_RATIO * 100)}% mass-failure threshold. ` +
      `This is far more likely a pipeline-wide break than that many venues going dark at once.`,
  );
  process.exit(1);
}
