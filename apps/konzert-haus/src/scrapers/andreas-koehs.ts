import type { ScrapeResult } from "../types";

export async function scrapeAndreasKoehs(): Promise<ScrapeResult> {
  return { venue_slug: "andreas-koehs", events: [] };
}
