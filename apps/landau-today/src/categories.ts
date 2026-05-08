/**
 * Unified category taxonomy for landau.today.
 *
 * Both upstream sources are mapped onto this 16-slug set so the
 * frontend filter chips work the same regardless of where the event
 * came from. Adding a new upstream means adding two map entries below;
 * the rest of the app stays untouched.
 *
 * The mood-tone colour decides which CSS variable the glyph picks up
 * in the chip + ledger row. Five tones, not sixteen — to keep the page
 * legible. See app.css.
 */

export type Mood = "ink" | "rotwein" | "ocker" | "reblaus" | "schiefer";

export interface CategoryDef {
  slug: string;
  /** German label as shown in the chip / badge. Site is DE-only for now. */
  label: string;
  /** Short label for cramped spots (mobile chip row, ledger gutter). */
  short: string;
  glyph: string;
  mood: Mood;
}

export const CATEGORIES: CategoryDef[] = [
  { slug: "konzert", label: "Konzert", short: "Konzert", glyph: "♪", mood: "rotwein" },
  { slug: "theater", label: "Theater", short: "Theater", glyph: "◊", mood: "ink" },
  { slug: "tanz", label: "Tanz", short: "Tanz", glyph: "⤲", mood: "ocker" },
  { slug: "kino", label: "Kino", short: "Kino", glyph: "▶", mood: "ocker" },
  { slug: "kabarett", label: "Kabarett & Comedy", short: "Kabarett", glyph: "¡", mood: "rotwein" },
  { slug: "literatur", label: "Literatur", short: "Literatur", glyph: "❡", mood: "ink" },
  { slug: "vortrag", label: "Vortrag", short: "Vortrag", glyph: "☞", mood: "ink" },
  { slug: "ausstellung", label: "Ausstellung", short: "Ausstellung", glyph: "◻", mood: "ink" },
  { slug: "feste", label: "Feste & Feiern", short: "Feste", glyph: "❋", mood: "ocker" },
  { slug: "junge-kultur", label: "Junge Kultur", short: "Junge Kultur", glyph: "✦", mood: "ocker" },
  { slug: "kurse", label: "Kurse & Workshops", short: "Kurse", glyph: "§", mood: "ink" },
  { slug: "nachtleben", label: "Nachtleben", short: "Nachtleben", glyph: "☾", mood: "rotwein" },
  { slug: "gedenken", label: "Gedenken", short: "Gedenken", glyph: "†", mood: "schiefer" },
  { slug: "exkursion", label: "Exkursion", short: "Exkursion", glyph: "⌖", mood: "reblaus" },
  { slug: "sport", label: "Sport", short: "Sport", glyph: "△", mood: "reblaus" },
  { slug: "sonstiges", label: "Sonstiges", short: "Sonstiges", glyph: "‡", mood: "ink" },
];

export const CATEGORY_BY_SLUG: Map<string, CategoryDef> = new Map(CATEGORIES.map((c) => [c.slug, c]));

export function isCategorySlug(slug: string): boolean {
  return CATEGORY_BY_SLUG.has(slug);
}

/**
 * Kulturnetz Landau exposes 15 category pages under
 *   /veranstaltungen/<slug>/
 * Some collapse onto our taxonomy (no separate "kabarett-und-comedy" — we
 * shorten it to "kabarett"). The map keys are the upstream slugs.
 */
export const KULTURNETZ_CATEGORY_MAP: Record<string, string> = {
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
 * Grouped onto our taxonomy. The dropdown was hand-extracted from
 * the public events page — see plan documentation. Hierarchical
 * Kultur-children fold up into their leaf.
 */
export const LANDAU_DE_KATID_MAP: Record<string, string> = {
  // Kultur leaves
  "343.55": "ausstellung", // Kunstausstellungen
  "343.137": "literatur", // Büchereitage
  "343.138": "konzert", // Konzerte
  "2644.186": "konzert", // Konzerte im Goethepark
  "343.139": "theater", // Theater
  "2644.131": "ausstellung", // Kunst
  "2644.165": "tanz", // Tanztheater
  "2644.178": "kino", // Film
  "288.55": "vortrag", // Vortrag
  // Bildung & Soziales
  "288.54": "kurse", // Volkshochschule
  "1.275": "vortrag", // Information & Bildung
  "2644.127": "junge-kultur", // Kinder/Jugendliche
  // Outdoors / Tourism
  "1815.229": "exkursion", // Stadtführungen
  "2644.179": "exkursion", // Im Grünen
  "343.186": "sport", // Sport
  "343.181": "feste", // Weinfeste und Märkte
  "1.147": "feste", // Freizeit
  // Misc / fallback
  "343.164": "sonstiges", // Senioren
  "1.277": "sonstiges", // Sonstige
  "343.221": "sonstiges", // Gesundheit
  "1815.34": "sonstiges", // Stadtmarketing
  "1.276": "sonstiges", // Wirtschaft & Messen
  "2644.124": "sonstiges", // Bürgerbeteiligung
  "1815.227": "sonstiges", // Politik
  "1.60": "sonstiges", // Sitzungstermine
  "2644.111": "sonstiges", // Gleichstellungsstelle
  "2644.157": "sonstiges", // Fairändern
  "343.83": "sonstiges", // für Frauen
  "2644.191": "sonstiges", // Umwelt & Klima
  "2644.189": "sonstiges", // Projekt der Kulturförderung
  "2644.180": "feste", // Stadtjubiläum
  "2644.196": "sonstiges", // Freundeskreis städt. Kultur
  "343.185": "exkursion", // Zoo
};

/**
 * Last-chance text classifier for items that arrive without an upstream
 * category (or with one we couldn't map). Title-prefix wins over
 * description-keyword. Returns "sonstiges" if nothing matches — never
 * null, so the type system can keep `category` non-optional.
 */
export function classifyEventByText(title: string, description?: string | null): string {
  const haystack = `${title} ${description || ""}`.toLowerCase();
  const tests: Array<[string[], string]> = [
    [["ausstellung", "vernissage", "finissage", "galerie"], "ausstellung"],
    [["konzert", "live-musik", "musikabend", "kammermusik", "chor", "jazz", "rock", "pop ", "klassik"], "konzert"],
    [["theater", "schauspiel", "bühne", "inszenierung", "premiere"], "theater"],
    [["tanz", "ballett", "tango", "tanzabend"], "tanz"],
    [["kino", "film", "cinema"], "kino"],
    [["kabarett", "comedy", "stand-up", "humor"], "kabarett"],
    [["lesung", "literatur", "buchpräsentation", "buchvorstellung", "poetry"], "literatur"],
    [["vortrag", "diskussion", "podium", "talk"], "vortrag"],
    [["festival", "fest", "kerwe", "weinfest", "markt", "kirmes", "fête", "fete de"], "feste"],
    [["workshop", "kurs", "seminar", "atelier"], "kurse"],
    [["führung", "geführt", "rundgang", "wanderung", "stadtführung", "exkursion", "radtour"], "exkursion"],
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
