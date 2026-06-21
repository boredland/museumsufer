import { todayIso } from "@museumsufer/core/date";
import { decodeEntities, stripHtml } from "@museumsufer/core/html";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";

/**
 * Sommerkino Alsterdorf — the Evangelische Stiftung Alsterdorf's barrier-free
 * open-air summer cinema at Alsterdorfer Markt (audio description + subtitles
 * for accessible screenings). The programme is a flat list on one page:
 * "14. August 2026, 21:30 Uhr: Die Schule der magischen Tiere 3". No year-less
 * dates here — the full date is spelled out, so no inference is needed.
 */
const PROGRAM_URL = "https://www.alsterdorf.de/sommerkino-barrierefrei/";
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
// "14. August 2026, 21:30 Uhr: <title>" — title runs to the next screening
// date or a trailing descriptive sentence.
const SHOW_RE = new RegExp(
  `(\\d{1,2})\\.\\s*(${MONTH_ALT})\\s*(\\d{4}),\\s*(\\d{1,2})[:.](\\d{2})\\s*Uhr:?\\s*([\\s\\S]+?)(?=\\d{1,2}\\.\\s*(?:${MONTH_ALT})\\s*\\d{4},|Nutzer\\*innen|Tickets|Filme und Zeiten|$)`,
  "gi",
);

export async function scrapeAlsterdorfSommerkino(): Promise<VenueScrapeResult> {
  const today = todayIso();
  const res = await fetch(PROGRAM_URL, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`alsterdorf-sommerkino fetch failed: ${res.status}`);
  // Drop <script>/<style> first: the page also embeds the programme as a
  // JSON blob (with \uXXXX escapes), which would otherwise yield escaped
  // duplicate titles alongside the rendered HTML copy.
  const raw = (await res.text()).replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ");
  const text = stripHtml(decodeEntities(raw)).replace(/\s+/g, " ").trim();

  const events: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();

  for (const m of text.matchAll(SHOW_RE)) {
    const dd = m[1].padStart(2, "0");
    const mm = MONTHS[m[2].toLowerCase()];
    const date = `${m[3]}-${mm}-${dd}`;
    const time = `${m[4].padStart(2, "0")}:${m[5]}`;
    if (!mm || date < today) continue;

    // Trim the title at the first descriptive break (a sentence or
    // accessibility note that trails the last list item).
    const title = m[6]
      .split(/\s+(?:Nutzer\*innen|Bei |Die Veranstaltung|Alle Filme|Der Eintritt)/)[0]
      .replace(/[.,;:\s]+$/, "")
      .trim();
    if (!title || title.length > 90) continue;

    const key = `${date}|${time}|${title}`;
    if (seen.has(key)) continue;
    seen.add(key);

    events.push({
      source_event_id: key,
      title,
      description: null,
      date,
      time,
      detail_url: PROGRAM_URL,
      ticket_url: PROGRAM_URL,
      image_url: null,
      labels: [{ label: "film:cinema", confidence: 0.9, classifier: "scraper-hardcoded" }],
    });
  }

  return { source_slug: "alsterdorf-sommerkino", display_name: "Sommerkino Alsterdorf", events };
}
