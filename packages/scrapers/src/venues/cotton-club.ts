import { classifyMusic } from "@museumsufer/classify";
import { todayIso } from "@museumsufer/core/date";
import { decodeEntities, stripHtml } from "@museumsufer/core/html";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";
import { parseIcal } from "./_ical";

/**
 * Cotton Club — Hamburg's traditional/New-Orleans jazz club (since 1959). Its
 * whole programme is concerts, exposed cleanly via the Events Manager iCal feed
 * (`?ical=1`): SUMMARY, DTSTART, URL, image, and jazz-subgenre CATEGORIES
 * (Swing, Blues, Vocal Jazz, …). Everything maps to music:jazz (Latin/Afro
 * sets refined to world).
 *
 * The club also presents the occasional concert at out-of-town venues ("… im
 * Duisburger Hof"); those carry no LOCATION, so they're dropped by a title
 * city-guard to avoid mis-placing them in Hamburg.
 */
const ICAL_URL = "https://cotton-club.de/?ical=1";
const UA = "museumsufer event-hub crawler / contact: jonas@bgdlabs.com";

// Match the city stem as a prefix so inflected venue names ("Duisburger Hof",
// "Kölner …") are caught too.
const OUT_OF_TOWN_RE = /\b(?:duisburg|düsseldorf|duesseldorf|köln|koeln|bremen|hannover|kiel|lübeck|luebeck)/i;

export async function scrapeCottonClub(): Promise<VenueScrapeResult> {
  const today = todayIso();
  const res = await fetch(ICAL_URL, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`cotton-club fetch failed: ${res.status}`);
  const ical = await res.text();

  const events: CanonicalScrapedEvent[] = [];
  for (const ev of parseIcal(ical)) {
    if (ev.date < today) continue;
    const title = stripHtml(decodeEntities(ev.summary)).replace(/\s+/g, " ").trim();
    if (!title || OUT_OF_TOWN_RE.test(title)) continue;

    // Jazz club: default jazz, but let the classifier pull Latin/Afro/world out
    // of the title + iCal subgenre categories.
    const hint = `${title} ${ev.categories.join(" ")}`;
    const genre = classifyMusic(hint, null, ev.description, "jazz");

    events.push({
      source_event_id: ev.uid ?? `${title}|${ev.date}`,
      title,
      description: ev.description ? stripHtml(decodeEntities(ev.description)).replace(/\s+/g, " ").trim() : null,
      date: ev.date,
      time: ev.time,
      end_time: ev.endTime,
      detail_url: ev.url,
      ticket_url: ev.url,
      image_url: ev.image,
      labels: [{ label: `music:${genre}`, confidence: 0.85, classifier: "keyword:music" }],
    });
  }

  return { source_slug: "cotton-club", display_name: "Cotton Club", events };
}
