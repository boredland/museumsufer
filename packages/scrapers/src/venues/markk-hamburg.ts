import { decodeEntities, slugify, stripHtml, todayIso } from "@museumsufer/core";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";

/**
 * MARKK — Museum am Rothenbaum, Kulturen und Künste der Welt (ethnographic
 * museum, Rothenbaumchaussee). The `/ausstellungen/` archive server-renders
 * three sections — Sonderausstellungen, Dauerausstellungen, Rückblick. We take
 * the current ones (everything before "Rückblick") and emit those with a
 * future end date as `museum:ausstellung`, matching the Hamburger Kunsthalle
 * scraper. The Veranstaltungen calendar is a separate JS widget — out of scope.
 */
const BASE = "https://markk-hamburg.de";
const AUSSTELLUNGEN_URL = `${BASE}/ausstellungen/`;
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

const MONTHS: Record<string, string> = {
  januar: "01",
  februar: "02",
  märz: "03",
  april: "04",
  mai: "05",
  juni: "06",
  juli: "07",
  august: "08",
  september: "09",
  oktober: "10",
  november: "11",
  dezember: "12",
};

export async function scrapeMarkkHamburg(): Promise<VenueScrapeResult> {
  const res = await fetch(AUSSTELLUNGEN_URL, {
    headers: { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" },
  });
  if (!res.ok) throw new Error(`MARKK fetch failed: ${res.status}`);
  const html = await res.text();
  const today = todayIso();

  // Drop the "Rückblick" (past) section; keep Sonder- + Dauerausstellungen.
  const current = html.split(/<span class="marker">Rückblick<\/span>/)[0];

  const events: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();

  for (const m of current.matchAll(/<article\b[^>]*>([\s\S]*?)<\/article>/g)) {
    const block = m[1];
    const link = block.match(
      /<a href="(https:\/\/markk-hamburg\.de\/ausstellungen\/[^"]+)"\s+title="([^"]*?)\s*–\s*Beitrag lesen"/,
    );
    if (!link) continue;

    const detailUrl = decodeEntities(link[1]);
    const title = stripHtml(decodeEntities(link[2])).replace(/\s+/g, " ").trim();
    if (!title) continue;

    const slug = detailUrl.match(/\/ausstellungen\/([^/]+)\//)?.[1] ?? slugify(title);
    const sourceEventId = `markk|exhibition|${slug}`;
    if (seen.has(sourceEventId)) continue;
    seen.add(sourceEventId);

    const dateRaw = stripHtml(block.match(/<time[^>]*ausstellungdate[^>]*>([\s\S]*?)<\/time>/)?.[1] ?? "").trim();
    const { start, end } = parseDateRange(dateRaw);
    // Mirror the Kunsthalle rule: only scrape exhibitions with a real end date.
    if (!end || end < today) continue;

    const imageUrl = block.match(/<img[^>]*\bsrc="([^"]+)"/)?.[1] ?? null;

    events.push({
      source_event_id: sourceEventId,
      title,
      subtitle: null,
      description: null,
      date: start ?? today,
      end_date: end,
      time: null,
      end_time: null,
      detail_url: detailUrl,
      image_url: imageUrl ? decodeEntities(imageUrl) : null,
      labels: [{ label: "museum:ausstellung", confidence: 0.95, classifier: "scraper-hardcoded" }],
    });
  }

  return { source_slug: "markk", display_name: "MARKK – Museum am Rothenbaum", events };
}

/** Parse German ranges: "5. Juni 2026 – 27. Juni 2027" and the short
 *  "3. Juli – 15. November 2020" (start inherits the end year). */
function parseDateRange(raw: string): { start: string | null; end: string | null } {
  const full = raw.match(/(\d{1,2})\.\s*([A-Za-zä]+)\s+(\d{4})\s*[–-]\s*(\d{1,2})\.\s*([A-Za-zä]+)\s+(\d{4})/);
  if (full) {
    return { start: iso(full[1], full[2], full[3]), end: iso(full[4], full[5], full[6]) };
  }
  const short = raw.match(/(\d{1,2})\.\s*([A-Za-zä]+)\s*[–-]\s*(\d{1,2})\.\s*([A-Za-zä]+)\s+(\d{4})/);
  if (short) {
    return { start: iso(short[1], short[2], short[5]), end: iso(short[3], short[4], short[5]) };
  }
  return { start: null, end: null };
}

function iso(day: string, monthName: string, year: string): string | null {
  const month = MONTHS[monthName.toLowerCase()];
  return month ? `${year}-${month}-${day.padStart(2, "0")}` : null;
}
