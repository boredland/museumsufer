import type { ScrapeResult } from "../types";

export async function scrapeHolzhausenschloesschen(): Promise<ScrapeResult> {
  return { venue_slug: "holzhausenschloesschen", events: [] };
}
