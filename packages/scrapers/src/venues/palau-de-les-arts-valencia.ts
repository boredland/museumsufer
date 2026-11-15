import { decodeEntities, todayIso } from "@museumsufer/core";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";
import { cleanText, fetchVlc, musicLabel, type VlcGenre } from "./_valencia-music";

const BASE = "https://www.lesarts.com";
const LAT = 39.4580;
const LON = -0.3559;

/** Upstream category (lowercased) → genre. Categories not listed (education,
 *  dance, family, "Per a tots" talks, performances in Madrid) are not concerts. */
const CATEGORY_GENRE: Record<string, VlcGenre> = {
  ópera: "classical",
  "grans veus": "classical",
  simfònic: "classical",
  "barroc i música antiga": "classical",
  bandes: "classical",
  lied: "chamber",
  flamenco: "world",
  "músiques valencianes": "world",
  ensems: "experimental",
};

/**
 * Palau de les Arts Reina Sofía. /programacion.html?vista=line renders the
 * season as `role="listitem"` rows: "DO 22.11.26 | 19:00 h", title, category,
 * room and a Koobin ticket link. Multi-date runs ("Del JU 10.12.26 al MA
 * 22.12.26") are one event with an end date.
 */
export async function scrapePalauDeLesArtsValencia(): Promise<VenueScrapeResult> {
  const today = todayIso();
  const html = await fetchVlc(`${BASE}/es/programacion.html?vista=line`);
  const events: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();

  for (const row of html.split('<div role="listitem" aria-label="Actividad"').slice(1)) {
    const ev = parseRow(row, today);
    if (!ev || seen.has(ev.source_event_id)) continue;
    seen.add(ev.source_event_id);
    events.push(ev);
  }
  events.sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? ""));
  return { source_slug: "palau-de-les-arts-valencia", display_name: "Palau de les Arts Reina Sofía", events };
}

function parseRow(row: string, today: string): CanonicalScrapedEvent | null {
  const id = row.match(/\bid_(\d+)\b/)?.[1];
  const start = row.match(/<span class="data-inici">[^<]*?(\d{2})\.(\d{2})\.(\d{2})</);
  if (!id || !start) return null;
  const end = row.match(/<span class="data-fi">[^<]*?(\d{2})\.(\d{2})\.(\d{2})</);
  const date = `20${start[3]}-${start[2]}-${start[1]}`;
  const endDate = end ? `20${end[3]}-${end[2]}-${end[1]}` : null;
  if ((endDate ?? date) < today) return null;

  const categories = [...row.matchAll(/class="h6 categoria[^>]*>([^<]*)</g)].map((m) => cleanText(m[1]));
  const genre = categories.map((c) => CATEGORY_GENRE[c.toLowerCase()]).find((g) => g !== undefined);
  if (!genre) return null;

  const name = row.match(/<span class="name">([\s\S]*?)<\/span>/)?.[1];
  if (!name) return null;
  const title = cleanText(name);
  const subtitle = cleanText(row.match(/<span class="subtitol">([\s\S]*?)<\/span>/)?.[1] ?? "") || null;
  const time = row.match(/class='hora'>\s*(\d{1,2}):(\d{2})/);
  const room = cleanText(row.match(/aria-label="Espacios">([\s\S]*?)<\/div>/)?.[1] ?? "") || null;
  const detail = row.match(/<a target="_self" href="([^"]+)" title=/)?.[1];
  const buy = row.match(/class="button comprar[^>]*href="([^"]+)"/)?.[1];

  return {
    source_event_id: `${id}-${date}`,
    title,
    subtitle,
    date,
    end_date: endDate && endDate !== date ? endDate : null,
    time: time ? `${time[1].padStart(2, "0")}:${time[2]}` : null,
    detail_url: detail ? decodeEntities(detail) : `${BASE}/es/programacion.html`,
    ticket_url: buy ? decodeEntities(buy) : null,
    language: "es",
    venue_room: room,
    city: "valencia",
    lat: LAT,
    lon: LON,
    raw_category: categories.join(" | "),
    labels: musicLabel(genre, 0.9),
  };
}
