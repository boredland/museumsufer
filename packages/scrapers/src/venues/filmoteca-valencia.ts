import { dateOffset, todayIso } from "@museumsufer/core/date";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";

const URL = "https://ivc.gva.es/es/audiovisuales/programacion/programacion-dias?filtro=sede-1";
const HORIZON_DAYS = 28;
// Edificio Rialto, Plaça de l'Ajuntament 17; coordinates looked up once by hand, never geocoded in the scrape.
const LAT = 39.471;
const LON = -0.3763;

const MONTHS: Record<string, number> = {
  ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8, sep: 9, set: 9, oct: 10, nov: 11, dic: 12,
};

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

function decode(s: string): string {
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(Number.parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m)
    .replace(/\s+/g, " ")
    .trim();
}

/** Listing shows day + month abbreviation only; pick the year that keeps the date near today. */
function resolveDate(day: number, month: number): string {
  const year = Number(todayIso().slice(0, 4));
  const iso = (y: number) => `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return iso(year) < dateOffset(-60) ? iso(year + 1) : iso(year);
}

/**
 * València - La Filmoteca (IVC) at the Edificio Rialto. The "Programación por
 * días" listing is server-rendered: one `.actividad` block per slot, which can
 * hold several films (double bills) sharing one start time and ticket link.
 */
export async function scrapeFilmotecaValencia(): Promise<VenueScrapeResult> {
  const res = await fetch(URL, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`filmoteca-valencia: HTTP ${res.status}`);
  const html = await res.text();
  const lastDate = dateOffset(HORIZON_DAYS);

  const events: CanonicalScrapedEvent[] = [];
  const blocks = html.split('<div class="actividad').slice(1);
  for (const block of blocks) {
    const day = block.match(/<span class="dia">(\d{1,2})<\/span>/)?.[1];
    const mon = block.match(/<span class="mes">([^<]+)<\/span>/)?.[1]?.trim().toLowerCase().slice(0, 3);
    const time = block.match(/<span class="hora">(\d{1,2}:\d{2})/)?.[1];
    const month = mon ? MONTHS[mon] : undefined;
    if (!day || !month || !time) continue;
    const date = resolveDate(Number(day), month);
    if (date > lastDate) continue;
    const ticket = block.match(/class="btn-venta-entradas" href="([^"]+)"/)?.[1] ?? null;

    for (const film of block.split('<div class="ficha-peli">').slice(1)) {
      const link = film.match(/<h2><a href="([^"]*pelicula-(\d+)[^"]*)"[^>]*>([\s\S]*?)<\/a><\/h2>/);
      if (!link) continue;
      const cycle = decode(film.match(/<span class="extra-ciclo">([\s\S]*?)<\/span>/)?.[1] ?? "");
      const meta = decode(film.match(/<p>([\s\S]*?)<\/p>/)?.[1] ?? "");
      const parts = meta.split(" · ");
      const director = parts[0] || null;
      const country = parts[1] ?? "";
      const vos = /\bVOS|\bVO\b/i.test(meta);
      const image = film.match(/<img src="([^"]+)"/)?.[1] ?? null;
      const subtitleBits = [cycle || null, vos ? "VOSE" : null].filter(Boolean);

      events.push({
        source_event_id: `filmoteca-valencia-${link[2]}-${date}-${time}`,
        title: decode(link[3]),
        subtitle: subtitleBits.length ? subtitleBits.join(" · ") : null,
        description: meta || null,
        date,
        time: time.padStart(5, "0"),
        detail_url: link[1],
        ticket_url: ticket,
        image_url: image,
        // Subtitled prints keep a foreign original track; only Spanish productions shown without subtitles are safely "es".
        language: !vos && /^españa$/i.test(country) ? "es" : null,
        performers: director,
        venue_room: "Edificio Rialto",
        city: "valencia",
        lat: LAT,
        lon: LON,
        raw_category: cycle || null,
        labels: [{ label: "film:cinema", confidence: 0.95, classifier: "scraper-hardcoded" }],
      });
    }
  }

  return { source_slug: "filmoteca-valencia", display_name: "València - La Filmoteca", events };
}
