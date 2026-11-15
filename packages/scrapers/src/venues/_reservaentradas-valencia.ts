import { dateOffset, todayIso } from "@museumsufer/core/date";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";

const BASE = "https://www.reservaentradas.com";
const HORIZON_DAYS = 28;
/** The platform renders one page per film; a polite cap keeps ~300 requests/run from hammering a small host. */
const CONCURRENCY = 6;
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

interface ReservaCinema {
  /** Path segment on reservaentradas.com (`/cine/valencia/<key>`). */
  key: string;
  source_slug: string;
  name: string;
  lat: number;
  lon: number;
}

// Coordinates are hand-looked-up from OSM once; the scrape path must never geocode live.
const CINEMAS: ReservaCinema[] = [
  { key: "cinesbabel", source_slug: "cines-babel-valencia", name: "Cines Babel", lat: 39.4697, lon: -0.3572 },
  { key: "cineslys", source_slug: "cines-lys-valencia", name: "Cines Lys", lat: 39.4686, lon: -0.3749 },
  // ABC Park is not in OSM/Nominatim; this is the Carrer de Roger de Llúria street centre.
  { key: "abcpark", source_slug: "abc-park-valencia", name: "ABC Park", lat: 39.4688, lon: -0.3738 },
  { key: "abcelsaler", source_slug: "abc-el-saler-valencia", name: "ABC El Saler", lat: 39.4536, lon: -0.3538 },
  { key: "abcgranturia", source_slug: "abc-gran-turia-valencia", name: "ABC Gran Turia", lat: 39.4645, lon: -0.4148 },
  { key: "cinestudiodor", source_slug: "cinestudio-dor-valencia", name: "Cinestudio d'Or", lat: 39.4641, lon: -0.367 },
  { key: "cinesmn4", source_slug: "cines-mn4-valencia", name: "Cines MN4", lat: 39.4115, lon: -0.3826 },
];

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.text();
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

function decode(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(Number.parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m)
    .replace(/\s+/g, " ")
    .trim();
}

/** The site prints "dd / mm" without a year; pick the year that lands the date closest to (and not long before) today. */
function resolveDate(day: number, month: number): string {
  const today = todayIso();
  const year = Number(today.slice(0, 4));
  const iso = (y: number) => `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return iso(year) < dateOffset(-60) ? iso(year + 1) : iso(year);
}

/** Film page URLs (without the `?proximamente=true` tracking suffix) with the card's title when present. */
function filmLinks(cinemaHtml: string, cinemaKey: string): Map<string, string> {
  const links = new Map<string, string>();
  const re = new RegExp(`href="(${BASE.replace(/\./g, "\\.")}/sesiones/valencia/${cinemaKey}/[^"?]+)[^"]*"`, "g");
  for (const m of cinemaHtml.matchAll(re)) links.set(m[1], "");
  return links;
}

function parseFilmPage(
  html: string,
  cinema: ReservaCinema,
  filmUrl: string,
  lastDate: string,
): CanonicalScrapedEvent[] {
  const titleTag = decode(html.match(/<title>([^<]*)<\/title>/)?.[1] ?? "");
  const withoutBrand = titleTag.replace(/\s*-\s*ReservaEntradas\s*$/, "");
  // The cinema name is the last " en " segment; film titles themselves may contain " en ".
  const cut = withoutBrand.lastIndexOf(" en ");
  const title = cut > 0 ? withoutBrand.slice(0, cut).trim() : withoutBrand;
  if (!title) return [];

  const image = html.match(/<meta content="([^"]*)" property="og:image"/)?.[1] ?? null;
  const desc = decode(html.match(/<meta content="Comprar entradas para [^,]*?, ([^"]*)" property="og:description"/)?.[1] ?? "");
  const description = desc ? desc.slice(0, 600) : null;

  const container = html.indexOf('id="sessions-show-container"');
  if (container < 0) return [];
  const body = html.slice(container);

  const tabs = new Map<string, string>();
  for (const m of body.matchAll(/data-toggle="tab" href="#(\d+)"[^>]*>\s*[A-Za-zñÑáéíóú]+\s*<br>\s*(\d{1,2})\s*\/\s*(\d{1,2})\s*</g)) {
    tabs.set(m[1], resolveDate(Number(m[2]), Number(m[3])));
  }

  const events: CanonicalScrapedEvent[] = [];
  const paneRe = /<div id="(\d+)" class="tab-pane[^"]*">/g;
  const panes = [...body.matchAll(paneRe)];
  for (const [i, pane] of panes.entries()) {
    const date = tabs.get(pane[1]);
    if (!date || date > lastDate) continue;
    const segment = body.slice(pane.index, panes[i + 1]?.index ?? body.length);

    let format = "";
    let room: string | null = null;
    const tokenRe =
      /font-weight: bold; color: #323232">([^<]+)<|Sala: <b>([^<]*)<\/b>|<a\s+class="label[^"]*sesion[^"]*"\s+href="([^"]*\/entrada\/[^"]*?\/(\d+)\/\?step=2)"[^>]*>\s*(\d{1,2}:\d{2})\s*<\/a>/g;
    for (const t of segment.matchAll(tokenRe)) {
      if (t[1] !== undefined) {
        format = decode(t[1]);
      } else if (t[2] !== undefined) {
        room = decode(t[2]) || null;
      } else {
        const vose = /VOSE|V\.O\.?S|VOS\b/i.test(format);
        const original = /\bV\.?O\.?\b(?!S)/i.test(format);
        const flags = [vose ? "VOSE" : original ? "VO" : null, /3D|IMAX|4DX/i.exec(format)?.[0]].filter(Boolean);
        events.push({
          source_event_id: `${cinema.source_slug}-${t[4]}`,
          title,
          subtitle: flags.length ? flags.join(" · ") : null,
          description,
          date,
          time: t[5].padStart(5, "0"),
          detail_url: filmUrl,
          ticket_url: t[3],
          image_url: image,
          // VOSE/VO screenings keep the film's original audio, which this platform doesn't state; only dubbed/Spanish slots can be tagged.
          language: vose || original ? null : "es",
          venue_room: room ? `Sala ${room}` : null,
          city: "valencia",
          lat: cinema.lat,
          lon: cinema.lon,
          raw_category: format || null,
          labels: [{ label: "film:cinema", confidence: 0.95, classifier: "scraper-hardcoded" }],
        });
        room = null;
      }
    }
  }
  return events;
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<PromiseSettledResult<R>[]> {
  const out: PromiseSettledResult<R>[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      try {
        out[i] = { status: "fulfilled", value: await fn(items[i]) };
      } catch (reason) {
        out[i] = { status: "rejected", reason };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

async function scrapeCinema(cinema: ReservaCinema): Promise<VenueScrapeResult> {
  const lastDate = dateOffset(HORIZON_DAYS);
  const cinemaHtml = await fetchText(`${BASE}/cine/valencia/${cinema.key}`);
  const films = [...filmLinks(cinemaHtml, cinema.key).keys()];
  const settled = await mapLimit(films, CONCURRENCY, async (url) =>
    parseFilmPage(await fetchText(url), cinema, url, lastDate),
  );
  const events: CanonicalScrapedEvent[] = [];
  let failures = 0;
  for (const [i, outcome] of settled.entries()) {
    if (outcome.status === "fulfilled") events.push(...outcome.value);
    else {
      failures++;
      console.warn(`reservaentradas ${cinema.source_slug} ${films[i]}: ${outcome.reason}`);
    }
  }
  // A cinema page with films but every film page failing is an outage, not an empty programme.
  if (films.length > 0 && failures === films.length) {
    throw new Error(`reservaentradas ${cinema.source_slug}: all ${failures} film pages failed`);
  }
  return { source_slug: cinema.source_slug, display_name: cinema.name, events };
}

/**
 * Valencia-area cinemas that sell through the reservaentradas.com platform
 * (Babel, Lys, ABC Park/El Saler/Gran Turia, Cinestudio d'Or, MN4). There is
 * no JSON endpoint, so each cinema page is crawled for its film pages and the
 * per-day tabs are parsed.
 */
export async function scrapeReservaentradasValencia(): Promise<VenueScrapeResult[]> {
  const settled = await Promise.allSettled(CINEMAS.map(scrapeCinema));
  return settled.map((outcome, i) => {
    if (outcome.status === "fulfilled") return outcome.value;
    console.warn(`reservaentradas ${CINEMAS[i].source_slug}: ${outcome.reason}`);
    return { source_slug: CINEMAS[i].source_slug, display_name: CINEMAS[i].name, events: [] };
  });
}
