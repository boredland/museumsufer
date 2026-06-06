import { todayIso } from "@museumsufer/core/date";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";

const BASE = "https://db.nipponconnection.com";
const WEBSITE = "https://nipponconnection.com";
const UA = "Mozilla/5.0 (compatible; Museumsufer/1.0)";
const FESTIVAL_YEAR = new Date().getFullYear();

const VEVENT_RE = /BEGIN:VEVENT([\s\S]*?)END:VEVENT/g;

/**
 * Nippon Connection — Frankfurt's annual Japanese film festival. Its public
 * database (db.nipponconnection.com) renders a `timeboard` schedule that embeds
 * an iCal VEVENT for every screening (an `<a href="data:text/calendar,…">` per
 * entry), percent-encoded with `%0A` line breaks. Each VEVENT carries the
 * Latin SUMMARY title, the Berlin DTSTART, the LOCATION (which is often a
 * partner cinema — naxos, Mal Seh'n, Eldorado, DFF — not the festival's own
 * Mousonturm), and a DESCRIPTION with the director + runtime.
 *
 * Parsing the timeboard gives the complete catalogue with venues, which the
 * hub uses to cross-tag the same screenings scraped from the partner cinemas
 * with a `film:reihe:Nippon Connection` label. The dedup pass then drops these
 * aggregator copies wherever a partner cinema already lists the screening.
 */
export async function scrapeNipponConnection(): Promise<VenueScrapeResult> {
  const today = todayIso();
  const res = await fetch(`${BASE}/de/${FESTIVAL_YEAR}/event/timeboard`, { headers: { "User-Agent": UA } });
  if (!res.ok) {
    // Festival is annual; if this year's board is missing fall back to next year.
    const fallback = await fetch(`${BASE}/de/${FESTIVAL_YEAR + 1}/event/timeboard`, { headers: { "User-Agent": UA } });
    if (!fallback.ok) throw new Error(`nippon-connection fetch failed: ${res.status} / ${fallback.status}`);
    return parseTimeboard(await fallback.text(), today, FESTIVAL_YEAR + 1);
  }
  return parseTimeboard(await res.text(), today, FESTIVAL_YEAR);
}

function parseTimeboard(html: string, today: string, year: number): VenueScrapeResult {
  const events: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();

  for (const m of html.matchAll(VEVENT_RE)) {
    const block = m[1].replace(/%0A/g, "\n");

    const dt = block.match(/DTSTART[^:\n]*:(\d{8})T(\d{6})/);
    if (!dt) continue;
    const date = `${dt[1].slice(0, 4)}-${dt[1].slice(4, 6)}-${dt[1].slice(6, 8)}`;
    if (date < today) continue;
    const time = `${dt[2].slice(0, 2)}:${dt[2].slice(2, 4)}`;

    const title = field(block, "SUMMARY");
    if (!title) continue;

    // The DESCRIPTION holds "Director: …\nCountry YEAR, NN min., version\nURL"
    // with literal `\n` / `\t` escapes. Films lead with a director credit;
    // workshops, tastings, openings, talks and parties don't — skip those (a
    // runtime alone isn't enough, since workshops list "approx. 90 minutes").
    const description = field(block, "DESCRIPTION") ?? "";
    if (!/\b(?:Director|Regie):/i.test(description)) continue;
    const descLines = description
      .replace(/\\[nt]/g, "\n")
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("http"));
    const director = descLines[0]?.replace(/^(?:Director|Regie):\s*/i, "").trim() || null;
    const meta = descLines[1] || null; // "Japan 2026, 99 min., japan. und franz. OmeU"

    const location = field(block, "LOCATION");
    const uid = field(block, "UID");
    const sourceId = uid || `${date}-${time.replace(":", "")}-${kebab(title)}`;
    if (seen.has(sourceId)) continue;
    seen.add(sourceId);

    const subtitleParts = [director ? `R: ${director}` : null, meta].filter(Boolean);

    events.push({
      source_event_id: sourceId,
      title,
      subtitle: subtitleParts.length ? subtitleParts.join(" · ") : null,
      description: null,
      date,
      time,
      detail_url: `${WEBSITE}/de/${year}/program/`,
      venue_room: location || null,
      performers: director,
      labels: [
        { label: "film:cinema", confidence: 0.95, classifier: "scraper-hardcoded" },
        { label: "film:reihe:Nippon Connection", confidence: 0.95, classifier: "scraper-hardcoded" },
      ],
    });
  }

  return { source_slug: "nippon-connection", display_name: "Nippon Connection", events };
}

/** Read a single iCal property value (the text after `KEY:` or `KEY;params:`
 *  up to the line break). */
function field(block: string, key: string): string | null {
  const m = block.match(new RegExp(`(?:^|\\n)${key}[^:\\n]*:(.*)`));
  return m ? m[1].trim() || null : null;
}

function kebab(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
