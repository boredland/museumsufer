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

/** Fetch RT + IMDb numbers for one IMDb id. Returns an empty object when
 *  OMDb has the film but no ratings, or when the API errors — the caller
 *  treats "no ratings found" the same as "lookup failed" (won't retry next
 *  run because the imdb_id is still cached). */
export async function fetchOmdb(imdbId: string, apiKey: string): Promise<OmdbExtras> {
  const params = new URLSearchParams({ i: imdbId, apikey: apiKey, tomatoes: "true" });
  const res = await fetch(`${OMDB_URL}?${params}`, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`omdb ${res.status} for ${imdbId}`);
  const data = (await res.json()) as OmdbResponse;
  if (data.Response !== "True") return {};

  const out: OmdbExtras = {};
  // Rotten Tomatoes critic % comes through the Ratings array.
  const rt = data.Ratings?.find((r) => r.Source === "Rotten Tomatoes");
  if (rt) {
    const m = rt.Value.match(/(\d+)\s*%/);
    if (m) {
      const n = Number(m[1]);
      if (Number.isFinite(n) && n >= 0 && n <= 100) out.rt_critic = n;
    }
  }
  // IMDb rating + vote count are top-level on the OMDb response.
  if (data.imdbRating && data.imdbRating !== "N/A") {
    const n = Number(data.imdbRating);
    if (Number.isFinite(n) && n > 0 && n <= 10) out.imdb_rating = n;
  }
  if (data.imdbVotes && data.imdbVotes !== "N/A") {
    const n = Number(data.imdbVotes.replace(/,/g, ""));
    if (Number.isFinite(n) && n > 0) out.imdb_votes = n;
  }
  // tomatoURL: most of the other tomato* fields are deprecated to "N/A",
  // but the URL still resolves to the canonical RT film page.
  if (data.tomatoURL && data.tomatoURL !== "N/A" && data.tomatoURL.startsWith("https://www.rottentomatoes.com/")) {
    out.rt_url = data.tomatoURL;
  }
  return out;
}
