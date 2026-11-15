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
  es: string;
}

export const TMDB_GENRES: Record<number, GenreNames> = {
  // Movie genres
  28: { de: "Action", en: "Action", es: "Acción" },
  12: { de: "Abenteuer", en: "Adventure", es: "Aventura" },
  16: { de: "Animation", en: "Animation", es: "Animación" },
  35: { de: "Komödie", en: "Comedy", es: "Comedia" },
  80: { de: "Krimi", en: "Crime", es: "Crimen" },
  99: { de: "Dokumentarfilm", en: "Documentary", es: "Documental" },
  18: { de: "Drama", en: "Drama", es: "Drama" },
  10751: { de: "Familie", en: "Family", es: "Familia" },
  14: { de: "Fantasy", en: "Fantasy", es: "Fantasía" },
  36: { de: "Historie", en: "History", es: "Historia" },
  27: { de: "Horror", en: "Horror", es: "Terror" },
  10402: { de: "Musik", en: "Music", es: "Música" },
  9648: { de: "Mystery", en: "Mystery", es: "Misterio" },
  10749: { de: "Liebesfilm", en: "Romance", es: "Romance" },
  878: { de: "Science Fiction", en: "Science Fiction", es: "Ciencia ficción" },
  10770: { de: "TV-Film", en: "TV Movie", es: "Película de TV" },
  53: { de: "Thriller", en: "Thriller", es: "Suspense" },
  10752: { de: "Kriegsfilm", en: "War", es: "Bélica" },
  37: { de: "Western", en: "Western", es: "Western" },
  // TV-only genres (used when tmdb_kind === "tv")
  10759: { de: "Action & Adventure", en: "Action & Adventure", es: "Acción y aventura" },
  10762: { de: "Kids", en: "Kids", es: "Infantil" },
  10763: { de: "News", en: "News", es: "Noticias" },
  10764: { de: "Reality", en: "Reality", es: "Reality" },
  10765: { de: "Sci-Fi & Fantasy", en: "Sci-Fi & Fantasy", es: "Ciencia ficción y fantasía" },
  10766: { de: "Soap", en: "Soap", es: "Telenovela" },
  10767: { de: "Talk", en: "Talk", es: "Talk show" },
  10768: { de: "War & Politics", en: "War & Politics", es: "Bélica y política" },
};

export function genreNames(ids: readonly number[], locale: "de" | "en" | "es"): string[] {
  const out: string[] = [];
  for (const id of ids) {
    const g = TMDB_GENRES[id];
    if (g) out.push(g[locale]);
  }
  return out;
}
