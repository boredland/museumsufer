/**
 * Post-scrape enrichment for `film:cinema` events that lack an image_url.
 * Looks up TMDb by title (+ year when extractable), fills image_url with the
 * canonical poster URL, and stores the TMDb movie id on the event so apps
 * can deep-link to themoviedb.org/movie/{id} from the screening card.
 *
 * Cache is persisted across runs in packages/event-hub/data/tmdb-cache.ts.
 * A null tombstone marks lookups that returned no match — we never retry
 * those.
 *
 * Skipped silently when TMDB_API_KEY is unset (warns once via the logger).
 */
import type { TmdbCacheEntry } from "../data/tmdb-cache";
import type { CanonicalEvent } from "./types";

const TMDB_BASE = "https://api.themoviedb.org/3";
const POSTER_BASE = "https://image.tmdb.org/t/p/w500";

interface TmdbSearchResult {
  id: number;
  poster_path: string | null;
  release_date?: string | null;
  original_title?: string;
  title?: string;
}

interface TmdbSearchResponse {
  results?: TmdbSearchResult[];
}

export type TmdbCache = Record<string, TmdbCacheEntry | null>;

export interface EnrichOptions {
  apiKey?: string;
  cache: TmdbCache;
  log?: (msg: string) => void;
  /** Hard cap on lookups per run — protects against an unusually large net-
   *  new batch swamping the GH-action 25-min budget. TMDb itself allows ~50
   *  req/s so the cap is purely a runtime guard. */
  maxLookups?: number;
}

/** Match a 4-digit year, preferring trailing context (subtitle ends with the
 *  year like "OV · 2026 · 119 min") over the title. */
const YEAR_RE = /\b(19\d{2}|20\d{2})\b/;

function extractYear(ev: CanonicalEvent): number | undefined {
  const sources = [ev.subtitle, ev.description, ev.title];
  for (const s of sources) {
    if (!s) continue;
    const m = s.match(YEAR_RE);
    if (m) return Number(m[1]);
  }
  return undefined;
}

/** Curly-quote pairs around the title, common on Filmforum Höchst /
 *  Kinopolis programmes: „Zirkuskind", "Mary", «Le Quai des Brumes». */
const WRAPPING_QUOTES_RE = /^[„"«»"']\s*(.+?)\s*[""»«"'.]\s*$/;

/** Trim title noise that hurts TMDb match quality. */
function normaliseTitle(title: string): string {
  let t = title;
  // Version + format markers (anywhere): "(OV)", "OmU", "DF", "3D"
  t = t.replace(/\([^)]*?(?:OV|OmU|OmeU|DF|stumm|silent|3D|IMAX)[^)]*\)/gi, "");
  t = t.replace(/\b(OV|OmU|OmeU|DF|stumm|silent|3D|IMAX)\b/gi, "");
  // Language-hint parentheticals: "(Telugu engl. UT)", "(OmeU)", "(franz. OmU)"
  t = t.replace(
    /\s*\([^)]*?(?:OmU|OmeU|UT|Untertitel|Originalfassung|Originalversion|Originalton|engl?\.|englisch|deutsch|franz\.?|french|spanisch|italienisch|original)[^)]*\)\s*$/i,
    "",
  );
  // Bare prefixes without colon ("Vorpremiere — Foo")
  t = t.replace(/^(vorpremiere|kinderkino|preview|premiere|special|sneak|klassiker)\s*[\-—–]\s*/i, "");
  // Wrapping quotes — German „…" or French «…»
  const quoted = t.match(WRAPPING_QUOTES_RE);
  if (quoted) t = quoted[1];
  // Trailing ", 2026" / " (2026)" duplicating the year
  t = t.replace(/\s*[,(]\s*(19|20)\d{2}\s*\)?\s*$/g, "");
  // Trailing "*" decoration some venues add to flag a special screening
  t = t.replace(/\s*\*+\s*$/g, "");
  t = t.replace(/\s+/g, " ").trim();
  return t;
}

/** Best-effort fallback when the cinema-house has bolted a series prefix
 *  in front of the film title. Strips up to two leading colon-delimited
 *  segments — "Schamlos Harmlos: Love Me Tender", "Aus der Isolation –
 *  Feministische Experimentalfilme: Daughter of the Moon",
 *  "Strickclub: Klassiker: Wanda". Only the part after the LAST colon is
 *  used, so legit franchise titles like "Mad Max: Fury Road" are
 *  unaffected because their first lookup succeeds before this fallback
 *  even runs. */
function tailAfterColon(title: string): string | undefined {
  const idx = title.lastIndexOf(":");
  if (idx === -1) return undefined;
  const tail = title.slice(idx + 1).trim();
  return tail.length >= 3 && tail.length < title.length ? tail : undefined;
}

function cacheKey(title: string, year: number | undefined): string {
  return `${title.toLowerCase()}|${year ?? "*"}`;
}

function hasFilmCinemaLabel(ev: CanonicalEvent): boolean {
  for (const l of ev.labels) if (l.label === "film:cinema") return true;
  return false;
}

async function searchTmdb(title: string, year: number | undefined, apiKey: string): Promise<TmdbSearchResult | null> {
  const params = new URLSearchParams({
    query: title,
    api_key: apiKey,
    language: "de-DE",
    include_adult: "false",
  });
  if (year) params.set("year", String(year));
  const url = `${TMDB_BASE}/search/movie?${params}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`tmdb ${res.status} for "${title}"`);
  const data = (await res.json()) as TmdbSearchResponse;
  return data.results?.[0] ?? null;
}

async function fetchTmdb(title: string, year: number | undefined, apiKey: string): Promise<TmdbCacheEntry | null> {
  // 1) Year-restricted search on the full title — covers current releases.
  let hit = await searchTmdb(title, year, apiKey);
  // 2) Drop the year. TMDb often has the wrong primary_release_year for
  //    restorations and arthouse re-releases of older films.
  if (!hit && year) hit = await searchTmdb(title, undefined, apiKey);
  // 3) Try the segment after the last colon — picks up the multi-word
  //    German cinema-house prefixes ("Schamlos Harmlos: …", "Aus der
  //    Isolation – Feministische Experimentalfilme: Daughter of the Moon")
  //    without risking false positives on franchise titles like
  //    "Mad Max: Fury Road", which already match at step 1.
  const tail = tailAfterColon(title);
  if (!hit && tail) {
    hit = await searchTmdb(tail, year, apiKey);
    if (!hit && year) hit = await searchTmdb(tail, undefined, apiKey);
  }
  if (!hit) return null;
  return { id: hit.id, poster: hit.poster_path ?? null };
}

/**
 * Mutates `events` in-place: sets `image_url` and `tmdb_id` on film:cinema
 * events that match a TMDb record. Cache is updated as we go. Returns
 * counts for the run summary.
 */
export async function enrichFilmPosters(
  events: CanonicalEvent[],
  opts: EnrichOptions,
): Promise<{ matched: number; cached: number; missing: number; skipped: number }> {
  const log = opts.log ?? (() => undefined);
  const maxLookups = opts.maxLookups ?? 300;
  const apiKey = opts.apiKey?.trim();

  let matched = 0;
  let cached = 0;
  let missing = 0;
  let skipped = 0;
  let live = 0;

  if (!apiKey) {
    log("tmdb: TMDB_API_KEY unset — poster enrichment skipped");
  }

  for (const ev of events) {
    if (ev.image_url && ev.tmdb_id) continue;
    if (!hasFilmCinemaLabel(ev)) continue;

    const title = normaliseTitle(ev.title);
    if (!title) continue;
    const year = extractYear(ev);
    const key = cacheKey(title, year);

    let entry = opts.cache[key];
    const hadCacheHit = key in opts.cache;

    if (!hadCacheHit) {
      if (!apiKey || live >= maxLookups) {
        skipped++;
        continue;
      }
      try {
        entry = await fetchTmdb(title, year, apiKey);
        opts.cache[key] = entry;
        live++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        log(`tmdb: lookup failed for "${title}" — ${msg}`);
        skipped++;
        continue;
      }
    } else {
      cached++;
    }

    if (!entry) {
      missing++;
      continue;
    }

    if (entry.poster && !ev.image_url) ev.image_url = `${POSTER_BASE}${entry.poster}`;
    if (!ev.tmdb_id) ev.tmdb_id = entry.id;
    matched++;
  }

  log(`tmdb: matched=${matched} (live=${live} cached=${cached}) missing=${missing} skipped=${skipped}`);
  return { matched, cached, missing, skipped };
}
