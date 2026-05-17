/**
 * Display names for hub `source_slug`s. The map itself is auto-generated
 * by `scripts/scrape.ts` from each venue scraper's `display_name` field
 * and committed to `data/venue-names.ts` so apps can import it without
 * running the scrape. Apps look up venue labels via
 * `displayNameFor(slug)`; a missing entry falls back to a titleized slug
 * so brand-new venues stay usable until their scraper sets a name.
 */
export { VENUE_NAMES } from "../data/venue-names";

import { VENUE_NAMES } from "../data/venue-names";

/** Look up a venue's display name. Falls back to a titleized slug when
 *  no curated entry exists, so brand-new venues remain usable. */
export function displayNameFor(slug: string): string {
  return VENUE_NAMES[slug] ?? titleize(slug);
}

function titleize(slug: string): string {
  return slug
    .split("-")
    .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}
