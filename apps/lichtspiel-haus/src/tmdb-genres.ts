/**
 * TMDb genre id → localised name. TMDb publishes the lists at
 * /3/genre/{movie|tv}/list — they're small, stable, and ids are shared
 * across all locales. Cheaper to hardcode than to fetch + ship.
 *
 * Movie ids and TV ids share some values (Drama=18, Comedy=35, …) and
 * diverge for a few (TV has 10759 Action & Adventure, 10765 Sci-Fi &
 * Fantasy, etc.). Both tables coexist in this map — collisions don't
 * happen because TMDb assigned movie + TV genres from disjoint ranges
 * for the diverging ones.
 */

export interface GenreNames {
  de: string;
  en: string;
}

export const TMDB_GENRES: Record<number, GenreNames> = {
  // Movie genres
  28: { de: "Action", en: "Action" },
  12: { de: "Abenteuer", en: "Adventure" },
  16: { de: "Animation", en: "Animation" },
  35: { de: "Komödie", en: "Comedy" },
  80: { de: "Krimi", en: "Crime" },
  99: { de: "Dokumentarfilm", en: "Documentary" },
  18: { de: "Drama", en: "Drama" },
  10751: { de: "Familie", en: "Family" },
  14: { de: "Fantasy", en: "Fantasy" },
  36: { de: "Historie", en: "History" },
  27: { de: "Horror", en: "Horror" },
  10402: { de: "Musik", en: "Music" },
  9648: { de: "Mystery", en: "Mystery" },
  10749: { de: "Liebesfilm", en: "Romance" },
  878: { de: "Science Fiction", en: "Science Fiction" },
  10770: { de: "TV-Film", en: "TV Movie" },
  53: { de: "Thriller", en: "Thriller" },
  10752: { de: "Kriegsfilm", en: "War" },
  37: { de: "Western", en: "Western" },
  // TV-only genres (used when tmdb_kind === "tv")
  10759: { de: "Action & Adventure", en: "Action & Adventure" },
  10762: { de: "Kids", en: "Kids" },
  10763: { de: "News", en: "News" },
  10764: { de: "Reality", en: "Reality" },
  10765: { de: "Sci-Fi & Fantasy", en: "Sci-Fi & Fantasy" },
  10766: { de: "Soap", en: "Soap" },
  10767: { de: "Talk", en: "Talk" },
  10768: { de: "War & Politics", en: "War & Politics" },
};

export function genreNames(ids: readonly number[], locale: "de" | "en"): string[] {
  const out: string[] = [];
  for (const id of ids) {
    const g = TMDB_GENRES[id];
    if (g) out.push(g[locale]);
  }
  return out;
}
