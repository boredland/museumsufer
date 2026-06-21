import { todayIso } from "@museumsufer/core/date";
import { decodeEntities, stripHtml } from "@museumsufer/core/html";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";

/**
 * Zeise Open Air — the Zeise Kinos' summer rooftop open-air programme
 * (Ottensen). Distinct from the indoor Zeise programme already covered via
 * Cineamo (`zeise-kinos`), so it gets its own source slug. The /openairprogramm
 * page (Drupal) groups screenings by day: a `view-grouping-header`
 * ("Mittwoch, 1.7.", year-less) precedes `tagesprogramm` blocks, each a
 * screening with a start time, a `/film/<id>` title link, a `/show/<id>/booking`
 * ticket link and a cdn.zeise.de poster.
 */
const PROGRAM_URL = "https://www.zeise.de/openairprogramm";
const SITE_BASE = "https://www.zeise.de";
const UA = "museumsufer event-hub crawler / contact: jonas@bgdlabs.com";

const HEADER_RE = /view-grouping-header[^>]*>\s*\w+,\s*(\d{1,2})\.(\d{1,2})\./g;

export async function scrapeZeiseOpenAir(): Promise<VenueScrapeResult> {
  const today = todayIso();
  const res = await fetch(PROGRAM_URL, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`zeise-open-air fetch failed: ${res.status}`);
  const html = await res.text();

  // Day headers carry the (year-less) date; each tagesprogramm block belongs
  // to the most recent preceding header.
  const headers = [...html.matchAll(HEADER_RE)].map((m) => ({
    index: m.index ?? 0,
    date: inferDate(m[1], m[2], today),
  }));
  const blockStarts = [...html.matchAll(/tagesprogramm detailed/g)].map((m) => m.index ?? 0);

  const events: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < blockStarts.length; i++) {
    const start = blockStarts[i];
    const block = html.slice(start, blockStarts[i + 1] ?? start + 2000);
    const date = headers.filter((h) => h.index < start).at(-1)?.date;
    if (!date || date < today) continue;

    // Each block has two /film/<id> links: one wraps the poster <img> (empty
    // text), the other the title. Take the first with real text.
    let title = "";
    let filmId = "";
    for (const fl of block.matchAll(/\/film\/(\d+)"[^>]*>([\s\S]*?)<\/a>/g)) {
      const t = stripHtml(decodeEntities(fl[2])).replace(/\s+/g, " ").trim();
      if (t) {
        title = t;
        filmId = fl[1];
        break;
      }
    }
    if (!title || !filmId) continue;
    const timeM = /(\d{1,2}):(\d{2})/.exec(block);
    const time = timeM ? `${timeM[1].padStart(2, "0")}:${timeM[2]}` : null;
    const showId = /\/show\/(\d+)\/booking/.exec(block)?.[1];
    const image = /(https:\/\/cdn\.zeise\.de\/image\/[^"]+\.jpg)/.exec(block)?.[1] ?? null;

    const key = `${filmId}|${date}|${time ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);

    events.push({
      source_event_id: key,
      title,
      description: null,
      date,
      time,
      detail_url: `${SITE_BASE}/film/${filmId}`,
      ticket_url: showId ? `${SITE_BASE}/show/${showId}/booking` : `${SITE_BASE}/film/${filmId}`,
      image_url: image,
      labels: [{ label: "film:cinema", confidence: 0.9, classifier: "scraper-hardcoded" }],
    });
  }

  return { source_slug: "zeise-open-air", display_name: "Zeise Open Air", events };
}

/** "1", "7" (no year) → ISO date, inferring the year against `today`.
 *  A month more than 6 behind today's wraps to next year (Dec→Jan rollover). */
function inferDate(dRaw: string, mRaw: string, today: string): string {
  const dd = dRaw.padStart(2, "0");
  const mm = mRaw.padStart(2, "0");
  const curYear = parseInt(today.slice(0, 4), 10);
  const monthsBehind = Number(today.slice(5, 7)) - Number(mm);
  const year = monthsBehind > 6 ? curYear + 1 : curYear;
  return `${year}-${mm}-${dd}`;
}
