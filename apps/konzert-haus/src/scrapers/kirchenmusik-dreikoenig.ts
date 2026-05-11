import type { ScrapeResult } from "../types";

export async function scrapeKirchenmusikDreikoenig(): Promise<ScrapeResult> {
  return { venue_slug: "kirchenmusik-dreikoenig", events: [] };
}
