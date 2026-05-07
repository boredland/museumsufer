import { persistScrapeResult, upsertTheater } from "./db";
import { scrapeEnglishTheatre } from "./scrapers/english-theatre";
import { scrapeKomoedieFrankfurt } from "./scrapers/komoedie";
import { scrapeMousonturm } from "./scrapers/mousonturm";
import { scrapeNeuesTheaterHoechst } from "./scrapers/neues-theater-hoechst";
import { scrapeOperFrankfurt } from "./scrapers/oper";
import { scrapeSchauspielFrankfurt } from "./scrapers/schauspiel";
import { scrapeStalburg } from "./scrapers/stalburg";
import { scrapeVolksbuehne } from "./scrapers/volksbuehne";
import { THEATERS, type TheaterConfig } from "./theater-config";
import type { Env, ScrapeResult } from "./types";

export interface RunSummary {
  theater_slug: string;
  ok: boolean;
  shows: number;
  performances: number;
  error?: string;
}

export async function runAll(env: Env): Promise<RunSummary[]> {
  const out: RunSummary[] = [];
  for (const t of THEATERS) {
    out.push(await runOne(env, t.slug));
  }
  return out;
}

export async function runOne(env: Env, slug: string): Promise<RunSummary> {
  const config = THEATERS.find((t) => t.slug === slug);
  if (!config) {
    return { theater_slug: slug, ok: false, shows: 0, performances: 0, error: "unknown theater" };
  }
  try {
    const theaterId = await upsertTheater(env.DB, config);
    const result = await runScraper(config.scraper);
    const { shows, performances } = await persistScrapeResult(env.DB, theaterId, result);
    return { theater_slug: slug, ok: true, shows, performances };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Scrape failed for ${slug}:`, err);
    return { theater_slug: slug, ok: false, shows: 0, performances: 0, error: message };
  }
}

async function runScraper(name: TheaterConfig["scraper"]): Promise<ScrapeResult> {
  switch (name) {
    case "schauspiel":
      return scrapeSchauspielFrankfurt();
    case "oper":
      return scrapeOperFrankfurt();
    case "english-theatre":
      return scrapeEnglishTheatre();
    case "komoedie":
      return scrapeKomoedieFrankfurt();
    case "mousonturm":
      return scrapeMousonturm();
    case "neues-theater-hoechst":
      return scrapeNeuesTheaterHoechst();
    case "volksbuehne":
      return scrapeVolksbuehne();
    case "stalburg":
      return scrapeStalburg();
  }
}
