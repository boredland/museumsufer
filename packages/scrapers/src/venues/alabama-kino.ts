import { decodeEntities, todayIso } from "@museumsufer/core";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";

const BASE = "https://kinotickets.express";
const CINEMA_PATH = "/hamburg-alabama";
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

function parseYearForDate(day: string, month: string): string {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-indexed

  const m = parseInt(month, 10);
  // If the event month is less than the current month, it might belong to next year
  const year = m < currentMonth - 2 ? currentYear + 1 : currentYear;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

export async function scrapeAlabamaKino(): Promise<VenueScrapeResult> {
  const res = await fetch(`${BASE}${CINEMA_PATH}`, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`alabama-kino fetch failed: ${res.status}`);
  const html = await res.text();

  // Parse movie blocks:
  // Each movie block starts with <li id="movie-\d+"
  const movieBlocks = html.split(/<li\s+id="movie-\d+"\s+class="[^"]*">/g);
  const events: CanonicalScrapedEvent[] = [];
  const today = todayIso();

  for (let i = 1; i < movieBlocks.length; i++) {
    const block = movieBlocks[i];

    // Extract title:
    const titleMatch = block.match(/class="[^"]*font-bold[^"]*text-primary"[^>]*>([^<]+)<\/div>/i);
    if (!titleMatch) continue;
    const title = decodeEntities(titleMatch[1].trim());

    // Extract poster image
    const posterMatch = block.match(/src="([^"]*assets\/poster\?[^"]+)"/i);
    const posterUrl = posterMatch ? `${BASE}${decodeEntities(posterMatch[1])}` : null;

    // Extract Laufzeit/Genre
    const durationMatch = block.match(/Laufzeit:<\/b>\s*ca\.\s*(\d+)\s*Minuten/i);
    const duration = durationMatch ? parseInt(durationMatch[1], 10) : null;

    const genreMatch = block.match(/Genre:<\/b>\s*([^<]+)<br/i);
    const genre = genreMatch ? decodeEntities(genreMatch[1].trim()) : null;

    const subtitleParts: string[] = [];
    if (genre) subtitleParts.push(genre);
    if (duration) subtitleParts.push(`${duration} min`);
    const subtitle = subtitleParts.length ? subtitleParts.join(" · ") : null;

    // Now extract all show times inside this block
    const dateBlocks = block.split(/<li\s+class="[^"]*mb-2\s+flex\s+sm:flex-col">/g);
    for (let j = 1; j < dateBlocks.length; j++) {
      const dateBlock = dateBlocks[j];

      // Find the date:
      const dateMatch = dateBlock.match(/<div\s+class="leading-4[^"]*">(\d{1,2})\.(\d{1,2})\.<\/div>/i);
      if (!dateMatch) continue;
      const dateStr = parseYearForDate(dateMatch[1], dateMatch[2]);
      if (dateStr < today) continue;

      // Find times inside this date block
      const timeRe = /<a\s+class="[^"]*"\s+href="([^"]+)"[^>]*>\s*(\d{1,2}:\d{2})\s*<\/a>/gi;
      const timeMatches = [...dateBlock.matchAll(timeRe)];

      for (const timeM of timeMatches) {
        const href = `${BASE}${decodeEntities(timeM[1])}`;
        const timeStr = timeM[2].trim();
        const bookingId = timeM[1].split("/").pop() ?? `${dateStr}|${timeStr}`;

        events.push({
          source_event_id: bookingId,
          title,
          subtitle,
          date: dateStr,
          time: timeStr,
          detail_url: `${BASE}${CINEMA_PATH}`,
          ticket_url: href,
          image_url: posterUrl,
          labels: [{ label: "film:cinema", confidence: 0.95, classifier: "scraper-hardcoded" }],
        });
      }
    }
  }

  return { source_slug: "alabama-kino", display_name: "Alabama Kino", events };
}
