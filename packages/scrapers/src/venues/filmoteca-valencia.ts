import { dateOffset, todayIso } from "@museumsufer/core/date";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";
import { clipDescription, decodeHtml as decode, FILM_CINEMA_LABEL } from "./_valencia-cinema";

const URL = "https://ivc.gva.es/es/audiovisuales/programacion/programacion-dias?filtro=sede-1";
/** The listing itself only runs ~6 weeks ahead; this just bounds a runaway page. */
const HORIZON_DAYS = 120;
const DETAIL_CONCURRENCY = 4;
// Edificio Rialto, Plaça de l'Ajuntament 17; coordinates looked up once by hand (Nominatim), never geocoded in the scrape.
const LAT = 39.471;
const LON = -0.3763;

const MONTHS: Record<string, number> = {
  ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8, sep: 9, set: 9, oct: 10, nov: 11, dic: 12,
};

/** Listing shows day + month abbreviation only; pick the year that keeps the date near today. */
function resolveDate(day: number, month: number): string {
  const year = Number(todayIso().slice(0, 4));
  const iso = (y: number) => `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return iso(year) < dateOffset(-60) ? iso(year + 1) : iso(year);
}

function addMinutes(time: string, minutes: number): string | null {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + minutes;
  // A show running past midnight has no sensible same-day end time.
  if (total >= 24 * 60) return null;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`filmoteca-valencia: HTTP ${res.status} for ${url}`);
  return res.text();
}

/** Synopsis from a film/programme page; the listing only carries credits and technical data. */
async function fetchSynopses(urls: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  let next = 0;
  const worker = async () => {
    while (next < urls.length) {
      const url = urls[next++];
      try {
        const html = await fetchHtml(url);
        const raw = html.match(/<h2 class="enficha">Sinopsis<\/h2><div class="contenido">([\s\S]*?)<\/div>/)?.[1];
        const text = raw ? clipDescription(decode(raw.replace(/<br\s*\/?>/gi, " "))) : null;
        if (text) out.set(url, text);
      } catch (err) {
        // A missing synopsis degrades one description; it must not drop the screening.
        console.warn(`filmoteca-valencia synopsis ${url}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(DETAIL_CONCURRENCY, urls.length) }, worker));
  return out;
}

/**
 * València - La Filmoteca (IVC) at the Edificio Rialto. The "Programación por
 * días" listing is server-rendered: one `.actividad` block per slot, which can
 * hold several films (double bills) sharing one start time and ticket link.
 * Castellón and Alicante sedes (`filtro=sede-2/3`) are outside the Valencia geofence.
 */
export async function scrapeFilmotecaValencia(): Promise<VenueScrapeResult> {
  const html = await fetchHtml(URL);
  const today = todayIso();
  const lastDate = dateOffset(HORIZON_DAYS);

  const blocks = html.split('<div class="actividad').slice(1);
  if (blocks.length === 0) throw new Error("filmoteca-valencia: no .actividad blocks (markup changed?)");

  const events: CanonicalScrapedEvent[] = [];
  for (const block of blocks) {
    const day = block.match(/<span class="dia">(\d{1,2})<\/span>/)?.[1];
    const mon = block.match(/<span class="mes">([^<]+)<\/span>/)?.[1]?.trim().toLowerCase().slice(0, 3);
    const time = block.match(/<span class="hora">(\d{1,2}:\d{2})/)?.[1];
    const month = mon ? MONTHS[mon] : undefined;
    if (!day || !month || !time) continue;
    const date = resolveDate(Number(day), month);
    if (date < today || date > lastDate) continue;
    const ticket = block.match(/class="btn-venta-entradas" href="([^"]+)"/)?.[1] ?? null;

    for (const film of block.split('<div class="ficha-peli">').slice(1)) {
      const link = film.match(/<h2><a href="([^"]*(?:pelicula|programa)-(\d+)[^"]*)"[^>]*>([\s\S]*?)<\/a><\/h2>/);
      if (!link) continue;
      const cycle = decode(film.match(/<span class="extra-ciclo">([\s\S]*?)<\/span>/)?.[1] ?? "");
      const meta = decode(film.match(/<p>([\s\S]*?)<\/p>/)?.[1] ?? "");
      const parts = meta.split(" · ");
      const director = film.match(/<p><strong>([\s\S]*?)<\/strong>/)?.[1];
      const country = (director ? parts[1] : parts[0]) ?? "";
      const vos = /\bVOS|\bVO\b/i.test(meta);
      const runtime = meta.match(/\b(\d{2,3})'/)?.[1];
      const image = film.match(/<img src="([^"]+)"/)?.[1] ?? null;
      const subtitleBits = [cycle || null, vos ? "VOSE" : null].filter(Boolean);
      const time24 = time.padStart(5, "0");

      events.push({
        source_event_id: `filmoteca-valencia-${link[2]}-${date}-${time24}`,
        title: decode(link[3]),
        subtitle: subtitleBits.length ? subtitleBits.join(" · ") : null,
        description: meta || null,
        date,
        time: time24,
        end_time: runtime ? addMinutes(time24, Number(runtime)) : null,
        detail_url: link[1],
        ticket_url: ticket,
        image_url: image,
        // Subtitled prints keep a foreign original track; only Spanish productions shown without subtitles are safely "es".
        language: !vos && /^españa$/i.test(country) ? "es" : null,
        performers: director ? decode(director) : null,
        venue_room: "Edificio Rialto",
        city: "valencia",
        lat: LAT,
        lon: LON,
        raw_category: cycle || null,
        labels: [FILM_CINEMA_LABEL],
      });
    }
  }
  if (events.length === 0) throw new Error("filmoteca-valencia: listing parsed but no upcoming screenings");

  const synopses = await fetchSynopses([...new Set(events.map((e) => e.detail_url!))].sort());
  for (const e of events) {
    const synopsis = synopses.get(e.detail_url!);
    // Credits/technical line stays as the fallback so a failed detail fetch doesn't blank the description.
    if (synopsis) e.description = `${synopsis}\n\n${e.description ?? ""}`.trim();
  }
  events.sort((a, b) => a.date.localeCompare(b.date) || a.time!.localeCompare(b.time!) || a.source_event_id.localeCompare(b.source_event_id));

  return { source_slug: "filmoteca-valencia", display_name: "València - La Filmoteca", events };
}
