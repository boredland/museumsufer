import { classifyEvent, eventTypeToLabel } from "@museumsufer/classify";
import { todayIso } from "@museumsufer/core/date";
import { decodeEntities, stripHtml } from "@museumsufer/core/html";
import { PDF_EVENTS_CACHE } from "../data/pdf-events-cache";
import type { RawPdfEvent } from "../pdf-events";
import type { CanonicalScrapedEvent, ScrapedLabel, VenueScrapeResult } from "../types";

/**
 * MainÄppelHaus Lohrberg — the Streuobst (orchard) centre on Frankfurt's
 * Lohrberg, with a mixed programme of concerts ("MUSIK AUF DEM LOHRBERG"),
 * children's courses, nature walks and orchard workshops.
 *
 * The full year (~70 dated items, with times) is published only as a yearly
 * PDF. We do NOT parse it during the scrape — an LLM call is non-deterministic
 * and network-bound, so it stays out of the deterministic scrape path (see
 * AGENTS.md). Instead `scripts/refresh-pdf-cache.ts` is run by hand, has the AI
 * proxy structure the PDF's plain text, and commits the result to
 * `src/data/pdf-events-cache.ts`. This scraper reads only that committed cache —
 * which is also resilient to the brochure's yearly layout redesigns, since the
 * model works off plain text, not a fixed column geometry.
 *
 * Fallback: if there's no committed entry yet (a brand-new PDF the helper hasn't
 * processed), or once the cached programme is fully in the past, we scrape the
 * page's thin rolling "Die nächsten Veranstaltungen" teaser so the source still
 * yields something until the cache is refreshed.
 */
const PDF_TAG = "mainaeppelhaus-lohrberg";
const PROGRAM_URL = "https://www.mainaeppelhauslohrberg.de/index.php/lohrberg-erleben/veranstaltungskalender.html";
const UA = "museumsufer event-hub crawler / contact: jonas@bgdlabs.com";

export async function scrapeMainaeppelhausLohrberg(): Promise<VenueScrapeResult> {
  const today = todayIso();

  // Primary: the committed, hand-refreshed PDF extraction.
  const cached = PDF_EVENTS_CACHE[PDF_TAG];
  if (cached?.events?.length) {
    const events = cached.events
      .map((r) => toCanonical(r, today))
      .filter((e): e is CanonicalScrapedEvent => e !== null);
    if (events.length > 0) return result(events);
  }

  // Fallback: live HTML teaser (no cache yet, or cached programme all past).
  const res = await fetch(PROGRAM_URL, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`mainaeppelhaus-lohrberg fetch failed: ${res.status}`);
  return result(parseTeaser(await res.text(), today));
}

function result(events: CanonicalScrapedEvent[]): VenueScrapeResult {
  return { source_slug: PDF_TAG, display_name: "MainÄppelHaus Lohrberg", events };
}

function toCanonical(r: RawPdfEvent, today: string): CanonicalScrapedEvent | null {
  // Filter past events in-code (after the cache read) — keeps the cache
  // today-independent and the build deterministic for same-day reruns.
  if ((r.end_date ?? r.date) < today) return null;
  return {
    source_event_id: `${r.date}|${r.time ?? ""}|${r.title}`,
    title: r.title,
    description: r.description ?? null,
    date: r.date,
    time: r.time ?? null,
    end_date: r.end_date ?? null,
    end_time: r.end_time ?? null,
    detail_url: PROGRAM_URL,
    ticket_url: null,
    image_url: null,
    performers: r.performers ?? null,
    price_min: r.price_min ?? null,
    labels: labelsFor(r.title),
  };
}

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
const TEASER_DATE_RE = new RegExp(`(\\d{1,2})\\.\\s*(${Object.keys(MONTHS).join("|")})`, "i");

/** Fallback parser: the page's rolling "Die nächsten Veranstaltungen" teaser — a
 *  hand-edited module of "<weekday>, <DD>. <Monat>" + title(s), no times. */
function parseTeaser(html: string, today: string): CanonicalScrapedEvent[] {
  const start = Math.max(html.indexOf("mod-custom194"), html.search(/nächsten Veranstaltungen/i));
  const region = start >= 0 ? html.slice(start) : html;
  const endMarker = region.search(/komplettes\s+Kursangebot/i);
  const teaser = endMarker >= 0 ? region.slice(0, endMarker) : region;

  const events: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();

  for (const p of teaser.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)) {
    const chunk = p[1];
    const dm = TEASER_DATE_RE.exec(chunk);
    if (!dm) continue;
    const date = inferDate(dm[1], MONTHS[dm[2].toLowerCase()], today);
    if (date < today) continue;

    // Each <br/> line is a separate same-day item, except a trailing-colon line
    // is a prefix continuing onto the next ("MUSIK AUF DEM LOHRBERG:" + act).
    const after = chunk.slice((dm.index ?? 0) + dm[0].length);
    const brIdx = after.search(/<br\b[^>]*>/i);
    const segs = (brIdx >= 0 ? after.slice(brIdx) : after)
      .split(/<br\b[^>]*>/i)
      .map((s) => stripHtml(decodeEntities(s)).replace(/\s+/g, " ").trim())
      .filter(Boolean);

    const titles: string[] = [];
    for (let i = 0; i < segs.length; i++) {
      let s = segs[i];
      while (s.endsWith(":") && i + 1 < segs.length) s = `${s} ${segs[++i]}`;
      s = s.replace(/^[\s:–-]+|[\s:–-]+$/g, "").trim();
      if (s) titles.push(s);
    }

    for (const title of titles) {
      const key = `${date}|${title}`;
      if (seen.has(key)) continue;
      seen.add(key);
      events.push({
        source_event_id: key,
        title,
        description: null,
        date,
        time: null,
        detail_url: PROGRAM_URL,
        ticket_url: null,
        image_url: null,
        labels: labelsFor(title),
      });
    }
  }

  return events;
}

function labelsFor(title: string): ScrapedLabel[] {
  const type = classifyEvent(title);
  const mapped = type ? eventTypeToLabel(type) : null;
  return mapped ? [{ label: mapped, confidence: 0.75, classifier: "keyword:event" }] : [];
}

/** "20", "06" (no year) → ISO date, inferring the year against `today`.
 *  A month more than 6 behind today's wraps to next year (Dec→Jan rollover). */
function inferDate(dRaw: string, mm: string, today: string): string {
  const dd = dRaw.padStart(2, "0");
  const curYear = parseInt(today.slice(0, 4), 10);
  const monthsBehind = Number(today.slice(5, 7)) - Number(mm);
  const year = monthsBehind > 6 ? curYear + 1 : curYear;
  return `${year}-${mm}-${dd}`;
}
