import type { ScrapeResult } from "../types";

export async function scrapeEnsembleModern(): Promise<ScrapeResult> {
  return { venue_slug: "ensemble-modern", events: [] };
}
