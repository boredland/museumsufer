import { dateOffset, todayIso } from "@museumsufer/core/date";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";
import { clipDescription, decodeHtml as decode, FILM_CINEMA_LABEL } from "./_valencia-cinema";

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
  /** Titles that are not screenings (galas) at venues that also host other events. */
  skipTitle?: RegExp;
}

// Coordinates are hand-looked-up from OSM (Nominatim) once; the scrape path must never geocode live.
const CINEMAS: ReservaCinema[] = [
  { key: "cinesbabel", source_slug: "cines-babel-valencia", name: "Cines Babel", lat: 39.4697, lon: -0.3572 },
  { key: "cineslys", source_slug: "cines-lys-valencia", name: "Cines Lys", lat: 39.4686, lon: -0.3749 },
  // Nominatim "ABC Park, 21, Carrer de Roger de Llòria" resolves the building itself.
  { key: "abcpark", source_slug: "abc-park-valencia", name: "ABC Park", lat: 39.4695, lon: -0.3729 },
  { key: "abcelsaler", source_slug: "abc-el-saler-valencia", name: "ABC El Saler", lat: 39.4536, lon: -0.3538 },
  { key: "abcgranturia", source_slug: "abc-gran-turia-valencia", name: "ABC Gran Turia", lat: 39.4645, lon: -0.4148 },
  { key: "cinestudiodor", source_slug: "cinestudio-dor-valencia", name: "Cinestudio d'Or", lat: 39.4641, lon: -0.367 },
  // Nominatim "MN4, Avinguda de l'Alcalde José Puertes" (the retail park the cinema sits in).
  { key: "cinesmn4", source_slug: "cines-mn4-valencia", name: "Cines MN4", lat: 39.4161, lon: -0.3802 },
  {
    key: "centreculturalbenetusserelmoli",
    source_slug: "centre-cultural-benetusser-valencia",
    name: "Centre Cultural Benetússer El Molí",
    lat: 39.4233,
    lon: -0.4026,
    skipTitle: /\bgala\b/i,
  },
];

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.text();
}

/** The site prints "dd / mm" without a year; pick the year that lands the date closest to (and not long before) today. */
function resolveDate(day: number, month: number): string {
  const today = todayIso();
  const year = Number(today.slice(0, 4));
  const iso = (y: number) => `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return iso(year) < dateOffset(-60) ? iso(year + 1) : iso(year);
}

/** Film page URLs (without the `?proximamente=true` tracking suffix). */
function filmLinks(cinemaHtml: string, cinemaKey: string): string[] {
  const re = new RegExp(`href="(${BASE.replace(/\./g, "\\.")}/sesiones/valencia/${cinemaKey}/[^"?]+)[^"]*"`, "g");
  return [...new Set([...cinemaHtml.matchAll(re)].map((m) => m[1]))];
}

interface SessionFlags {
  subtitle: string | null;
  language: string | null;
}

/**
 * The format header ("DIGITAL", "(VOSE)", "(VAL SCAS)", "(3D)", "(35mm)") is the only
 * place the platform states the audio version. VOSE/VO keep the film's original audio,
 * which is not named anywhere, so `language` stays unset for those.
 */
function sessionFlags(format: string): SessionFlags {
  const vose = /VOSE|V\.O\.?S|VOS\b|SORIG/i.test(format);
  const original = !vose && /\bV\.?O\.?\b/i.test(format);
  const valencian = /\bVAL\b/i.test(format);
  const catalan = /\bCAT\b/i.test(format);
  const extra = /3D|IMAX|4DX|35\s*mm/i.exec(format)?.[0]?.replace(/\s+/g, "");
  const flags = [vose ? "VOSE" : original ? "VO" : null, valencian ? "Valencià" : catalan ? "Català" : null, extra ?? null];
  const language = vose || original ? null : valencian || catalan ? "ca" : "es";
  const subtitle = flags.filter(Boolean).join(" · ");
  return { subtitle: subtitle || null, language };
}

function parseFilmPage(
  html: string,
  cinema: ReservaCinema,
  filmUrl: string,
  lastDate: string,
  today: string,
): CanonicalScrapedEvent[] {
  const titleTag = decode(html.match(/<title>([^<]*)<\/title>/)?.[1] ?? "");
  const withoutBrand = titleTag.replace(/\s*-\s*ReservaEntradas\s*$/, "");
  // The cinema name is the last " en " segment; film titles themselves may contain " en ".
  const cut = withoutBrand.lastIndexOf(" en ");
  const title = (cut > 0 ? withoutBrand.slice(0, cut) : withoutBrand).replace(/\s+-\s+35\s?mm$/i, "").trim();
  if (!title) return [];
  if (cinema.skipTitle?.test(title)) return [];

  const image = html.match(/<meta content="([^"]*)" property="og:image"/)?.[1] ?? null;
  // og:description prefixes "Comprar entradas para <title> en <cinema>," and titles may contain commas, so use the synopsis paragraph.
  const description = clipDescription(decode(html.match(/<p id="sinopsis_info"[^>]*>([\s\S]*?)<\/p>/)?.[1] ?? ""));

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
    if (!date || date < today || date > lastDate) continue;
    const segment = body.slice(pane.index, panes[i + 1]?.index ?? body.length);

    let format = "";
    let room: string | null = null;
    let seats: { free: number; total: number } | null = null;
    const tokenRe =
      /font-weight: bold; color: #323232">([^<]+)<|Sala: <b>([^<]*)<\/b>|Plazas disponibles: <b>(\d+)<\/b>\s*\/\s*(\d+)|<a\s+class="(label[^"]*sesion[^"]*)"\s+href="([^"]*\/entrada\/[^"]*?\/(\d+)\/\?step=2)"[^>]*>\s*(\d{1,2}:\d{2})\s*<\/a>/g;
    for (const t of segment.matchAll(tokenRe)) {
      if (t[1] !== undefined) {
        format = decode(t[1]);
      } else if (t[2] !== undefined) {
        room = decode(t[2]) || null;
      } else if (t[3] !== undefined) {
        seats = { free: Number(t[3]), total: Number(t[4]) };
      } else {
        const { subtitle, language } = sessionFlags(format);
        // `vtadisable` is the platform's own sold-out styling; it also stops listing seat counts.
        const availability: CanonicalScrapedEvent["availability"] = /vtadisable/.test(t[5])
          ? "sold_out"
          : seats && seats.total > 0 && seats.free <= Math.max(5, Math.floor(seats.total * 0.1))
            ? "few_left"
            : null;
        events.push({
          source_event_id: `${cinema.source_slug}-${t[7]}`,
          title,
          subtitle,
          description,
          date,
          time: t[8].padStart(5, "0"),
          detail_url: filmUrl,
          ticket_url: t[6],
          image_url: image,
          language,
          venue_room: room ? `Sala ${room}` : null,
          city: "valencia",
          lat: cinema.lat,
          lon: cinema.lon,
          raw_category: format || null,
          availability,
          labels: [FILM_CINEMA_LABEL],
        });
        room = null;
        seats = null;
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
  const today = todayIso();
  const cinemaHtml = await fetchText(`${BASE}/cine/valencia/${cinema.key}`);
  const films = filmLinks(cinemaHtml, cinema.key);
  if (films.length === 0) throw new Error(`reservaentradas ${cinema.source_slug}: no film links on the cinema page`);
  const settled = await mapLimit(films, CONCURRENCY, async (url) =>
    parseFilmPage(await fetchText(url), cinema, url, lastDate, today),
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
  // Half the film pages failing is an outage, not a thin programme.
  if (failures * 2 > films.length) {
    throw new Error(`reservaentradas ${cinema.source_slug}: ${failures}/${films.length} film pages failed`);
  }
  if (events.length === 0) throw new Error(`reservaentradas ${cinema.source_slug}: ${films.length} films but no sessions parsed`);
  // Sort so the bundle stays byte-stable regardless of fetch completion order.
  events.sort((a, b) => a.date.localeCompare(b.date) || a.time!.localeCompare(b.time!) || a.source_event_id.localeCompare(b.source_event_id));
  return { source_slug: cinema.source_slug, display_name: cinema.name, events };
}

/**
 * Valencia-area cinemas that sell through the reservaentradas.com platform
 * (Babel, Lys, ABC Park/El Saler/Gran Turia, Cinestudio d'Or, MN4, El Molí).
 * There is no JSON endpoint, so each cinema page is crawled for its film pages
 * and the per-day tabs are parsed. One cinema failing is omitted (its previous
 * events age out via the hub's stale TTL) instead of being reported as empty;
 * all of them failing throws.
 */
export async function scrapeReservaentradasValencia(): Promise<VenueScrapeResult[]> {
  const settled = await Promise.allSettled(CINEMAS.map(scrapeCinema));
  const results: VenueScrapeResult[] = [];
  for (const [i, outcome] of settled.entries()) {
    if (outcome.status === "fulfilled") results.push(outcome.value);
    else console.warn(`reservaentradas ${CINEMAS[i].source_slug}: ${outcome.reason}`);
  }
  if (results.length === 0) throw new Error("reservaentradas-valencia: every cinema failed");
  return results;
}
