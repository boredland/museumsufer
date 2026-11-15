import { decodeEntities, normalizeUrl, slugify, stripHtml, todayIso } from "@museumsufer/core";
import type { CanonicalScrapedEvent, ScrapedLabel, VenueScrapeResult } from "../types";
import { resolveStageLabels } from "./_stage-labels";

const BASE = "https://www.theaterhaus-frankfurt.de";
const EVENTS_URL = `${BASE}/wp-json/tribe/events/v1/events`;
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const PER_PAGE = 50;
// The calendar is a few hundred rows at most; the cap only stops a pagination loop if `next_rest_url` ever stops advancing.
const MAX_PAGES = 20;

/**
 * Theaterhaus Frankfurt moved from TYPO3 (`/spielplan/`, now 404) to WordPress
 * with The Events Calendar, which publishes the full programme at
 * `/wp-json/tribe/events/v1/events`. The ensemble that plays a night
 * (TheaterGrueneSosse, Figurentheater Eigentlich, …) is the event's organizer
 * and stays as subtitle. `start_date` is already Europe/Berlin wall-clock
 * time, so it is sliced rather than round-tripped through a `Date`.
 *
 * The API carries no sold-out / cancelled flag; those only exist on the
 * detail pages, so `availability` stays unset (unknown).
 */

interface TribeEvent {
  id: number;
  title: string;
  url: string;
  excerpt?: string;
  website?: string;
  start_date: string;
  image?: { url?: string } | false;
  venue?: { venue?: string } | [];
  organizer?: Array<{ organizer?: string }>;
}

interface TribePage {
  events?: TribeEvent[];
  next_rest_url?: string;
}

export async function scrapeTheaterhausFrankfurt(): Promise<VenueScrapeResult> {
  const today = todayIso();
  const raw: TribeEvent[] = [];
  let url: string | undefined = `${EVENTS_URL}?per_page=${PER_PAGE}&start_date=${today}`;

  for (let page = 0; url && page < MAX_PAGES; page++) {
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
    if (!res.ok) throw new Error(`theaterhaus-frankfurt fetch failed: ${res.status} ${url}`);
    const body = (await res.json()) as TribePage;
    raw.push(...(body.events ?? []));
    url = body.next_rest_url;
  }

  // A theatre with an empty calendar means the endpoint or its shape changed, not that the season ended.
  if (raw.length === 0) throw new Error("theaterhaus-frankfurt: events API returned no upcoming events");

  const events: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();

  for (const ev of raw) {
    const start = ev.start_date.match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})/);
    if (!start) continue;
    const [, date, hm] = start;
    if (date < today) continue;
    const time = hm === "00:00" ? null : hm;

    const title = stripHtml(ev.title);
    if (!title) continue;
    const groupName = stripHtml(ev.organizer?.[0]?.organizer ?? "") || null;
    const venueRoom = (!Array.isArray(ev.venue) && stripHtml(ev.venue?.venue ?? "")) || null;

    const slug = `${slugify(groupName ?? "")}-${slugify(title)}`.replace(/^-+|-+$/g, "") || slugify(title);
    const dedup = `${slug}|${date}|${time ?? ""}|${venueRoom ?? ""}`;
    if (seen.has(dedup)) continue;
    seen.add(dedup);

    const detailUrl = normalizeUrl(decodeEntities(ev.url), BASE);
    const website = ev.website ? decodeEntities(ev.website) : "";
    const imageUrl = ev.image ? (ev.image.url ?? null) : null;

    events.push({
      source_event_id: dedup,
      title,
      subtitle: groupName,
      description: stripHtml(ev.excerpt ?? "") || null,
      date,
      time,
      detail_url: detailUrl,
      ticket_url: /^https?:\/\//.test(website) ? website : detailUrl,
      image_url: imageUrl,
      venue_room: venueRoom,
      raw_category: null,
      labels: labelsFor(title, groupName),
    });
  }

  events.sort(
    (a, b) => a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? "") || a.title.localeCompare(b.title),
  );
  return { source_slug: "theaterhaus-frankfurt", display_name: "Theaterhaus Frankfurt", events };
}

/** A "für Familien" series name alone would leave only `museum:familie`, which the theater derive drops; keep the stage anchor in that case. */
function labelsFor(title: string, groupName: string | null): ScrapedLabel[] {
  const labels = resolveStageLabels({ title, subtitle: groupName, confidence: 0.85 });
  if (!labels.some((l) => /^(?:stage|music|dance|talk|event):/.test(l.label))) {
    labels.push({ label: "stage:theater", confidence: 0.85, classifier: "upstream-tag" });
  }
  return labels;
}
