import type { Genre } from "./types";

/**
 * Keyword tables priority-ordered: sacred (most distinctive), jazz, world,
 * experimental, chamber, classical. First match wins. Case-insensitive
 * substring match against (title + subtitle + description).
 */
const KEYWORDS: ReadonlyArray<{ genre: Genre; needles: readonly string[] }> = [
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

export function classify(
  title: string,
  subtitle?: string | null,
  description?: string | null,
  fallback: Genre = "classical",
): Genre {
  const haystack = [title, subtitle, description].filter(Boolean).join(" ").toLowerCase();
  if (!haystack) return fallback;
  for (const bucket of KEYWORDS) {
    for (const needle of bucket.needles) {
      if (haystack.includes(needle)) return bucket.genre;
    }
  }
  return fallback;
}
