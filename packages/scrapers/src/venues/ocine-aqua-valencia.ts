import { dateOffset, todayIso } from "@museumsufer/core/date";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";
import { clipDescription, FILM_CINEMA_LABEL } from "./_valencia-cinema";

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
  totals?: number | null;
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

function addMinutes(time: string, minutes: number): string | null {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + minutes;
  // A show running past midnight has no sensible same-day end time.
  if (total >= 24 * 60) return null;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
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

  const today = todayIso();
  const events: CanonicalScrapedEvent[] = [];
  for (const film of details) {
    // Sessions hang off the per-format sub-film (2D, ATMOS, 4D…); the ticketing SPA deep-links to that id.
    const variants: Array<{ id: number; formats: string[]; sessions: Session[] }> = (film.subPelicules ?? []).map((s) => ({
      id: s.id,
      formats: s.propietatsDesc ?? [],
      sessions: s.sessions ?? [],
    }));
    if (film.sessions?.length) variants.push({ id: film.id, formats: [], sessions: film.sessions });

    const description = clipDescription((film.sinopsis ?? "").replace(/\s+/g, " "));
    const runtime = film.durada && Number(film.durada) > 0 ? Number(film.durada) : null;
    for (const variant of variants) {
      const link = `${BASE}/#/DetallPelicula/${variant.id}`;
      const vose = variant.formats.some((f) => /VOSE/i.test(f));
      const original = !vose && variant.formats.some((f) => /\bVO\b|original/i.test(f));
      const catalan = variant.formats.some((f) => /Catal/i.test(f));
      const basque = variant.formats.some((f) => /Euskera/i.test(f));
      for (const s of variant.sessions) {
        if (!s.data || s.data < today || s.data > lastDate) continue;
        const flags = variant.formats.filter((f) => f && f !== "2D");
        const time = s.hora.slice(0, 5);
        const total = s.totals ?? 0;
        events.push({
          source_event_id: `ocine-aqua-valencia-${s.planificacio}`,
          title: film.titol,
          subtitle: [...flags, runtime ? `${runtime} min` : null].filter(Boolean).join(" · ") || null,
          description,
          date: s.data,
          time,
          end_time: runtime ? addMinutes(time, runtime) : null,
          detail_url: link,
          ticket_url: link,
          // Sessions without a version property are the dubbed Spanish run; VO/VOSE keep an unnamed original track.
          language: vose || original || basque ? null : catalan ? "ca" : "es",
          performers: film.director ?? null,
          venue_room: s.nomSala ? s.nomSala.replace(/^SALA\s+/i, "Sala ") : null,
          city: "valencia",
          lat: LAT,
          lon: LON,
          raw_category: film.genereComercial ?? null,
          availability:
            s.disponibles === 0 ? "sold_out" : s.disponibles != null && total > 0 && s.disponibles <= Math.max(5, Math.floor(total * 0.1)) ? "few_left" : null,
          labels: [FILM_CINEMA_LABEL],
        });
      }
    }
  }
  if (events.length === 0) throw new Error("ocine-aqua-valencia: films listed but no upcoming sessions");
  events.sort((a, b) => a.date.localeCompare(b.date) || a.time!.localeCompare(b.time!) || a.source_event_id.localeCompare(b.source_event_id));

  return { source_slug: "ocine-aqua-valencia", display_name: "Ocine Premium Aqua", events };
}
