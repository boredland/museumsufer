export type FaqLocale = "de" | "en" | "fr";

const CONNECTOR: Record<FaqLocale, string> = {
  de: " und ",
  en: " and ",
  fr: " et ",
};

/** Count events per venue slug and return venue names sorted by event count
 *  (descending), ties broken alphabetically. Slugs with no name in the lookup
 *  table are dropped — venues that no longer appear in the curated config
 *  shouldn't leak into the FAQ. */
export function rankVenuesByEventCount<T>(
  events: ReadonlyArray<T>,
  getSlug: (event: T) => string | undefined | null,
  nameBySlug: ReadonlyMap<string, string>,
): { name: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const event of events) {
    const slug = getSlug(event);
    if (!slug) continue;
    counts.set(slug, (counts.get(slug) ?? 0) + 1);
  }
  const ranked: { name: string; count: number }[] = [];
  for (const [slug, count] of counts) {
    const name = nameBySlug.get(slug);
    if (name) ranked.push({ name, count });
  }
  ranked.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  return ranked;
}

/** Join names into a human-readable list with locale-appropriate connector
 *  before the last item: "A, B und C" / "A, B and C" / "A, B et C". */
export function joinNames(names: readonly string[], locale: FaqLocale): string {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  const head = names.slice(0, -1).join(", ");
  const tail = names[names.length - 1];
  return head + CONNECTOR[locale] + tail;
}
