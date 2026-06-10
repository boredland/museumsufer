/**
 * Unified category taxonomy for landau.today.
 *
 * Events arrive from the central event hub (`@museumsufer/event-hub`)
 * already classified into these 16 slugs via their `landau:<slug>`
 * label — the upstream-category mapping and the text-classifier fallback
 * live in `@museumsufer/classify` (`landau.ts`). This module owns only the
 * presentation side: labels, short labels, glyphs, and the mood-tone palette.
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
