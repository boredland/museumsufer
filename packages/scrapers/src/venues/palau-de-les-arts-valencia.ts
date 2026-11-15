import { decodeEntities, todayIso, truncate } from "@museumsufer/core";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";
import { cleanText, fetchVlc, mapPool, musicLabel, type VlcGenre } from "./_valencia-music";

const BASE = "https://www.lesarts.com";
const LAT = 39.458;
const LON = -0.3559;
const MAX_PAGES = 6;

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

/** "Per a tots" mixes talks and concerts; only these titles are concerts. */
const TITLE_GENRE: ReadonlyArray<{ re: RegExp; genre: VlcGenre }> = [
  { re: /^matins a les arts$/i, genre: "chamber" },
  { re: /^ritual of the (?:swan|sun)$/i, genre: "jazz" },
];

interface Session {
  date: string;
  time: string | null;
  room: string | null;
  price: number | null;
  ticket: string | null;
}

interface Detail {
  sessions: Session[];
  image: string | null;
  description: string | null;
}

/**
 * Palau de les Arts Reina Sofía. /programacion.html?vista=line lists the season
 * 30 rows per page (`?p=N` for the next ones). Multi-date runs are expanded into
 * one event per session from the detail page's schema.org Event blocks, which
 * also carry the room, the "from" price and the per-session Koobin link.
 */
export async function scrapePalauDeLesArtsValencia(): Promise<VenueScrapeResult> {
  const today = todayIso();
  const rows: string[] = [];
  for (let p = 0; p < MAX_PAGES; p++) {
    const html = await fetchVlc(`${BASE}/es/programacion.html?vista=line${p ? `&p=${p}` : ""}`);
    const page = html.split('<div role="listitem" aria-label="Actividad"').slice(1);
    if (page.length === 0) {
      if (p === 0) throw new Error("palau-de-les-arts: no rows in listing");
      break;
    }
    rows.push(...page);
  }

  const picked = rows.flatMap((row) => {
    const p = parseRow(row, today);
    return p ? [p] : [];
  });
  const details = await mapPool(picked, 4, (p) => fetchDetail(p.url));

  const events: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();
  picked.forEach((p, i) => {
    const d = details[i];
    for (const s of d.sessions) {
      if (s.date < today) continue;
      const key = `${p.id}-${s.date}-${s.time ?? ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      events.push({
        source_event_id: key,
        title: p.title,
        subtitle: p.subtitle,
        description: d.description,
        date: s.date,
        time: s.time,
        detail_url: p.url,
        ticket_url: s.ticket,
        image_url: d.image,
        price_min: s.price,
        language: "es",
        venue_room: s.room,
        city: "valencia",
        lat: LAT,
        lon: LON,
        raw_category: p.categories.join(" | "),
        labels: musicLabel(p.genre, 0.9),
      });
    }
  });
  events.sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? "") || a.source_event_id.localeCompare(b.source_event_id));
  return { source_slug: "palau-de-les-arts-valencia", display_name: "Palau de les Arts Reina Sofía", events };
}

function parseRow(row: string, today: string) {
  const id = row.match(/\bid_(\d+)\b/)?.[1];
  const start = row.match(/<span class="data-inici">[^<]*?(\d{2})\.(\d{2})\.(\d{2})</);
  if (!id || !start) return null;
  const end = row.match(/<span class="data-fi">[^<]*?(\d{2})\.(\d{2})\.(\d{2})</);
  const endDate = end ? `20${end[3]}-${end[2]}-${end[1]}` : `20${start[3]}-${start[2]}-${start[1]}`;
  if (endDate < today) return null;

  const name = row.match(/<span class="name">([\s\S]*?)<\/span>/)?.[1];
  const url = row.match(/<a target="_self" href="([^"]+)" title=/)?.[1];
  if (!name || !url) return null;
  const title = cleanText(name.replace(/<br\s*\/?>/gi, " "));
  const categories = [...row.matchAll(/class="h6 categoria[^>]*>([^<]*)</g)].map((m) => cleanText(m[1]));
  const genre =
    categories.map((c) => CATEGORY_GENRE[c.toLowerCase()]).find((g) => g !== undefined) ??
    TITLE_GENRE.find((t) => t.re.test(title))?.genre;
  if (!genre) return null;
  const subtitle = cleanText(row.match(/<span class="subtitol">([\s\S]*?)<\/span>/)?.[1] ?? "") || null;
  return { id, title, subtitle, categories, genre, url: decodeEntities(url) };
}

interface LdEvent {
  "@type"?: string;
  startDate?: string;
  description?: string;
  image?: string;
  location?: { name?: string };
  offers?: { url?: string; price?: number };
}

async function fetchDetail(url: string): Promise<Detail> {
  const html = await fetchVlc(url);
  const sessions: Session[] = [];
  let description: string | null = null;
  for (const m of html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
    let json: unknown;
    try {
      json = JSON.parse(m[1]);
    } catch {
      continue;
    }
    for (const n of (Array.isArray(json) ? json : [json]) as LdEvent[]) {
      const start = n?.["@type"] === "Event" ? n.startDate?.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/) : null;
      if (!start) continue;
      // startDate carries the Madrid offset, so its wall-clock digits are the local time.
      sessions.push({
        date: start[1],
        time: start[2] === "00:00" ? null : start[2],
        room: n.location?.name ? cleanText(n.location.name) : null,
        price: n.offers?.price && n.offers.price > 0 ? n.offers.price : null,
        ticket: n.offers?.url?.includes("koobin.com/es/") ? n.offers.url : null,
      });
      description ??= n.description ? truncate(cleanText(n.description), 600) : null;
    }
  }
  if (sessions.length === 0) throw new Error(`palau-de-les-arts: no Event JSON-LD on ${url}`);
  const og = html.match(/property="og:image" content="([^"]+)"/)?.[1];
  return { sessions, image: og ? decodeEntities(og).replace(/\?.*$/, "") : null, description };
}
