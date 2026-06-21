import { classifyEvent, eventTypeToLabel } from "@museumsufer/classify";
import { todayIso } from "@museumsufer/core/date";
import { decodeEntities, stripHtml } from "@museumsufer/core/html";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";

/**
 * MainÄppelHaus Lohrberg — the Streuobst (orchard) centre on Frankfurt's
 * Lohrberg, with a mixed programme of concerts ("MUSIK AUF DEM LOHRBERG"),
 * children's courses, nature walks and orchard workshops.
 *
 * The Joomla site publishes its full year only as a PDF; the HTML page carries
 * just a rolling "Die nächsten Veranstaltungen" teaser (a hand-edited custom
 * module) listing the next handful of events as "<weekday>, <DD>. <Monat>" +
 * title, with no times, images or per-event links. We scrape that teaser; the
 * year is year-less so it's inferred against today. Labels come from the
 * title via the shared event classifier (the venue is genuinely mixed).
 *
 * UPGRADE PATH: this is intentionally thin (~5 rolling events). The full year
 * (~54 events, with times) lives only in the yearly PDF linked from this page
 * (`/images/dokumente/Kalender_<year>_*.pdf`). The scrape runs under Bun in CI
 * (not a Worker), so a PDF text-extraction lib (unpdf/pdfjs) is feasible — the
 * blocker is the column-dumped layout (dates/times/titles interleaved with
 * sidebar boilerplate), which makes parsing fragile, and it'd be the only
 * PDF-based scraper. Prefer switching to a structured calendar (HTML list with
 * times, an iCal feed, or a Joomla calendar plugin) if MainÄppelHaus ever
 * exposes one; otherwise the PDF is a viable-but-fragile route to full coverage.
 */
const PROGRAM_URL = "https://www.mainaeppelhauslohrberg.de/index.php/lohrberg-erleben/veranstaltungskalender.html";
const UA = "museumsufer event-hub crawler / contact: jonas@bgdlabs.com";

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
const MONTH_ALT = Object.keys(MONTHS).join("|");
const DATE_RE = new RegExp(`(\\d{1,2})\\.\\s*(${MONTH_ALT})`, "i");

export async function scrapeMainaeppelhausLohrberg(): Promise<VenueScrapeResult> {
  const today = todayIso();
  const res = await fetch(PROGRAM_URL, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`mainaeppelhaus-lohrberg fetch failed: ${res.status}`);
  const html = await res.text();

  // Isolate the "nächsten Veranstaltungen" teaser module so we don't pick up
  // dates from elsewhere on the page; it ends at the link to the yearly PDF.
  const start = Math.max(html.indexOf("mod-custom194"), html.search(/nächsten Veranstaltungen/i));
  const region = start >= 0 ? html.slice(start) : html;
  const endMarker = region.search(/komplettes\s+Kursangebot/i);
  const teaser = endMarker >= 0 ? region.slice(0, endMarker) : region;

  const events: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();

  for (const p of teaser.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)) {
    const chunk = p[1];
    const dm = DATE_RE.exec(chunk);
    if (!dm) continue;

    const date = inferDate(dm[1], MONTHS[dm[2].toLowerCase()], today);
    if (date < today) continue;

    // The title(s) follow the date's <br/>. A paragraph may list several
    // same-day items, one per <br/> line — except a line ending in ":" is a
    // prefix that continues onto the next ("MUSIK AUF DEM LOHRBERG:" + act).
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

      const type = classifyEvent(title);
      const mapped = type ? eventTypeToLabel(type) : null;

      events.push({
        source_event_id: key,
        title,
        description: null,
        date,
        time: null,
        detail_url: PROGRAM_URL,
        ticket_url: null,
        image_url: null,
        labels: mapped ? [{ label: mapped, confidence: 0.75, classifier: "keyword:event" }] : [],
      });
    }
  }

  return { source_slug: "mainaeppelhaus-lohrberg", display_name: "MainÄppelHaus Lohrberg", events };
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
