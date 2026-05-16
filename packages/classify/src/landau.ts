/**
 * Landau-region classifier — a 16-slug taxonomy that both upstream sources
 * (Kulturnetz Landau, frontend pages on Stadt Landau's Advantic CMS) are
 * mapped onto so landau.today's filter chips work uniformly. Kept regional
 * because Kerwe / Weinfest / Stadtjubiläum are not generic categories.
 */

export type LandauCategory =
  | "konzert"
  | "theater"
  | "tanz"
  | "kino"
  | "kabarett"
  | "literatur"
  | "vortrag"
  | "ausstellung"
  | "feste"
  | "junge-kultur"
  | "kurse"
  | "nachtleben"
  | "gedenken"
  | "exkursion"
  | "sport"
  | "sonstiges";

export const LANDAU_CATEGORIES: readonly LandauCategory[] = [
  "konzert",
  "theater",
  "tanz",
  "kino",
  "kabarett",
  "literatur",
  "vortrag",
  "ausstellung",
  "feste",
  "junge-kultur",
  "kurse",
  "nachtleben",
  "gedenken",
  "exkursion",
  "sport",
  "sonstiges",
] as const;

export function isLandauCategory(slug: string): slug is LandauCategory {
  return (LANDAU_CATEGORIES as readonly string[]).includes(slug);
}

/**
 * Kulturnetz Landau exposes 15 category pages under /veranstaltungen/<slug>/.
 * Some collapse onto our taxonomy (no separate "kabarett-und-comedy" — we
 * shorten it to "kabarett"). Keys are the upstream slugs.
 */
export const KULTURNETZ_CATEGORY_MAP: Record<string, LandauCategory> = {
  ausstellung: "ausstellung",
  exkursion: "exkursion",
  "feste-feiern": "feste",
  gedenken: "gedenken",
  "junge-kultur": "junge-kultur",
  "kabarett-und-comedy": "kabarett",
  kino: "kino",
  konzert: "konzert",
  "kurse-workshops": "kurse",
  literatur: "literatur",
  nachtleben: "nachtleben",
  sonstiges: "sonstiges",
  tanz: "tanz",
  theater: "theater",
  vortrag: "vortrag",
};

/**
 * Stadt Landau (Advantic CMS) categorises via integer KatID values.
 * Grouped onto our taxonomy. Hierarchical Kultur-children fold up into
 * their leaf.
 */
export const LANDAU_DE_KATID_MAP: Record<string, LandauCategory> = {
  "343.55": "ausstellung",
  "343.137": "literatur",
  "343.138": "konzert",
  "2644.186": "konzert",
  "343.139": "theater",
  "2644.131": "ausstellung",
  "2644.165": "tanz",
  "2644.178": "kino",
  "288.55": "vortrag",
  "288.54": "kurse",
  "1.275": "vortrag",
  "2644.127": "junge-kultur",
  "1815.229": "exkursion",
  "2644.179": "exkursion",
  "343.186": "sport",
  "343.181": "feste",
  "1.147": "feste",
  "343.164": "sonstiges",
  "1.277": "sonstiges",
  "343.221": "sonstiges",
  "1815.34": "sonstiges",
  "1.276": "sonstiges",
  "2644.124": "sonstiges",
  "1815.227": "sonstiges",
  "1.60": "sonstiges",
  "2644.111": "sonstiges",
  "2644.157": "sonstiges",
  "343.83": "sonstiges",
  "2644.191": "sonstiges",
  "2644.189": "sonstiges",
  "2644.180": "feste",
  "2644.196": "sonstiges",
  "343.185": "exkursion",
};

/**
 * Last-chance text classifier for items that arrive without a mappable
 * upstream category. Title-prefix wins over description-keyword. Returns
 * "sonstiges" if nothing matches.
 */
export function classifyLandauByText(title: string, description?: string | null): LandauCategory {
  const haystack = `${title} ${description || ""}`.toLowerCase();
  const tests: ReadonlyArray<readonly [readonly string[], LandauCategory]> = [
    [["ausstellung", "vernissage", "finissage", "galerie"], "ausstellung"],
    [
      [
        "konzert",
        "live-musik",
        "musikabend",
        "kammermusik",
        "chor",
        "jazz",
        "rock",
        "pop ",
        "klassik",
        "brass",
        " sings ",
        "abbamusic",
        "blues",
        "soul",
      ],
      "konzert",
    ],
    [["theater", "schauspiel", "bühne", "inszenierung", "premiere"], "theater"],
    [["tanz", "ballett", "tango", "tanzabend"], "tanz"],
    [["kino", "film", "cinema"], "kino"],
    [["kabarett", "comedy", "stand-up", "humor"], "kabarett"],
    [["lesung", "literatur", "buchpräsentation", "buchvorstellung", "poetry"], "literatur"],
    [["vortrag", "diskussion", "podium", "talk"], "vortrag"],
    [
      [
        "festival",
        "fest",
        "kerwe",
        "weinfest",
        "weinfrühling",
        "weinprobe",
        "weingut",
        "weinerlebnis",
        "weinprinzessin",
        "ausschank",
        "jahrgangspräsentation",
        "brunch",
        "markt",
        "kirmes",
        "fête",
        "fete de",
      ],
      "feste",
    ],
    [["workshop", "kurs", "seminar", "atelier"], "kurse"],
    [
      [
        "führung",
        "geführt",
        "rundgang",
        "wanderung",
        "stadtführung",
        "exkursion",
        "radtour",
        "erlebnistour",
        "unterwelt",
        "lunette",
        "oldtimerbulli",
      ],
      "exkursion",
    ],
    [["lauf", "rennen", "stadtradeln", "sport", "turnier", "fitness"], "sport"],
    [["club", "party", "nachtleben", "tanzabend"], "nachtleben"],
    [["gedenken", "befreiung", "mahnmal", "shoa", "shoah"], "gedenken"],
    [["kinder", "jugend", "familie", "schüler"], "junge-kultur"],
  ];
  for (const [needles, slug] of tests) {
    for (const needle of needles) if (haystack.includes(needle)) return slug;
  }
  return "sonstiges";
}
