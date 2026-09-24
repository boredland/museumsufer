import { classifyMusic } from "@museumsufer/classify";
import { decodeEntities, slugify, stripHtml, todayIso } from "@museumsufer/core";
import type { CanonicalScrapedEvent, ScrapedLabel, VenueScrapeResult } from "../types";

/**
 * wuppertal-live.de / solingen-live.de / remscheid-live.de — the Bergisches
 * Städtedreieck's shared municipal event + ticketing portal (one backend, the
 * three hosts differ only in branding). It is the densest single source for
 * the three cities: Historische Stadthalle, Opernhaus, Teo Otto Theater,
 * COBRA, die börse, LOCH, Hochschule für Musik und Tanz, …
 *
 * The page loads listings over `GET /events/mode=utf8;what=rubrik;show=<id>;
 * shop=0;cal=<regions>` — one request returns every upcoming date of a
 * category, grouped under `<div class="zeitraum">Monat Jahr</div>` headers.
 * `cal` selects the portal regions; ours are wuppertal, solingen, remscheid
 * (the portal also covers Rhein-Berg, Kreis Mettmann, Ennepe-Ruhr).
 *
 * Each event is a `<div id="event<nr>">` with a weekday/month/day block,
 * `.beginn` time, `<span class="location">Venue – City</span>` and an `<h2>`
 * (performer line, then `<br />` title). We fan out one result per venue so
 * the hub attributes events to where they happen, and declare the city from
 * the location's " – City" suffix.
 */
const BASE = "https://www.wuppertal-live.de";
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const REGIONS = "wuppertal,solingen,remscheid";

/** Portal city (location suffix) → hub city slug + centroid, used as the
 *  event's coordinates. The portal exposes no per-venue geo. */
const CITIES: Record<string, { slug: string; lat: number; lon: number }> = {
  Wuppertal: { slug: "wuppertal", lat: 51.256, lon: 7.15 },
  Solingen: { slug: "solingen", lat: 51.171, lon: 7.085 },
  Remscheid: { slug: "remscheid", lat: 51.178, lon: 7.193 },
};

/** Portal category id → hub labels. Only the cultural programme the apps
 *  surface; markets, sport, wellness, tours etc. are not requested. */
const CATEGORIES: ReadonlyArray<{ id: number; labels: (title: string) => ScrapedLabel[] }> = [
  { id: 17, labels: () => [label("stage:theater")] }, // Schauspiel
  { id: 120, labels: () => [label("stage:comedy")] }, // Komödie
  { id: 14, labels: () => [label("stage:kabarett")] }, // Kabarett, Comedy
  { id: 15, labels: () => [label("stage:theater")] }, // Figurentheater
  { id: 24, labels: () => [label("stage:musical")] }, // Musical
  { id: 16, labels: () => [label("stage:opera"), label("music:classical", 0.8)] }, // Oper, Operette
  { id: 18, labels: () => [label("dance:contemporary")] }, // Tanz & Tanztheater
  { id: 23, labels: () => [label("stage:theater")] }, // Zirkus, Varieté
  { id: 9, labels: () => [label("music:classical")] }, // Klassik, Neue Musik
  { id: 97, labels: () => [label("music:classical")] }, // Chormusik
  { id: 200, labels: () => [label("music:sacred")] }, // Orgelmusik
  { id: 8, labels: () => [label("music:jazz")] }, // Jazz
  { id: 13, labels: () => [label("music:world")] }, // Weltmusik
  { id: 53, labels: (t) => [label(`music:${classifyMusic(t, null, null, "experimental")}`, 0.7)] }, // Alternative
  { id: 6, labels: () => [label("talk:lesung")] }, // Literatur, Lesung, Hörspiel
  { id: 19, labels: () => [label("talk:vortrag")] }, // Vortrag, Infotainment, Talk
  { id: 195, labels: () => [label("talk:vortrag"), label("museum:fuehrung", 0.8)] }, // Vorträge & Führungen
];

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

const EVENT_SPLIT_RE = /<div id="event(?=\d+")/;
const ZEITRAUM_RE = /<div class="zeitraum">\s*([^<]+?)\s*<\/div>/;
const DAY_RE = /<div class="monat">\s*([^<]+?)\s*<\/div>\s*<div class="tag">\s*(\d{1,2})\./;
const TIME_RE = /<div class="beginn">\s*(\d{1,2}):(\d{2})/;
const LOCATION_RE = /<span class="location">([^<]+)<\/span>/;
const HEADLINE_RE = /<h2>([\s\S]*?)<\/h2>/;
const SUBTITLE_RE = /<span id="sub\d+" class="subtitel"[^>]*>([\s\S]*?)<\/span>/;
const IMAGE_RE = /<a class="fancybox" href="([^"]+)"/;

interface Parsed {
  venue: string;
  city: (typeof CITIES)[string];
  event: CanonicalScrapedEvent;
}

export async function scrapeBergischLive(): Promise<VenueScrapeResult[]> {
  const today = todayIso();
  const byId = new Map<string, Parsed>();

  for (const cat of CATEGORIES) {
    const url = `${BASE}/events/mode=utf8;client=;what=rubrik;show=${cat.id};shop=0;cal=${REGIONS}`;
    const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" } });
    if (!res.ok) throw new Error(`bergisch-live fetch failed: ${res.status} (rubrik ${cat.id})`);
    for (const p of parseListing(await res.text(), today, cat.labels)) {
      // An event listed under two categories keeps the first; merge labels so
      // e.g. an opera also listed as Klassik carries both.
      const prev = byId.get(p.event.source_event_id);
      if (!prev) byId.set(p.event.source_event_id, p);
      else
        for (const l of p.event.labels)
          if (!prev.event.labels.some((x) => x.label === l.label)) prev.event.labels.push(l);
    }
  }

  const byVenue = new Map<string, VenueScrapeResult>();
  for (const { venue, city, event } of byId.values()) {
    const slug = `bergisch-${slugify(venue)}`;
    const result = byVenue.get(slug) ?? { source_slug: slug, display_name: venue, events: [] };
    result.events.push({ ...event, city: city.slug, lat: city.lat, lon: city.lon });
    byVenue.set(slug, result);
  }
  return [...byVenue.values()];
}

function parseListing(html: string, today: string, labelsFor: (title: string) => ScrapedLabel[]): Parsed[] {
  const out: Parsed[] = [];
  let year: string | null = null;

  for (const block of html.split(EVENT_SPLIT_RE).slice(1)) {
    const id = block.match(/^(\d+)"/)?.[1];
    const header = block.match(ZEITRAUM_RE)?.[1];
    if (header) year = header.match(/(\d{4})/)?.[1] ?? year;
    const day = block.match(DAY_RE);
    const loc = block.match(LOCATION_RE);
    const headline = block.match(HEADLINE_RE);
    if (!id || !year || !day || !loc || !headline) continue;

    const month = MONTHS[clean(day[1]).toLowerCase()];
    if (!month) continue;
    const date = `${year}-${month}-${day[2].padStart(2, "0")}`;
    if (date < today) continue;

    // "Historische Stadthalle Wuppertal – Wuppertal": the suffix is the city.
    const [venueRaw, cityRaw] = clean(loc[1]).split(/\s+–\s+(?=[^–]+$)/);
    const city = CITIES[cityRaw ?? ""];
    if (!city) continue;
    // Placeholder venues ("ort") carry no name; fall back to the city.
    const venue = venueRaw && venueRaw.toLowerCase() !== "ort" ? venueRaw : `${cityRaw} (diverse Orte)`;

    // "<performer><br />Title" — the line after the break is the programme
    // title; a single line is both.
    const lines = headline[1]
      .split(/<br\s*\/?>/i)
      .map(clean)
      .filter(Boolean);
    const title = lines.length > 1 ? lines.slice(1).join(" – ") : lines[0];
    if (!title) continue;
    const performers = lines.length > 1 ? lines[0] : null;
    const subtitle = clean(block.match(SUBTITLE_RE)?.[1] ?? "") || null;
    const t = block.match(TIME_RE);
    const image = block.match(IMAGE_RE)?.[1];

    out.push({
      venue,
      city,
      event: {
        source_event_id: id,
        title,
        subtitle,
        description: null,
        date,
        time: t ? `${t[1].padStart(2, "0")}:${t[2]}` : null,
        detail_url: `${BASE}/${id}`,
        // The per-event page is the portal's booking entry; its ticket widget
        // is JS-launched, so there's no separate shop URL to link.
        ticket_url: block.includes("ticketstatus-kaufbar") ? `${BASE}/${id}` : null,
        image_url: image ? `${BASE}${image}` : null,
        performers,
        venue_room: null,
        raw_category: null,
        labels: labelsFor(`${title} ${performers ?? ""}`),
      },
    });
  }
  return out;
}

function label(l: string, confidence = 0.9): ScrapedLabel {
  return { label: l, confidence, classifier: "upstream-category" };
}

function clean(s: string): string {
  return decodeEntities(stripHtml(s)).replace(/\s+/g, " ").trim();
}
