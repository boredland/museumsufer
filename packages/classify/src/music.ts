export type MusicGenre = "classical" | "jazz" | "sacred" | "world" | "experimental" | "chamber";

export const MUSIC_GENRES: readonly MusicGenre[] = [
  "classical",
  "jazz",
  "sacred",
  "world",
  "experimental",
  "chamber",
] as const;

/**
 * Priority-ordered keyword tables: sacred (most distinctive) → jazz → world →
 * experimental → chamber → classical. First match wins. Case-insensitive
 * substring match against the combined title + subtitle + description.
 */
const KEYWORDS: ReadonlyArray<{ genre: MusicGenre; needles: readonly string[] }> = [
  {
    genre: "sacred",
    needles: [
      "kantate",
      "messe",
      "requiem",
      "choral",
      "orgel",
      "vesper",
      "motette",
      "passion",
      "oratorium",
      "gospel",
      "gottesdienst",
      "kirche",
      "kirchenmusik",
      "liturgie",
      "magnificat",
      "te deum",
      "stabat mater",
      "bachvesper",
    ],
  },
  {
    genre: "jazz",
    needles: [
      "jazz",
      "bebop",
      "swing",
      "fusion",
      "bigband",
      "big band",
      "quartet",
      "quartett",
      "trio",
      "combo",
      "improvis",
    ],
  },
  {
    genre: "world",
    needles: ["weltmusik", "flamenco", "folk", "folklore", "klezmer", "latin", "tango", "fado", "roma"],
  },
  {
    genre: "experimental",
    needles: ["elektroakustisch", "experimentell", "neue musik", "avantgarde", "computer music", "klangkunst"],
  },
  {
    genre: "chamber",
    needles: [
      "kammerkonzert",
      "kammermusik",
      "liederabend",
      "chanson",
      "streichquartett",
      "klaviertrio",
      "klavierquartett",
    ],
  },
  {
    genre: "classical",
    needles: [
      "sinfoniekonzert",
      "sinfonie",
      "symphonie",
      "konzert für",
      "sonate",
      "klavierabend",
      "orchester",
      "recital",
      "orchesterkonzert",
    ],
  },
];

export function classifyMusic(
  title: string,
  subtitle?: string | null,
  description?: string | null,
  fallback: MusicGenre = "classical",
): MusicGenre {
  const haystack = [title, subtitle, description].filter(Boolean).join(" ").toLowerCase();
  if (!haystack) return fallback;
  for (const bucket of KEYWORDS) {
    for (const needle of bucket.needles) {
      if (haystack.includes(needle)) return bucket.genre;
    }
  }
  return fallback;
}

const MUSIC_INDICATORS_RE =
  /\b(konzert|jazz|swing|bigband|big band|chor(?:konzert)?|orchester|quartett|quintett|sextett|liederabend|musikabend|matinée|matinee|kammermusik|kammerkonzert|recital|sinfonie|symphonie|sonate|kantate|messe|requiem|oratorium|live[- ]musik)\b/i;
const LITERARY_INDICATORS_RE =
  /\b(lesung|liest|buchvorstellung|buchpräsentation|buchpremiere|autorenlesung|autor:in)\b/i;

/**
 * Cheap probe: does this look like a music performance based on title +
 * description alone? Used as a content-based correction when an upstream
 * signal (URL slug, CMS tag) has miscategorised the event. Returns false
 * if the haystack carries an explicit literary marker.
 */
export function looksLikeMusic(title: string, description?: string | null): boolean {
  const haystack = `${title} ${description ?? ""}`;
  if (LITERARY_INDICATORS_RE.test(haystack)) return false;
  return MUSIC_INDICATORS_RE.test(haystack);
}
