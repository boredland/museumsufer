/**
 * Post-scrape enrichment for `film:cinema` events.
 *
 * For events that match a TMDb (or TMDb-TV) record we set:
 *   - image_url   ← TMDb poster CDN
 *   - description ← TMDb overview (overrides the cinema's copy — usually
 *                  the cinema's is one-line marketing chrome, TMDb's is
 *                  a real synopsis)
 *   - tmdb_id     ← the matched record's id
 *   - tmdb_kind   ← "movie" or "tv" — drives /movie/{id} vs /tv/{id}
 *                  deep-link path on themoviedb.org
 *
 * Cache persists across runs in packages/event-hub/data/tmdb-cache.ts.
 * Cache entries that lack `overview` or `kind` are silently re-fetched on
 * the next pass to back-fill the new fields — no manual invalidation
 * required when the schema grows.
 *
 * Skipped silently when TMDB_API_KEY is unset.
 */
import PQueue from "p-queue";
import type { TmdbCacheEntry } from "../data/tmdb-cache";
import type { CanonicalEvent } from "./types";

const TMDB_BASE = "https://api.themoviedb.org/3";
const POSTER_BASE = "https://image.tmdb.org/t/p/w500";

interface TmdbMovieResult {
  id: number;
  poster_path: string | null;
  overview?: string | null;
  release_date?: string | null;
  original_title?: string;
  title?: string;
}

interface TmdbTvResult {
  id: number;
  poster_path: string | null;
  overview?: string | null;
  first_air_date?: string | null;
  original_name?: string;
  name?: string;
}

interface TmdbSearchResponse<T> {
  results?: T[];
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
  /** Concurrent in-flight TMDb requests. TMDb's published limit is ~50
   *  req/s; we keep well below that to be polite. */
  concurrency?: number;
}

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

/** Curly-quote pairs around the title — common on Filmforum Höchst /
 *  Kinopolis programmes: „Zirkuskind", «Le Quai des Brumes», "Mary". */
const WRAPPING_QUOTES_RE = /^[„"«»"']\s*(.+?)\s*[""»«"'.]\s*$/;

/** Quoted title fragment embedded in a longer venue listing: when the venue
 *  writes Kino4Kids „Zirkuskind" the film title is the quoted portion, the
 *  prefix is venue chrome. */
const INNER_QUOTED_RE = /[„"«»](.+?)[""»«]/;

function normaliseTitle(title: string): string {
  let t = title;
  // Version + format markers anywhere: (OV), OmU, DF, 3D, IMAX
  t = t.replace(/\([^)]*?(?:OV|OmU|OmeU|DF|stumm|silent|3D|IMAX)[^)]*\)/gi, "");
  t = t.replace(/\b(OV|OmU|OmeU|DF|stumm|silent|3D|IMAX)\b/gi, "");
  // Language-hint parentheticals: "(Telugu engl. UT)", "(franz. OmU)"
  t = t.replace(
    /\s*\([^)]*?(?:OmU|OmeU|UT|Untertitel|Originalfassung|Originalversion|Originalton|engl?\.|englisch|deutsch|franz\.?|french|spanisch|italienisch|original)[^)]*\)\s*$/i,
    "",
  );
  // Bare prefixes without colon ("Vorpremiere — Foo")
  t = t.replace(/^(vorpremiere|kinderkino|preview|premiere|special|sneak|klassiker)\s*[-—–]\s*/i, "");
  // Wrapping quotes (whole title is quoted)
  const quoted = t.match(WRAPPING_QUOTES_RE);
  if (quoted) t = quoted[1];
  // Trailing year duplicating the structured field: " (2026)", ", 2026"
  t = t.replace(/\s*[,(]\s*(19|20)\d{2}\s*\)?\s*$/g, "");
  // Trailing asterisks ("Casablanca *") flagging a special screening
  t = t.replace(/\s*\*+\s*$/g, "");
  t = t.replace(/\s+/g, " ").trim();
  return t;
}

/** Fallback extractors that take a normalised title and yield candidates
 *  to retry when the original search returned nothing. Order matters —
 *  most-specific first. */
function* candidateFallbacks(title: string): Generator<string> {
  // Inner-quoted segment: "Kino4Kids „Zirkuskind"" → "Zirkuskind"
  const inner = title.match(INNER_QUOTED_RE);
  if (inner) yield inner[1].trim();
  // Tail after the last colon — German cinema-house series prefix
  const colon = title.lastIndexOf(":");
  if (colon !== -1) {
    const tail = title.slice(colon + 1).trim();
    if (tail.length >= 3 && tail.length < title.length) yield tail;
  }
  // Tail after the last hyphen/en-dash/em-dash. Last resort, only fires
  // after the colon-tail above already missed. "Alpen Film Festival 2026
  // - Passion" → "Passion". Real-film hyphenated titles like "Spider-Man"
  // match in step 1 long before this runs.
  const dashMatch = title.match(/^(.+?)[ \t]+[-–—][ \t]+(.+)$/);
  if (dashMatch) {
    const tail = dashMatch[2].trim();
    if (tail.length >= 3) yield tail;
  }
}

function cacheKey(title: string, year: number | undefined): string {
  return `${title.toLowerCase()}|${year ?? "*"}`;
}

function hasFilmCinemaLabel(ev: CanonicalEvent): boolean {
  for (const l of ev.labels) if (l.label === "film:cinema") return true;
  return false;
}

async function searchTmdbMovie(
  title: string,
  year: number | undefined,
  apiKey: string,
): Promise<TmdbMovieResult | null> {
  const params = new URLSearchParams({
    query: title,
    api_key: apiKey,
    language: "de-DE",
    include_adult: "false",
  });
  if (year) params.set("year", String(year));
  const res = await fetch(`${TMDB_BASE}/search/movie?${params}`, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`tmdb movie ${res.status} for "${title}"`);
  const data = (await res.json()) as TmdbSearchResponse<TmdbMovieResult>;
  return data.results?.[0] ?? null;
}

async function searchTmdbTv(title: string, year: number | undefined, apiKey: string): Promise<TmdbTvResult | null> {
  const params = new URLSearchParams({
    query: title,
    api_key: apiKey,
    language: "de-DE",
    include_adult: "false",
  });
  if (year) params.set("first_air_date_year", String(year));
  const res = await fetch(`${TMDB_BASE}/search/tv?${params}`, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`tmdb tv ${res.status} for "${title}"`);
  const data = (await res.json()) as TmdbSearchResponse<TmdbTvResult>;
  return data.results?.[0] ?? null;
}

async function fetchEnglishOverview(kind: "movie" | "tv", id: number, apiKey: string): Promise<string | undefined> {
  const params = new URLSearchParams({ api_key: apiKey, language: "en-US" });
  const res = await fetch(`${TMDB_BASE}/${kind}/${id}?${params}`, { headers: { Accept: "application/json" } });
  if (!res.ok) return undefined;
  const data = (await res.json()) as { overview?: string | null };
  const overview = data.overview?.trim();
  return overview && overview.length > 0 ? overview : undefined;
}

async function toEntry(
  hit: TmdbMovieResult | TmdbTvResult | null,
  kind: "movie" | "tv",
  apiKey: string,
): Promise<TmdbCacheEntry | null> {
  if (!hit) return null;
  // Fire the English overview lookup alongside the implicit-await caller;
  // failures here don't sink the whole match, they just leave overview_en
  // undefined and apps fall back to the German one.
  const overview_en = await fetchEnglishOverview(kind, hit.id, apiKey).catch(() => undefined);
  return {
    id: hit.id,
    poster: hit.poster_path ?? null,
    overview: hit.overview?.trim() || undefined,
    overview_en,
    kind,
  };
}

/** Walk movie-search → TV-search through the title and all fallbacks.
 *  Stops at the first hit. */
async function fetchTmdb(title: string, year: number | undefined, apiKey: string): Promise<TmdbCacheEntry | null> {
  const candidates = [title, ...candidateFallbacks(title)];
  // First pass: movie search across every candidate.
  for (const c of candidates) {
    let hit = await searchTmdbMovie(c, year, apiKey);
    if (!hit && year) hit = await searchTmdbMovie(c, undefined, apiKey);
    if (hit) return toEntry(hit, "movie", apiKey);
  }
  // Last resort: TV search on the original title (covers MET Opera HD
  // and similar broadcasts of stage productions). Only the original
  // title, not the fallbacks — the fallbacks are tuned for film name
  // shapes and would generate noise here.
  let tv = await searchTmdbTv(title, year, apiKey);
  if (!tv && year) tv = await searchTmdbTv(title, undefined, apiKey);
  return toEntry(tv, "tv", apiKey);
}

export async function enrichFilmPosters(
  events: CanonicalEvent[],
  opts: EnrichOptions,
): Promise<{ matched: number; refreshed: number; cached: number; missing: number; skipped: number }> {
  const log = opts.log ?? (() => undefined);
  const maxLookups = opts.maxLookups ?? 500;
  const apiKey = opts.apiKey?.trim();

  if (!apiKey) {
    log("tmdb: TMDB_API_KEY unset — poster enrichment skipped");
    return { matched: 0, refreshed: 0, cached: 0, missing: 0, skipped: 0 };
  }

  // Pass 1: walk events, decide what each one needs. Collect the unique
  // lookups so the same title screening multiple times only triggers one
  // network call no matter how many cache misses share the key.
  type Pending = { key: string; title: string; year: number | undefined; refresh: boolean };
  const pendingByKey = new Map<string, Pending>();
  const eventKeys: Array<{ ev: CanonicalEvent; key: string } | null> = [];

  for (const ev of events) {
    if (!hasFilmCinemaLabel(ev)) {
      eventKeys.push(null);
      continue;
    }
    const title = normaliseTitle(ev.title);
    if (!title) {
      eventKeys.push(null);
      continue;
    }
    const year = extractYear(ev);
    const key = cacheKey(title, year);
    eventKeys.push({ ev, key });

    const cached = opts.cache[key];
    const hadHit = key in opts.cache;
    // Refresh existing positive entries that pre-date a schema growth —
    // missing `kind`, missing German overview, or missing English overview.
    // One refetch back-fills all three at once.
    const needsRefresh =
      cached !== null &&
      cached !== undefined &&
      (cached.kind === undefined || cached.overview === undefined || cached.overview_en === undefined);

    if ((!hadHit || needsRefresh) && !pendingByKey.has(key) && pendingByKey.size < maxLookups) {
      pendingByKey.set(key, { key, title, year, refresh: needsRefresh });
    }
  }

  // Pass 2: fan out the lookups concurrently. PQueue uses the same library
  // the runner already pulls in, no new dependency.
  const queue = new PQueue({ concurrency: opts.concurrency ?? 8 });
  let liveCount = 0;
  let refreshedCount = 0;
  let skippedCount = 0;
  for (const p of pendingByKey.values()) {
    queue.add(async () => {
      try {
        const fresh = await fetchTmdb(p.title, p.year, apiKey);
        opts.cache[p.key] = fresh;
        liveCount++;
        if (p.refresh) refreshedCount++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        log(`tmdb: lookup failed for "${p.title}" — ${msg}`);
        skippedCount++;
      }
    });
  }
  await queue.onIdle();

  // Pass 3: project the (now-complete) cache back onto events.
  let matched = 0;
  let cachedHits = 0;
  let missing = 0;
  for (const item of eventKeys) {
    if (!item) continue;
    const { ev, key } = item;
    const entry = opts.cache[key];
    if (entry === null || entry === undefined) {
      if (key in opts.cache) missing++;
      else skippedCount++;
      continue;
    }
    if (!pendingByKey.has(key)) cachedHits++;
    if (entry.poster && !ev.image_url) ev.image_url = `${POSTER_BASE}${entry.poster}`;
    if (entry.overview) ev.description = entry.overview;
    if (entry.overview_en) ev.description_en = entry.overview_en;
    if (!ev.tmdb_id) ev.tmdb_id = entry.id;
    if (entry.kind && !ev.tmdb_kind) ev.tmdb_kind = entry.kind;
    matched++;
  }

  log(
    `tmdb: matched=${matched} (live=${liveCount} cached=${cachedHits} refreshed=${refreshedCount}) missing=${missing} skipped=${skippedCount}`,
  );
  return { matched, refreshed: refreshedCount, cached: cachedHits, missing, skipped: skippedCount };
}
