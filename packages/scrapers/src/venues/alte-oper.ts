import { classifyMusic, classifyTalk, type MusicGenre } from "@museumsufer/classify";
import { dateOffset, decodeEntities, stripHtml, todayIso, truncate } from "@museumsufer/core";
import type { CanonicalScrapedEvent, ScrapedLabel, VenueScrapeResult } from "../types";

const BASE = "https://www.alteoper.de";
const API = `${BASE}/de/api/events/`;
const UA = "museumsufer event-hub crawler / contact: jonas@bgdlabs.com";
const MAX_PAGES = 25;

interface AofEvent {
  id: number;
  slug: string;
  room: string | null;
  start_date: string;
  end_date: string | null;
  headline: string;
  subtitle: string;
  introduction: string;
  organizer: string;
  title: string;
  ticket_link: string;
  image: { url?: string } | null;
  thumbs: { large?: string; medium?: string; small?: string } | null;
  ticket_status: string;
  single_price: boolean | number;
  lowest_price: number | null;
  is_past: boolean;
  genres: Array<{ name: string }>;
  event_types: Array<{ name: string }>;
}

interface AofResponse {
  count: number;
  next: string | null;
  results: AofEvent[];
}

/** Genres that mark a performance as a concert; "Entertainment" alone does not (it also covers cabaret and shows). */
const MUSIC_GENRES = [
  "Klassik",
  "Orchester",
  "Klavier",
  "Kammermusik",
  "Alte Musik",
  "Vokal",
  "Neue Musik",
  "Jazz",
  "Rock, Pop, Singer Songwriter",
  "Weltmusik",
  "Film & Musik",
];

/**
 * The venue's own `genres` / `event_types` decide the namespace: the hall
 * books readings, cabaret, tours and congresses next to concerts, so a blanket
 * `music:*` mislabels them. The keyword genre only refines events the venue
 * itself files as music.
 */
function resolveLabels(
  title: string,
  subtitle: string | null,
  headline: string | null,
  genres: readonly string[],
  eventTypes: readonly string[],
): ScrapedLabel[] {
  const upstream = (label: string, confidence = 0.9): ScrapedLabel => ({
    label,
    confidence,
    classifier: "upstream-category",
  });

  if (genres.includes("Kongresse & Events")) return [upstream("event:venue", 0.5)];
  // A tour is not a concert, but a Gesprächskonzert is filed as one even when it is also tagged Führung.
  if (eventTypes.includes("Führung") && !eventTypes.includes("Gesprächskonzert")) {
    return [upstream("event:venue", 0.5)];
  }
  if (genres.includes("Lesung")) return [upstream(`talk:${classifyTalk(title, subtitle).toLowerCase()}`)];

  const hasMusicGenre = genres.some((g) => MUSIC_GENRES.includes(g));
  if (genres.includes("Kabarett & Comedy")) {
    const cabaret = upstream("stage:kabarett");
    return hasMusicGenre ? [cabaret, musicLabel(title, subtitle, headline, genres)] : [cabaret];
  }
  // The venue files a gospel concert under "Shows & Musicals"; sacred repertoire is still a concert.
  if (
    genres.includes("Shows & Musicals") &&
    !genres.includes("Klassik") &&
    classifyMusic(title, subtitle, headline, "classical") !== "sacred"
  ) {
    return [upstream("stage:musical")];
  }

  return [musicLabel(title, subtitle, headline, genres)];
}

function musicLabel(
  title: string,
  subtitle: string | null,
  headline: string | null,
  genres: readonly string[],
): ScrapedLabel {
  // Venue genre first: keyword needles read "Leonkoro Quartett" or "Rock the Ballet" as jazz.
  const fromGenre: MusicGenre | null = genres.includes("Jazz")
    ? "jazz"
    : genres.includes("Kammermusik")
      ? "chamber"
      : genres.includes("Neue Musik")
        ? "experimental"
        : genres.includes("Weltmusik")
          ? "world"
          : null;
  if (fromGenre) return { label: `music:${fromGenre}`, confidence: 0.9, classifier: "upstream-category" };
  return {
    label: `music:${classifyMusic(title, subtitle, headline, "classical")}`,
    confidence: 0.9,
    classifier: "scraper-hardcoded",
  };
}

/**
 * Alte Oper publishes the entire programme through a paginated JSON endpoint
 * keyed off `from_date`.
 */
export async function scrapeAlteOper(): Promise<VenueScrapeResult> {
  const today = todayIso();
  const horizon = dateOffset(120);
  const events: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();
  let url: string | null = `${API}?from_date=${today}`;
  let pages = 0;

  while (url && pages < MAX_PAGES) {
    const res: Response = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`alte-oper fetch failed: ${url} → ${res.status}`);
    const data: AofResponse = (await res.json()) as AofResponse;
    let pastHorizon = false;
    for (const raw of data.results ?? []) {
      if (raw.is_past) continue;
      const date = raw.start_date.slice(0, 10);
      if (date < today) continue;
      if (date > horizon) {
        pastHorizon = true;
        continue;
      }
      const time = raw.start_date.slice(11, 16);
      const endTime = raw.end_date?.slice(11, 16) ?? null;

      const title = stripHtml(decodeEntities(raw.title)).trim();
      const subtitle = raw.subtitle ? stripHtml(decodeEntities(raw.subtitle)).trim() : null;
      const headline = raw.headline ? stripHtml(decodeEntities(raw.headline)).trim() : null;
      const description = raw.introduction ? truncate(stripHtml(decodeEntities(raw.introduction)), 800) : null;
      const performers = raw.organizer ? stripHtml(decodeEntities(raw.organizer)).trim() : null;
      const room = raw.room ? stripHtml(decodeEntities(raw.room)).trim() : null;

      const imageUrl = raw.thumbs?.large || raw.thumbs?.medium || raw.thumbs?.small || raw.image?.url || null;
      const detailUrl = `${BASE}/de/programm/${raw.slug}/${raw.id}`;

      const finalSubtitle = subtitle || headline || null;
      const priceMin = raw.lowest_price != null ? Number(raw.lowest_price) : null;

      const dedup = `${raw.slug}|${date}|${time}|${room ?? ""}`;
      if (seen.has(dedup)) continue;
      seen.add(dedup);

      if (!Array.isArray(raw.genres) || !Array.isArray(raw.event_types)) {
        throw new Error(`alte-oper: event ${raw.id} lacks genres/event_types — API changed`);
      }

      events.push({
        source_event_id: dedup,
        title,
        subtitle: finalSubtitle,
        description,
        date,
        time: time === "00:00" ? null : time,
        end_time: endTime && endTime !== "00:00" && endTime !== time ? endTime : null,
        detail_url: detailUrl,
        ticket_url: raw.ticket_link || null,
        image_url: imageUrl ? absoluteUrl(imageUrl) : null,
        price_min: priceMin,
        price_max: null,
        performers,
        venue_room: room || null,
        labels: resolveLabels(
          title,
          finalSubtitle,
          headline,
          raw.genres.map((g) => g.name),
          raw.event_types.map((t) => t.name),
        ),
      });
    }
    if (pastHorizon) break;
    url = data.next;
    pages++;
    if (url) await sleep(200);
  }

  return { source_slug: "alte-oper", display_name: "Alte Oper Frankfurt", events };
}

function absoluteUrl(path: string): string {
  if (path.startsWith("http")) return path;
  if (path.startsWith("/")) return `${BASE}${path}`;
  return `${BASE}/${path}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
