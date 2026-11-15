import { decodeEntities, stripHtml } from "@museumsufer/core";
import { dateOffset, todayIso } from "@museumsufer/core/date";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";
import { FILM_CINEMA_LABEL } from "./_valencia-cinema";

const BASE = "https://conocevalencia.es/es/cines-valencia";
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
/** The site lists roughly the next week; this only bounds a runaway page. */
const HORIZON_DAYS = 28;

interface Cinema {
  /** Path segment under /es/cines-valencia/. */
  key: string;
  source_slug: string;
  name: string;
  lat: number;
  lon: number;
}

/**
 * The chains' own sites block datacenter IPs (Cinesa and Kinépolis answer 403
 * even through the fetch proxy; Yelmo's GraphQL API sits behind Cloudflare), and
 * SensaCine's showtimes live under a robots-disallowed path. conocevalencia.es
 * republishes their programmes with the chains' own per-session ticket links.
 * Coordinates are the site's schema.org geo, cross-checked against Nominatim.
 */
const CINEMAS: Cinema[] = [
  { key: "kinepolis", source_slug: "kinepolis-valencia", name: "Kinépolis València", lat: 39.5303, lon: -0.4407 },
  { key: "cinesa-bonaire", source_slug: "cinesa-bonaire-valencia", name: "Cinesa Bonaire", lat: 39.4718, lon: -0.4886 },
  { key: "yelmo-campanar", source_slug: "yelmo-campanar-valencia", name: "Yelmo Cines Mercado de Campanar", lat: 39.4776, lon: -0.3958 },
  { key: "autocine-star", source_slug: "autocine-star-valencia", name: "Autocine Star", lat: 39.4089, lon: -0.3347 },
];

const MONTHS: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8,
  septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
};

/** The page prints day + month name without a year; pick the year that keeps the date near today. */
function resolveDate(day: number, month: number): string {
  const year = Number(todayIso().slice(0, 4));
  const iso = (y: number) => `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return iso(year) < dateOffset(-60) ? iso(year + 1) : iso(year);
}

function addMinutes(time: string, minutes: number): string | null {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + minutes;
  if (total >= 24 * 60) return null;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function kebab(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function parseCinema(html: string, cinema: Cinema, today: string, lastDate: string): CanonicalScrapedEvent[] {
  const page = html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<svg[\s\S]*?<\/svg>/g, "")
    .replace(/<!-- -->/g, "");

  // "30 películas · 199 sesiones": the page's own session count guards against a silent parse miss.
  const claimed = Number(page.match(/(\d+)\s*películas?\s*·\s*(\d+)\s*sesiones?/)?.[2] ?? Number.NaN);
  if (Number.isNaN(claimed)) throw new Error(`${cinema.source_slug}: session count header missing (markup changed?)`);

  const dayRe = /<h2[^>]*>[a-záéíóúñ]+, (\d{1,2}) de ([a-záéíóúñ]+)<\/h2>/g;
  const days = [...page.matchAll(dayRe)];
  const end = page.indexOf("</main>");
  const events: CanonicalScrapedEvent[] = [];
  const seen = new Map<string, number>();

  for (const [i, day] of days.entries()) {
    const month = MONTHS[day[2]];
    if (!month) continue;
    const date = resolveDate(Number(day[1]), month);
    if (date < today || date > lastDate) continue;
    const segment = page.slice(day.index, days[i + 1]?.index ?? (end > day.index ? end : page.length));

    for (const film of segment.split(/<li class="flex gap-4 py-4/).slice(1)) {
      const title = stripHtml(film.match(/<h3[^>]*>([\s\S]*?)<\/h3>/)?.[1] ?? "");
      if (!title) continue;
      const image = film.match(/<img src="(https:\/\/image\.tmdb\.org\/t\/p\/)w185(\/[^"]+)"/);
      const meta = film.match(/<p class="mt-0\.5[^>]*>([\s\S]*?)<\/p>/)?.[1] ?? "";
      const spans = [...meta.matchAll(/<span[^>]*>(?:<span[^>]*>[^<]*<\/span>)?([^<]*)<\/span>/g)].map((m) => stripHtml(m[1]));
      const runtime = Number(spans.map((s) => s.match(/^(\d+)\s*min$/)?.[1]).find(Boolean));
      const genres = spans.find((s) => s.includes(" · ") || /^[A-Za-zÁÉÍÓÚáéíóúñ ]{4,}$/.test(s)) ?? null;

      for (const a of film.matchAll(/<a href="([^"]+)"[^>]*rel="noopener nofollow"[^>]*>(\d{1,2}:\d{2})((?:<span[^>]*>[^<]*<\/span>)*)<\/a>/g)) {
        const url = decodeEntities(a[1]);
        const time = a[2].padStart(5, "0");
        const tags = [...a[3].matchAll(/<span[^>]*>([^<]*)<\/span>/g)].map((m) => stripHtml(m[1]));
        const vose = tags.some((t) => /^V\.?O\.?S\.?E\.?$/i.test(t));
        const original = !vose && tags.some((t) => /^V\.?O\.?$/i.test(t));
        const format = tags.filter((t) => /^(IMAX|4DX|3D|ScreenX|ATMOS)$/i.test(t));
        const subtitle = [vose ? "VOSE" : original ? "VO" : null, ...format].filter(Boolean).join(" · ") || null;

        // Cinesa and Yelmo carry a session id in the link; Kinépolis links per film, so fall back to date/time/title.
        const session = url.match(/showtimeId=([\w-]+)|[?&]session=(\d+)/);
        const base = session
          ? `${cinema.source_slug}-${session[1] ?? session[2]}`
          : `${cinema.source_slug}-${date}-${time}-${kebab(title)}${subtitle ? `-${kebab(subtitle)}` : ""}`;
        const n = (seen.get(base) ?? 0) + 1;
        seen.set(base, n);

        events.push({
          source_event_id: n === 1 ? base : `${base}-${n}`,
          title,
          subtitle,
          description: null,
          date,
          time,
          end_time: Number.isFinite(runtime) && runtime > 0 ? addMinutes(time, runtime) : null,
          detail_url: url,
          ticket_url: url,
          image_url: image ? `${image[1]}w342${image[2]}` : null,
          // Unflagged sessions are the dubbed Spanish run; VOSE/VO keep an original track the site doesn't name.
          language: vose || original ? null : "es",
          city: "valencia",
          lat: cinema.lat,
          lon: cinema.lon,
          raw_category: genres,
          labels: [FILM_CINEMA_LABEL],
        });
      }
    }
  }

  if (claimed > 0 && events.length === 0) throw new Error(`${cinema.source_slug}: page claims ${claimed} sessions, parsed 0`);
  if (events.length > 0 && events.length < claimed * 0.8) {
    throw new Error(`${cinema.source_slug}: parsed ${events.length} of ${claimed} claimed sessions`);
  }
  events.sort((a, b) => a.date.localeCompare(b.date) || a.time!.localeCompare(b.time!) || a.source_event_id.localeCompare(b.source_event_id));
  return events;
}

async function scrapeCinema(cinema: Cinema): Promise<VenueScrapeResult> {
  const res = await fetch(`${BASE}/${cinema.key}`, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`${cinema.source_slug}: HTTP ${res.status}`);
  const events = parseCinema(await res.text(), cinema, todayIso(), dateOffset(HORIZON_DAYS));
  return { source_slug: cinema.source_slug, display_name: cinema.name, events };
}

/**
 * Valencia-area chain cinemas whose own sites are unreachable from CI: Kinépolis
 * (Paterna), Cinesa Bonaire (Aldaia), Yelmo Mercado de Campanar and Autocine Star.
 * A failing cinema is omitted (its events age out via the hub's stale TTL) rather
 * than reported empty; all of them failing throws.
 */
export async function scrapeConocevalenciaCinemas(): Promise<VenueScrapeResult[]> {
  const settled = await Promise.allSettled(CINEMAS.map(scrapeCinema));
  const results: VenueScrapeResult[] = [];
  for (const [i, outcome] of settled.entries()) {
    if (outcome.status === "fulfilled") results.push(outcome.value);
    else console.warn(`conocevalencia ${CINEMAS[i].source_slug}: ${outcome.reason}`);
  }
  if (results.length === 0) throw new Error("conocevalencia-cinemas-valencia: every cinema failed");
  return results;
}
