/**
 * OMDb pivot for the supplementary ratings TMDb doesn't carry:
 *   - Rotten Tomatoes critic % (the canonical "tomatometer")
 *   - IMDb rating 0–10 + vote count
 *
 * OMDb is queried by IMDb id (which we get from TMDb's
 * /{kind}/{id}/external_ids endpoint as part of the existing
 * enrichment pass). One OMDb call per matched film, results stored on
 * the same TmdbCacheEntry so future runs hit the cache.
 *
 * Free tier: 1000 requests/day. We have ~250 cached films, so a full
 * backfill costs ~250 calls — comfortably under the limit even at
 * worst case.
 */

import { retryFetch } from "@museumsufer/core/retry-fetch";

const OMDB_URL = "https://www.omdbapi.com/";

export interface OmdbExtras {
  rt_critic?: number; // 0–100
  rt_url?: string; // canonical rottentomatoes.com/m/<slug> page
  imdb_rating?: number; // 0.0–10.0
  imdb_votes?: number;
}

interface OmdbResponse {
  Response?: "True" | "False";
  imdbRating?: string | null;
  imdbVotes?: string | null;
  Ratings?: Array<{ Source: string; Value: string }>;
  tomatoURL?: string | null;
}

/** Fetch RT + IMDb numbers for one IMDb id. Accepts one or more API keys;
 *  rotates to the next key on 401 (invalid key) or 429 (rate-limited).
 *  Returns an empty object when OMDb has the film but no ratings, or when
 *  all keys are exhausted — the caller treats "no ratings found" the same
 *  as "lookup failed" (won't retry next run because the imdb_id is still
 *  cached). */
export async function fetchOmdb(imdbId: string, apiKey: string | string[]): Promise<OmdbExtras> {
  const keys = Array.isArray(apiKey) ? apiKey : [apiKey];
  let lastError: Error | undefined;

  for (const key of keys) {
    const params = new URLSearchParams({ i: imdbId, apikey: key, tomatoes: "true" });
    let res: Response;
    try {
      res = await retryFetch(
        `${OMDB_URL}?${params}`,
        { headers: { Accept: "application/json" } },
        { label: `omdb ${imdbId}`, retries: 1, requestTimeout: 10_000 },
      );
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      continue; // network/timeout → try next key
    }

    if (res.status === 401 || res.status === 429) {
      lastError = new Error(`omdb ${res.status} for ${imdbId} (key ${key.slice(0, 4)}…)`);
      continue; // bad key or rate-limited → try next key
    }

    if (!res.ok) throw new Error(`omdb ${res.status} for ${imdbId}`);

    const data = (await res.json()) as OmdbResponse;
    if (data.Response !== "True") return {};

    const out: OmdbExtras = {};
    const rt = data.Ratings?.find((r) => r.Source === "Rotten Tomatoes");
    if (rt) {
      const m = rt.Value.match(/(\d+)\s*%/);
      if (m) {
        const n = Number(m[1]);
        if (Number.isFinite(n) && n >= 0 && n <= 100) out.rt_critic = n;
      }
    }
    if (data.imdbRating && data.imdbRating !== "N/A") {
      const n = Number(data.imdbRating);
      if (Number.isFinite(n) && n > 0 && n <= 10) out.imdb_rating = n;
    }
    if (data.imdbVotes && data.imdbVotes !== "N/A") {
      const n = Number(data.imdbVotes.replace(/,/g, ""));
      if (Number.isFinite(n) && n > 0) out.imdb_votes = n;
    }
    if (data.tomatoURL && data.tomatoURL !== "N/A" && data.tomatoURL.startsWith("https://www.rottentomatoes.com/")) {
      out.rt_url = data.tomatoURL;
    }
    return out;
  }

  // All keys exhausted
  throw lastError ?? new Error(`omdb: all keys exhausted for ${imdbId}`);
}
