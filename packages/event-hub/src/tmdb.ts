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
import { retryFetch } from "@museumsufer/core/retry-fetch";
import PQueue from "p-queue";
import type { TmdbCacheEntry } from "../data/tmdb-cache";
import { translateBatch } from "./deepl";
import { fetchOmdb } from "./omdb";
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
  genre_ids?: number[];
  vote_average?: number;
  vote_count?: number;
}

interface TmdbTvResult {
  id: number;
  poster_path: string | null;
  overview?: string | null;
  first_air_date?: string | null;
  original_name?: string;
  name?: string;
  genre_ids?: number[];
  vote_average?: number;
  vote_count?: number;
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
  /** DeepL API keys (comma-separated) for German→English fallback when
   *  TMDb has a German overview but no English one. Multiple keys allow
   *  free-tier quota failover. */
  deeplApiKeys?: string;
  /** OMDb API key (free tier, 1000 req/day) for Rotten Tomatoes critic
   *  % + IMDb rating + IMDb vote count. Skipped silently when unset. */
  omdbApiKey?: string;
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
  // Trailing single-word parenthetical genre/category label the cinema
  // appended for the audience: "Die reichste Frau der Welt ( Komödie )",
  // "Foo (Drama)", "Bar ( Thriller)". Bounded length + letters-only
  // keeps longer parentheticals (original-language titles, "(Director's
  // Cut)") in place.
  t = t.replace(/\s*\(\s*[A-Za-zÄÖÜäöüß]{3,18}\s*\)\s*$/g, "");
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
  const res = await retryFetch(
    `${TMDB_BASE}/search/movie?${params}`,
    { headers: { Accept: "application/json" } },
    { label: `tmdb movie "${title}"` },
  );
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
  const res = await retryFetch(
    `${TMDB_BASE}/search/tv?${params}`,
    { headers: { Accept: "application/json" } },
    { label: `tmdb tv "${title}"` },
  );
  if (!res.ok) throw new Error(`tmdb tv ${res.status} for "${title}"`);
  const data = (await res.json()) as TmdbSearchResponse<TmdbTvResult>;
  return data.results?.[0] ?? null;
}

async function fetchEnglishDetails(
  kind: "movie" | "tv",
  id: number,
  apiKey: string,
): Promise<{ title?: string; overview?: string }> {
  const params = new URLSearchParams({ api_key: apiKey, language: "en-US" });
  const res = await retryFetch(
    `${TMDB_BASE}/${kind}/${id}?${params}`,
    { headers: { Accept: "application/json" } },
    { label: `tmdb ${kind} ${id} details` },
  );
  if (!res.ok) return {};
  const data = (await res.json()) as { title?: string | null; name?: string | null; overview?: string | null };
  const title = (data.title ?? data.name)?.trim();
  const overview = data.overview?.trim();
  return {
    title: title && title.length > 0 ? title : undefined,
    overview: overview && overview.length > 0 ? overview : undefined,
  };
}

function hitTitle(hit: TmdbMovieResult | TmdbTvResult): string | undefined {
  // `title` is on movie results; `name` is on TV results. The de-DE search
  // populates the localised value when TMDb has a translation, otherwise
  // returns the canonical (usually English) string.
  const movie = (hit as TmdbMovieResult).title;
  if (movie) return movie.trim() || undefined;
  const tv = (hit as TmdbTvResult).name;
  return tv?.trim() || undefined;
}

/** Fetch IMDb id from /{kind}/{id}/external_ids — needed for the OMDb
 *  pivot (RT critic + IMDb rating). Returns undefined on any error so
 *  the en-US detail call still wins the rest of the entry. */
async function fetchImdbId(kind: "movie" | "tv", id: number, apiKey: string): Promise<string | undefined> {
  const params = new URLSearchParams({ api_key: apiKey });
  const res = await retryFetch(
    `${TMDB_BASE}/${kind}/${id}/external_ids?${params}`,
    { headers: { Accept: "application/json" } },
    { label: `tmdb ${kind} ${id} external_ids` },
  );
  if (!res.ok) return undefined;
  const data = (await res.json()) as { imdb_id?: string | null };
  const v = data.imdb_id?.trim();
  return v && /^tt\d{6,}$/.test(v) ? v : undefined;
}

async function toEntry(
  hit: TmdbMovieResult | TmdbTvResult | null,
  kind: "movie" | "tv",
  apiKey: string,
): Promise<TmdbCacheEntry | null> {
  if (!hit) return null;
  // Run the en-US detail call + the external_ids call in parallel —
  // they're independent and we want both. Either may fail without
  // sinking the entry.
  const [en, imdb_id] = await Promise.all([
    fetchEnglishDetails(kind, hit.id, apiKey).catch((): { title?: string; overview?: string } => ({})),
    fetchImdbId(kind, hit.id, apiKey).catch(() => undefined),
  ]);
  return {
    id: hit.id,
    poster: hit.poster_path ?? null,
    title: hitTitle(hit),
    title_en: en.title,
    overview: hit.overview?.trim() || undefined,
    overview_en: en.overview,
    kind,
    genre_ids: hit.genre_ids?.length ? hit.genre_ids : undefined,
    vote_average: typeof hit.vote_average === "number" ? hit.vote_average : undefined,
    vote_count: typeof hit.vote_count === "number" ? hit.vote_count : undefined,
    imdb_id,
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
    // Refresh existing positive entries that pre-date a schema growth.
    // Any missing field triggers a single refetch that back-fills all of
    // them. `vote_count` doubles as a sentinel for the score pair since
    // 0 is a legitimate average but a missing count means we never
    // recorded one.
    const needsRefresh =
      cached !== null &&
      cached !== undefined &&
      (cached.kind === undefined ||
        cached.title === undefined ||
        cached.title_en === undefined ||
        cached.overview === undefined ||
        cached.overview_en === undefined ||
        cached.genre_ids === undefined ||
        cached.vote_count === undefined ||
        cached.imdb_id === undefined);

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

  // Pass 2b: DeepL DE→EN fallback for cache entries that have a German
  // overview but no English one. Typical for older European arthouse
  // titles and operas. Batched so a handful of films cost a single API
  // call rather than one per row.
  let translated = 0;
  if (opts.deeplApiKeys?.trim()) {
    const needsTranslation: Array<{ key: string; text: string }> = [];
    for (const [key, entry] of Object.entries(opts.cache)) {
      if (!entry) continue;
      if (entry.overview && !entry.overview_en) needsTranslation.push({ key, text: entry.overview });
    }
    if (needsTranslation.length > 0) {
      const results = await translateBatch(
        needsTranslation.map((x) => x.text),
        { apiKeys: opts.deeplApiKeys, log },
      );
      for (let i = 0; i < needsTranslation.length; i++) {
        const t = results[i];
        if (!t) continue;
        const entry = opts.cache[needsTranslation[i].key];
        if (entry) {
          entry.overview_en = t;
          translated++;
        }
      }
      log(`tmdb: deepl filled overview_en for ${translated}/${needsTranslation.length} entries`);
    }
  }

  // Pass 2c: OMDb pivot for the ratings TMDb doesn't carry — Rotten
  // Tomatoes critic % + IMDb rating. Keyed on imdb_id which TMDb's
  // external_ids endpoint already populated in pass 2. Fanned out
  // through the same PQueue as the TMDb lookups; one OMDb call per
  // cache entry that has imdb_id but is missing the ratings.
  let omdbMatched = 0;
  let omdbFailed = 0;
  const omdbKey = opts.omdbApiKey?.trim();
  if (omdbKey) {
    const pendingOmdb: Array<{ cacheKey: string; imdb_id: string }> = [];
    for (const [cacheKey, entry] of Object.entries(opts.cache)) {
      if (!entry?.imdb_id) continue;
      // Skip when we've already tried — rt_critic + imdb_rating cleared
      // means there's nothing to fetch. We use a sentinel-less check:
      // if neither has been populated AND the entry has an imdb_id, the
      // entry hasn't been queried yet (or was queried before this
      // schema). Re-query is cheap and free-tier-safe.
      // Re-query when rt_url is missing too — existing positive entries
      // pre-date the field, and OMDb's tomatoURL is the only RT deep
      // link we have. Free-tier-safe (~250 calls total).
      if (
        (entry.rt_critic === undefined && entry.imdb_rating === undefined) ||
        (entry.rt_critic !== undefined && entry.rt_url === undefined)
      ) {
        pendingOmdb.push({ cacheKey, imdb_id: entry.imdb_id });
      }
    }
    if (pendingOmdb.length > 0) {
      const omdbQueue = new PQueue({ concurrency: opts.concurrency ?? 8 });
      for (const p of pendingOmdb) {
        omdbQueue.add(async () => {
          try {
            const extras = await fetchOmdb(p.imdb_id, omdbKey);
            const entry = opts.cache[p.cacheKey];
            if (!entry) return;
            if (typeof extras.rt_critic === "number") entry.rt_critic = extras.rt_critic;
            if (extras.rt_url) entry.rt_url = extras.rt_url;
            if (typeof extras.imdb_rating === "number") entry.imdb_rating = extras.imdb_rating;
            if (typeof extras.imdb_votes === "number") entry.imdb_votes = extras.imdb_votes;
            if (extras.rt_critic !== undefined || extras.imdb_rating !== undefined) omdbMatched++;
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            log(`omdb: lookup failed for ${p.imdb_id} — ${msg}`);
            omdbFailed++;
          }
        });
      }
      await omdbQueue.onIdle();
      log(`omdb: matched=${omdbMatched}/${pendingOmdb.length} (failed=${omdbFailed})`);
    }
  }

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
    if (entry.title) ev.title_de = entry.title;
    if (entry.title_en) ev.title_en = entry.title_en;
    if (entry.genre_ids?.length) ev.tmdb_genre_ids = entry.genre_ids;
    if (typeof entry.vote_average === "number") ev.tmdb_vote_average = entry.vote_average;
    if (typeof entry.vote_count === "number") ev.tmdb_vote_count = entry.vote_count;
    if (entry.imdb_id) ev.imdb_id = entry.imdb_id;
    if (typeof entry.rt_critic === "number") ev.rt_critic = entry.rt_critic;
    if (entry.rt_url) ev.rt_url = entry.rt_url;
    if (typeof entry.imdb_rating === "number") ev.imdb_rating = entry.imdb_rating;
    if (typeof entry.imdb_votes === "number") ev.imdb_votes = entry.imdb_votes;
    if (!ev.tmdb_id) ev.tmdb_id = entry.id;
    if (entry.kind && !ev.tmdb_kind) ev.tmdb_kind = entry.kind;
    matched++;
  }

  log(
    `tmdb: matched=${matched} (live=${liveCount} cached=${cachedHits} refreshed=${refreshedCount}) missing=${missing} skipped=${skippedCount}`,
  );
  return { matched, refreshed: refreshedCount, cached: cachedHits, missing, skipped: skippedCount };
}
