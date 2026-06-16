import type { ScraperContext, VenueScrapeResult } from "../types";
import { scrapeGomusMuseum } from "./_gomus-generic";

export async function scrapeMkgHamburg(ctx: ScraperContext): Promise<VenueScrapeResult[]> {
  return scrapeGomusMuseum(
    {
      slug: "mkg-hamburg",
      name: "Museum für Kunst und Gewerbe Hamburg (MK&G)",
      apiBase: "https://mkg.gomus.de/api/v4",
      ticketBase: "https://tickets.mkg-hamburg.de/de",
    },
    ctx,
  );
}
