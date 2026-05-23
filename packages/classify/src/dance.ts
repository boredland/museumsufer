export type DanceGenre = "ballet" | "contemporary" | "urban" | "tanztheater" | "world";

export const DANCE_GENRES: readonly DanceGenre[] = ["ballet", "contemporary", "urban", "tanztheater", "world"] as const;

/**
 * Priority-ordered keyword tables: ballet (classical repertoire titles are the
 * most distinctive signal) → urban → world → tanztheater → contemporary. First
 * match wins. Case-insensitive substring match against title + subtitle +
 * description.
 *
 * `contemporary` is the natural fallback — it covers most house-style
 * programming at Mousonturm, DFDC, and the Tanzfestival Rhein-Main when no
 * sharper signal is present. Callers should pass it as `fallback` explicitly
 * when they want to deviate.
 */
const KEYWORDS: ReadonlyArray<{ genre: DanceGenre; needles: readonly string[] }> = [
  {
    genre: "ballet",
    needles: [
      "ballett",
      "ballet",
      "schwanensee",
      "nussknacker",
      "giselle",
      "coppélia",
      "coppelia",
      "dornröschen",
      "pas de deux",
      "petipa",
      "balanchine",
      "spitzentanz",
      "klassischer tanz",
      "klassisches ballett",
      "bayadère",
      "don quixote",
    ],
  },
  {
    genre: "urban",
    needles: [
      "hip-hop",
      "hip hop",
      "hiphop",
      "breaking",
      "breakdance",
      "krump",
      "voguing",
      "street dance",
      "streetdance",
      "urban dance",
    ],
  },
  {
    genre: "world",
    needles: [
      "flamenco",
      "tango",
      "butoh",
      "kathak",
      "bharatanatyam",
      "capoeira",
      "salsa",
      "samba",
      "schwerttanz",
      "irischer tanz",
      "indischer tanz",
      "afrotanz",
    ],
  },
  {
    genre: "tanztheater",
    needles: ["tanztheater", "physical theater", "physical theatre", "pina bausch"],
  },
];

export function classifyDance(
  title: string,
  subtitle?: string | null,
  description?: string | null,
  fallback: DanceGenre = "contemporary",
): DanceGenre {
  const haystack = [title, subtitle, description].filter(Boolean).join(" ").toLowerCase();
  if (!haystack) return fallback;
  for (const bucket of KEYWORDS) {
    for (const needle of bucket.needles) {
      if (haystack.includes(needle)) return bucket.genre;
    }
  }
  return fallback;
}

const DANCE_INDICATORS_RE = /\b(tanz|tanzabend|ballett|ballet|choreogra|dance|performance|tanztheater)\b/i;

/**
 * Cheap probe: does this look like a dance performance based on title +
 * description? Used by the stage-label resolver to decide whether to invoke
 * `classifyDance` at all. `performance` is included because Haus am Dom and
 * a few other venues use it as a Tanz/performance umbrella category.
 */
export function looksLikeDance(title: string, description?: string | null): boolean {
  const haystack = `${title} ${description ?? ""}`;
  return DANCE_INDICATORS_RE.test(haystack);
}
