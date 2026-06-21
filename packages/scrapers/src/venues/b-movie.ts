import { todayIso } from "@museumsufer/core/date";
import { decodeEntities, stripHtml } from "@museumsufer/core/html";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";

/**
 * B-Movie — St. Pauli's long-running cult / repertory cinema. Its /programm
 * page is a day-grouped table: a date header (`tm-programm-datum` "03.06.")
 * precedes the screenings for that day, each a row with a time
 * (`tm-programm-uhrzeit`), a title linking to an on-page `#info-<id>` block,
 * and a type ("Film", occasionally a talk). The date carries no year, so it's
 * inferred against today.
 */
const PROGRAMM_URL = "https://www.b-movie.de/programm/";
const UA = "museumsufer event-hub crawler / contact: jonas@bgdlabs.com";

// Walk the table in document order: a datum token sets the active date; a row
// token (time → #info anchor + title → type) is a screening on that date.
const TOKEN_RE =
  /tm-programm-datum">([^<]+)<\/span>|tm-programm-uhrzeit">([^<]*)<\/td>[\s\S]{0,400}?href="#(info-\d+)"[^>]*>([^<]+)<\/a>[\s\S]{0,200}?tm-programm-typ">([^<]*)</g;

export async function scrapeBMovie(): Promise<VenueScrapeResult> {
  const today = todayIso();
  const res = await fetch(PROGRAMM_URL, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`b-movie fetch failed: ${res.status}`);
  const html = await res.text();

  const events: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();
  let currentDate: string | null = null;

  for (const m of html.matchAll(TOKEN_RE)) {
    if (m[1]) {
      currentDate = parseDate(m[1], today);
      continue;
    }
    if (!currentDate) continue;
    const time = (m[2] ?? "").trim();
    const infoId = m[3];
    const title = stripHtml(decodeEntities(m[4])).replace(/\s+/g, " ").trim();
    const typ = stripHtml(decodeEntities(m[5] ?? "")).trim();
    if (!title || !infoId) continue;
    if (currentDate < today) continue;

    // One screening per (day, time, film); the same film recurs across days.
    const key = `${infoId}|${currentDate}|${time}`;
    if (seen.has(key)) continue;
    seen.add(key);

    events.push({
      source_event_id: key,
      title,
      description: null,
      date: currentDate,
      time: /^\d{1,2}:\d{2}$/.test(time) ? time : null,
      detail_url: `${PROGRAMM_URL}#${infoId}`,
      ticket_url: `${PROGRAMM_URL}#${infoId}`,
      image_url: null,
      // B-Movie is a cinema; treat the rare non-film slot (talk/discussion) as
      // cinema too rather than mis-routing it — its programme is film-centric.
      labels: [
        typ && /gespräch|diskussion|vortrag|lesung/i.test(typ)
          ? { label: "talk:vortrag", confidence: 0.6, classifier: "keyword:talk" }
          : { label: "film:cinema", confidence: 0.9, classifier: "scraper-hardcoded" },
      ],
    });
  }

  return { source_slug: "b-movie", display_name: "B-Movie", events };
}

/** "03.06." (no year) → ISO date, inferring the year against `today`.
 *  A month more than 6 behind today's wraps to next year (Dec→Jan rollover). */
function parseDate(raw: string, today: string): string | null {
  const m = raw.match(/(\d{1,2})\.(\d{1,2})\./);
  if (!m) return null;
  const dd = m[1].padStart(2, "0");
  const mm = m[2].padStart(2, "0");
  const curYear = parseInt(today.slice(0, 4), 10);
  const monthsBehind = Number(today.slice(5, 7)) - Number(mm);
  const year = monthsBehind > 6 ? curYear + 1 : curYear;
  return `${year}-${mm}-${dd}`;
}
