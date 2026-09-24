import { classifyEvent, classifyMusic } from "@museumsufer/classify";
import { decodeEntities, slugify, stripHtml, todayIso } from "@museumsufer/core";
import type { CanonicalScrapedEvent, ScrapedLabel, VenueScrapeResult } from "../types";
import { VENUE_COORDS } from "../venue-coords";
import { labelsForEvent } from "./_gomus-generic";

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
 *
 * The film category's response additionally carries each cinema's current
 * week (`<div id="detailfilm<kino>">`: film titles with per-day showtimes),
 * which is the only published source for COBRA's regular programme.
 *
 * Exhibitions are `datum-ausstellungen` rows with a yearless "DD.MM. –
 * DD.MM." run instead of a day; we read them only for MUSEUM_VENUES.
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

/** Portal venues another scraper already owns (Kinoheld's cinemas, the
 *  CineStar API). Their portal events join that slug so the cinema app shows
 *  one house rather than a second `bergisch-*` copy, and take its venue
 *  coordinates. The name must equal the owning scraper's: both write the
 *  hub's venue-names map, and which write lands last is not deterministic. */
const OWNED_VENUES: Record<string, { slug: string; name: string }> = {
  "Rex Filmtheater Wuppertal|Wuppertal": { slug: "rex-filmtheater-wuppertal", name: "Rex Filmtheater Wuppertal" },
  "Cinema|Wuppertal": { slug: "cinema-wuppertal", name: "Cinema Wuppertal" },
  "Das Lumen Filmtheater|Solingen": { slug: "das-lumen-filmtheater-solingen", name: "Das Lumen Filmtheater Solingen" },
  "Cinestar Remscheid|Remscheid": { slug: "cinestar-remscheid", name: "CineStar Remscheid" },
  "Von der Heydt-Museum|Wuppertal": { slug: "von-der-heydt-museum", name: "Von der Heydt-Museum" },
};

/** Portal venues the museum app lists (apps/museumsufer museum-config.ts,
 *  keyed by the hub slug these resolve to). Their events gain a `museum:*`
 *  label so the museum app picks them up, and the art category — otherwise
 *  galleries, banks and libraries — is read for them alone. */
const MUSEUM_VENUES = new Set([
  "Von der Heydt-Museum|Wuppertal",
  "Skulpturenpark Waldfrieden|Wuppertal",
  "Museum für Frühindustrialisierung|Wuppertal",
  "Engels-Haus|Wuppertal",
  "Begegnungsstätte Alte Synagoge|Wuppertal",
  "Kunstmuseum Solingen|Solingen",
  "Zentrum für verfolgte Künste|Solingen",
  "Deutsches Klingenmuseum|Solingen",
  "LVR-Industriemuseum Solingen Gesenkschmiede Hendrichs|Solingen",
]);

/** Cinemas whose weekly programme we take from the portal, by portal kino id.
 *  The others it lists come from Kinoheld or the CineStar API, are mainstream
 *  multiplexes (CinemaxX) or lie outside our cities (Kinocenter Schwelm). */
const PROGRAMME_CINEMAS: Record<string, { venue: string; city: string; url: string }> = {
  "671": { venue: "Cobra", city: "Solingen", url: "https://cobra-solingen.de/kino/" },
};

const FILM_CATEGORY = 69;

/** Portal category id → hub labels. Only the cultural programme the apps
 *  surface; markets, sport, wellness, tours etc. are not requested. `drop`
 *  rejects listings a category carries that are not that kind of event;
 *  `museumsOnly` keeps just MUSEUM_VENUES, and reads their exhibitions. */
const CATEGORIES: ReadonlyArray<{
  id: number;
  labels: (title: string) => ScrapedLabel[];
  drop?: RegExp;
  museumsOnly?: true;
}> = [
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
  // Film: screenings, film clubs, live broadcasts — plus venue opening-hours
  // notices ("Museum geöffnet") and "t.b.a." film-club placeholders, which
  // name no film to show.
  { id: FILM_CATEGORY, labels: () => [label("film:cinema")], drop: /\bgeöffnet\b|^t\.?\s?b\.?\s?a\b/i },
  // Ausstellung, Performance, Kunst: the museum label is added per venue.
  { id: 3, labels: () => [], museumsOnly: true },
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
const RUN_RE = /<div class="datum-ausstellungen">\s*(\d{2})\.(\d{2})\.\s*&ndash;\s*(?:<br>\s*)?(\d{2})\.(\d{2})\./;

const PROGRAMME_SPLIT_RE = /<div id="detailfilm(?=\d+")/;
/** "Woche 24.09.– 30.09.26": the week's start day/month and end date. */
const WEEK_RE = /<h3>Woche\s*(\d{2})\.(\d{2})\.[^<]*?(\d{2})\.(\d{2})\.(\d{2})\s*<\/h3>/g;
const FILM_SPLIT_RE = /<b id="flink\d+_\d+_(?=\d+")/;
/** One day row: ", 26.09:</span> 16:15 | 20:30" (the colon sometimes sits
 *  after the closing span). */
const SHOW_DAY_RE = /,\s*(\d{2})\.(\d{2}):?<\/span>:?(?:<\/span>)?\s*([\d:|\s]+)/g;

interface Parsed {
  venue: string;
  city: (typeof CITIES)[string];
  event: CanonicalScrapedEvent;
}

export async function scrapeBergischLive(): Promise<VenueScrapeResult[]> {
  const today = todayIso();
  const byId = new Map<string, Parsed>();
  let programme: Parsed[] = [];

  for (const cat of CATEGORIES) {
    const url = `${BASE}/events/mode=utf8;client=;what=rubrik;show=${cat.id};shop=0;cal=${REGIONS}`;
    const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" } });
    if (!res.ok) throw new Error(`bergisch-live fetch failed: ${res.status} (rubrik ${cat.id})`);
    const html = await res.text();
    if (cat.id === FILM_CATEGORY) programme = parseProgrammes(html, today);
    for (const p of parseListing(html, today, cat.labels, cat.museumsOnly === true)) {
      if (cat.drop?.test(p.event.title)) continue;
      if (cat.museumsOnly && !MUSEUM_VENUES.has(`${p.venue}|${cityNameOf(p.city)}`)) continue;
      // An event listed under two categories keeps the first; merge labels so
      // e.g. an opera also listed as Klassik carries both.
      const prev = byId.get(p.event.source_event_id);
      if (!prev) byId.set(p.event.source_event_id, p);
      else
        for (const l of p.event.labels)
          if (!prev.event.labels.some((x) => x.label === l.label)) prev.event.labels.push(l);
    }
  }

  // A special screening is both a listing and a programme row, under
  // different titles ("Die Magie der Moore von Jan Haft" / "Magie der
  // Moore"); the listing carries image and link, so it wins the slot.
  const listed = new Set([...byId.values()].map((p) => `${p.venue}|${p.event.date}|${p.event.time}`));
  const all = [...byId.values(), ...programme.filter((p) => !listed.has(`${p.venue}|${p.event.date}|${p.event.time}`))];

  const byVenue = new Map<string, VenueScrapeResult>();
  for (const { venue, city, event } of all) {
    const key = `${venue}|${cityNameOf(city)}`;
    // The museum app takes an event's first museum label as its category,
    // so the classified type goes ahead of the "Vorträge & Führungen"
    // category's blanket museum:fuehrung.
    if (MUSEUM_VENUES.has(key) && !event.end_date)
      event.labels.unshift(...museumLabels(event).filter((l) => !event.labels.some((x) => x.label === l.label)));
    const owner = OWNED_VENUES[key];
    const slug = owner?.slug ?? `bergisch-${slugify(venue)}`;
    const result = byVenue.get(slug) ?? { source_slug: slug, display_name: owner?.name ?? venue, events: [] };
    // Owned slugs share the hub id space with their scraper, so the portal
    // id is namespaced. A slug with VENUE_COORDS resolves there; the rest
    // fall back to the city centroid.
    const coords = VENUE_COORDS[slug] ? {} : { lat: city.lat, lon: city.lon };
    result.events.push(
      owner
        ? { ...event, source_event_id: `wl-${event.source_event_id}`, city: city.slug }
        : { ...event, city: city.slug, ...coords },
    );
    byVenue.set(slug, result);
  }
  return [...byVenue.values()];
}

function cityNameOf(city: (typeof CITIES)[string]): string {
  return Object.keys(CITIES).find((k) => CITIES[k] === city) ?? "";
}

/** The museum-app category the hub classifier would give this event; the
 *  portal's own category labels (talk:, music:) stay for the other apps. */
function museumLabels(event: CanonicalScrapedEvent): ScrapedLabel[] {
  const description = event.description ?? null;
  return labelsForEvent(classifyEvent(event.title, description), event.title, description).filter((l) =>
    l.label.startsWith("museum:"),
  );
}

function parseListing(
  html: string,
  today: string,
  labelsFor: (title: string) => ScrapedLabel[],
  withExhibitions: boolean,
): Parsed[] {
  const out: Parsed[] = [];
  let year: string | null = null;

  for (const block of html.split(EVENT_SPLIT_RE).slice(1)) {
    const id = block.match(/^(\d+)"/)?.[1];
    const header = block.match(ZEITRAUM_RE)?.[1];
    if (header) year = header.match(/(\d{4})/)?.[1] ?? year;
    const day = block.match(DAY_RE);
    const run = withExhibitions && !day ? block.match(RUN_RE) : null;
    const loc = block.match(LOCATION_RE);
    const headline = block.match(HEADLINE_RE);
    if (!id || !loc || !headline) continue;

    let date: string;
    let endDate: string | null = null;
    if (day && year) {
      const month = MONTHS[clean(day[1]).toLowerCase()];
      if (!month) continue;
      date = `${year}-${month}-${day[2].padStart(2, "0")}`;
    } else if (run) {
      ({ start: date, end: endDate } = yearlessRun(run[1], run[2], run[3], run[4], today));
    } else continue;
    if ((endDate ?? date) < today) continue;

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
        end_date: endDate,
        time: run ? null : t ? `${t[1].padStart(2, "0")}:${t[2]}` : null,
        detail_url: `${BASE}/${id}`,
        // The per-event page is the portal's booking entry; its ticket widget
        // is JS-launched, so there's no separate shop URL to link.
        ticket_url: block.includes("ticketstatus-kaufbar") ? `${BASE}/${id}` : null,
        image_url: image ? `${BASE}${image}` : null,
        performers,
        venue_room: null,
        raw_category: null,
        labels: run
          ? [{ label: "museum:ausstellung", confidence: 0.95, classifier: "upstream-category" }]
          : labelsFor(`${title} ${performers ?? ""}`),
      },
    });
  }
  return out;
}

/** "12.05. – 30.04." carries no year. The portal lists current and upcoming
 *  exhibitions, so the end is the next such day from today, and a start
 *  later in the year than the end falls in the year before. */
function yearlessRun(sd: string, sm: string, ed: string, em: string, today: string): { start: string; end: string } {
  const year = Number(today.slice(0, 4));
  const endYear = `${year}-${em}-${ed}` < today ? year + 1 : year;
  const startYear = `${sm}${sd}` > `${em}${ed}` ? endYear - 1 : endYear;
  return { start: `${startYear}-${sm}-${sd}`, end: `${endYear}-${em}-${ed}` };
}

/** Weekly programmes of PROGRAMME_CINEMAS: one event per film showtime. */
function parseProgrammes(html: string, today: string): Parsed[] {
  const out: Parsed[] = [];
  for (const block of html.split(PROGRAMME_SPLIT_RE).slice(1)) {
    const kino = block.match(/^(\d+)"/)?.[1];
    const cinema = kino ? PROGRAMME_CINEMAS[kino] : undefined;
    const city = cinema ? CITIES[cinema.city] : undefined;
    if (!kino || !cinema || !city) continue;

    const weeks = [...block.matchAll(WEEK_RE)];
    for (const [w, week] of weeks.entries()) {
      const chunk = block.slice(week.index, weeks[w + 1]?.index ?? block.length);
      const endYear = 2000 + Number(week[5]);
      // A week spanning New Year starts in the previous year.
      const startYear = Number(week[2]) > Number(week[4]) ? endYear - 1 : endYear;
      const startMonth = week[2];

      for (const film of chunk.split(FILM_SPLIT_RE).slice(1)) {
        const filmId = film.match(/^(\d+)"/)?.[1];
        const title = clean(film.match(/class="flink">([\s\S]*?)<\/b>/)?.[1] ?? "");
        if (!filmId || !title) continue;
        for (const row of film.matchAll(SHOW_DAY_RE)) {
          const [, dd, mm, times] = row;
          const year = mm < startMonth ? startYear + 1 : startYear;
          const date = `${year}-${mm}-${dd}`;
          if (date < today) continue;
          for (const [, h, min] of times.matchAll(/(\d{1,2}):(\d{2})/g)) {
            const time = `${h.padStart(2, "0")}:${min}`;
            out.push({
              venue: cinema.venue,
              city,
              event: {
                source_event_id: `kino${kino}-${filmId}-${date}-${time}`,
                title,
                date,
                time,
                // The portal has no per-film page; the cinema's own programme
                // page is the nearest link.
                detail_url: cinema.url,
                labels: [{ label: "film:cinema", confidence: 0.95, classifier: "scraper-hardcoded" }],
              },
            });
          }
        }
      }
    }
  }
  return out;
}

function label(l: string, confidence = 0.9): ScrapedLabel {
  return { label: l, confidence, classifier: "upstream-category" };
}

function clean(s: string): string {
  return decodeEntities(stripHtml(s)).replace(/\s+/g, " ").trim();
}
