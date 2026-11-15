import { dateOffset } from "@museumsufer/core/date";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";

const BASE = "https://tickets.ocinepremiumaqua.es";
const HORIZON_DAYS = 28;
// Ocine Premium Aqua, Carrer de Menorca 19; coordinates looked up once by hand, never geocoded in the scrape.
const LAT = 39.4566;
const LON = -0.3459;
const CONCURRENCY = 5;

interface Session {
  planificacio: number;
  data: string;
  hora: string;
  nomSala?: string | null;
  disponibles?: number | null;
}

interface SubFilm {
  id: number;
  titol: string;
  propietatsDesc?: string[] | null;
  sessions?: Session[] | null;
}

interface FilmDetail {
  id: number;
  titol: string;
  titolOriginal?: string | null;
  durada?: string | null;
  genereComercial?: string | null;
  director?: string | null;
  sinopsis?: string | null;
  subPelicules?: SubFilm[] | null;
  sessions?: Session[] | null;
}

interface ListFilm {
  id: number;
}

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`ocine-aqua-valencia: HTTP ${res.status} for ${url}`);
  return (await res.json()) as T;
}

/**
 * Ocine Premium Aqua (Valencia). The ticketing SPA's JSON API lists films on
 * `POST /api/v1/sessions` but only fills in showtimes on the per-film detail
 * endpoint, where each film fans out into one sub-film per projection format
 * (2D, ATMOS, 4D…) that carries the sessions.
 */
export async function scrapeOcineAquaValencia(): Promise<VenueScrapeResult> {
  const list = await json<{ pelicules?: ListFilm[]; estrenes?: ListFilm[]; anticipades?: ListFilm[] }>(
    `${BASE}/api/v1/sessions`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: "", idioma: "es", urlWeb: `${BASE}/` }),
    },
  );
  const ids = [...new Set([...(list.pelicules ?? []), ...(list.estrenes ?? []), ...(list.anticipades ?? [])].map((f) => f.id))];
  const lastDate = dateOffset(HORIZON_DAYS);

  const details: FilmDetail[] = [];
  let failures = 0;
  let next = 0;
  const worker = async () => {
    while (next < ids.length) {
      const id = ids[next++];
      try {
        details.push(await json<FilmDetail>(`${BASE}/api/v1/pelicula/${id}?lang=es`));
      } catch (err) {
        failures++;
        console.warn(`ocine-aqua-valencia film ${id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, ids.length) }, worker));
  if (ids.length > 0 && failures === ids.length) throw new Error("ocine-aqua-valencia: all film detail requests failed");
  // Fetch order depends on completion timing; sort so the committed bundle stays byte-stable.
  details.sort((a, b) => a.id - b.id);

  const events: CanonicalScrapedEvent[] = [];
  for (const film of details) {
    const variants: Array<{ titol: string; formats: string[]; sessions: Session[] }> = (film.subPelicules ?? []).map((s) => ({
      titol: s.titol,
      formats: s.propietatsDesc ?? [],
      sessions: s.sessions ?? [],
    }));
    if (film.sessions?.length) variants.push({ titol: film.titol, formats: [], sessions: film.sessions });

    for (const variant of variants) {
      for (const s of variant.sessions) {
        if (!s.data || s.data > lastDate) continue;
        const flags = variant.formats.filter((f) => f && f !== "2D");
        events.push({
          source_event_id: `ocine-aqua-valencia-${s.planificacio}`,
          title: film.titol,
          subtitle: [...flags, film.durada && film.durada !== "0" ? `${film.durada} min` : null].filter(Boolean).join(" · ") || null,
          description: film.sinopsis ? film.sinopsis.slice(0, 600) : null,
          date: s.data,
          time: s.hora.slice(0, 5),
          detail_url: `${BASE}/`,
          ticket_url: `${BASE}/`,
          performers: film.director ?? null,
          venue_room: s.nomSala ?? null,
          city: "valencia",
          lat: LAT,
          lon: LON,
          raw_category: film.genereComercial ?? null,
          availability: s.disponibles === 0 ? "sold_out" : null,
          labels: [{ label: "film:cinema", confidence: 0.95, classifier: "scraper-hardcoded" }],
        });
      }
    }
  }

  return { source_slug: "ocine-aqua-valencia", display_name: "Ocine Premium Aqua", events };
}
