/**
 * Single source of truth for the cities the network serves.
 *
 * This module is intentionally dependency-free (plain data + tiny pure
 * helpers) so it can be imported from both worker request paths and Bun
 * build scripts without pulling in Hono, JSX, or the scraper graph.
 *
 * The bounding boxes live here — not in `packages/scrapers` — because both
 * the scrape scripts (build-time geofencing) and, indirectly, the apps need
 * them. `packages/scrapers/src/venue-coords.ts` re-exports these so existing
 * `@museumsufer/event-hub` consumers keep importing the same names.
 */

import type { Locale } from "./i18n";

export interface Bbox {
  readonly minLat: number;
  readonly maxLat: number;
  readonly minLon: number;
  readonly maxLon: number;
}

export function inBbox(lat: number, lon: number, box: Bbox): boolean {
  return lat >= box.minLat && lat <= box.maxLat && lon >= box.minLon && lon <= box.maxLon;
}

/** Frankfurt metro + Taunus / Rheingau / Offenbach edge. Bad Homburg and
 *  Forschungskolleg in the north (50.227), Rheingau festival in the west
 *  (8.046), Höchst / Bad Soden in the south-west, Offenbach in the east. */
export const FRANKFURT_BBOX: Bbox = {
  minLat: 49.95,
  maxLat: 50.3,
  minLon: 7.95,
  maxLon: 8.85,
};

/** Hamburg city region bbox. */
export const HAMBURG_BBOX: Bbox = {
  minLat: 53.35,
  maxLat: 53.75,
  minLon: 9.7,
  maxLon: 10.35,
};

/** Landau in der Pfalz + Südliche Weinstraße + Hambach. */
export const LANDAU_BBOX: Bbox = {
  minLat: 49.05,
  maxLat: 49.45,
  minLon: 7.95,
  maxLon: 8.3,
};

/** Darmstadt + southern-Hesse edge. Capped at maxLat 49.94 to stay strictly
 *  south of FRANKFURT_BBOX (minLat 49.95), so the ~30km Frankfurt seam splits
 *  cleanly without a shared-bbox tiebreak. */
export const DARMSTADT_BBOX: Bbox = {
  minLat: 49.75,
  maxLat: 49.94,
  minLon: 8.5,
  maxLon: 8.8,
};

/** Heidelberg + Bergstraße. minLon 8.55 keeps it east of Mannheim's centroid
 *  (~8.47, covered by the Mannheim cluster) so the western seam splits on the
 *  bbox alone. */
export const HEIDELBERG_BBOX: Bbox = {
  minLat: 49.3,
  maxLat: 49.52,
  minLon: 8.55,
  maxLon: 8.87,
};

/** Mainz + Wiesbaden — the shared "Rhein-Main-West" region. It nests INSIDE
 *  FRANKFURT_BBOX (lon 8.1–8.4 vs Frankfurt's 7.95–8.85), so `cityFor` checks
 *  REGIONS first: a point here resolves to Mainz/Wiesbaden, never Frankfurt
 *  (no Frankfurt venue lies in this box). Both cities share this one box and
 *  fan out to each other's surfaces; the Rheingau festival at lon 8.046 stays
 *  west of minLon 8.1 → Frankfurt. */
export const RHEINMAIN_WEST_BBOX: Bbox = {
  minLat: 49.93,
  maxLat: 50.16,
  minLon: 8.1,
  maxLon: 8.4,
};
/** Wuppertal — long E-W bbox along the Wupper valley. */
export const WUPPERTAL_BBOX: Bbox = {
  minLat: 51.2,
  maxLat: 51.32,
  minLon: 7.06,
  maxLon: 7.31,
};

/** Solingen — abuts Remscheid to the west; declarative city wins at the seam. */
export const SOLINGEN_BBOX: Bbox = {
  minLat: 51.13,
  maxLat: 51.21,
  minLon: 6.98,
  maxLon: 7.14,
};

/** Remscheid — abuts Solingen to the east; no overlap. */
export const REMSCHEID_BBOX: Bbox = {
  minLat: 51.14,
  maxLat: 51.23,
  minLon: 7.16,
  maxLon: 7.28,
};
export type CitySlug =
  | "frankfurt"
  | "hamburg"
  | "darmstadt"
  | "heidelberg"
  | "mainz"
  | "wiesbaden"
  | "wuppertal"
  | "solingen"
  | "remscheid";

export interface CityMeta {
  /** URL subdomain prefix and the value stored on bundled events. */
  readonly slug: CitySlug;
  /** Full canonical name, e.g. used as schema.org addressLocality. */
  readonly name: string;
  /** Short colloquial form for headings and inline copy. */
  readonly short: string;
  /** Adjectival form: de "Frankfurter", en possessive "Frankfurt's". */
  readonly adj: Readonly<Record<"de" | "en", string>>;
  /** Locale-aware name forms for body copy. `full` is the form used in
   *  page titles ("Frankfurt am Main" / fr "Francfort-sur-le-Main"); `short`
   *  is the inline form ("Frankfurt" / fr "Francfort"). Order them full-then-
   *  short when substituting so the longer match wins. */
  readonly i18nName: Readonly<Record<Locale, { full: string; short: string }>>;
  /** Administrative region (schema.org addressRegion). */
  readonly region: string;
  /** Wikidata Q-id for the city (sameAs links). */
  readonly wikidata: string;
  /** Centroid for nearest-city geo routing on apex hits. */
  readonly centroid: { readonly lat: number; readonly lon: number };
  /** Geofence used at bundle time to assign events to this city. */
  readonly bbox: Bbox;
  /** Optional precise boundary as a GeoJSON-style [lon, lat] ring. `cityFor`
   *  applies it after the bbox pre-filter, so two cities may share a bbox yet
   *  split precisely — e.g. Frankfurt vs Mainz along the Rhine. Omit for
   *  isolated cities, where the bbox alone is unambiguous. */
  readonly polygon?: ReadonlyArray<readonly [number, number]>;
}

export const CITIES: Readonly<Record<CitySlug, CityMeta>> = {
  frankfurt: {
    slug: "frankfurt",
    name: "Frankfurt am Main",
    short: "Frankfurt",
    adj: { de: "Frankfurter", en: "Frankfurt's" },
    i18nName: {
      de: { full: "Frankfurt am Main", short: "Frankfurt" },
      en: { full: "Frankfurt am Main", short: "Frankfurt" },
      fr: { full: "Francfort-sur-le-Main", short: "Francfort" },
    },
    region: "Hessen",
    wikidata: "Q1794",
    centroid: { lat: 50.11, lon: 8.68 },
    bbox: FRANKFURT_BBOX,
  },
  hamburg: {
    slug: "hamburg",
    name: "Hamburg",
    short: "Hamburg",
    adj: { de: "Hamburger", en: "Hamburg's" },
    i18nName: {
      de: { full: "Hamburg", short: "Hamburg" },
      en: { full: "Hamburg", short: "Hamburg" },
      fr: { full: "Hambourg", short: "Hambourg" },
    },
    region: "Hamburg",
    wikidata: "Q1055",
    centroid: { lat: 53.55, lon: 9.99 },
    bbox: HAMBURG_BBOX,
  },
  darmstadt: {
    slug: "darmstadt",
    name: "Darmstadt",
    short: "Darmstadt",
    adj: { de: "Darmstädter", en: "Darmstadt's" },
    i18nName: {
      de: { full: "Darmstadt", short: "Darmstadt" },
      en: { full: "Darmstadt", short: "Darmstadt" },
      fr: { full: "Darmstadt", short: "Darmstadt" },
    },
    region: "Hessen",
    wikidata: "Q2973",
    centroid: { lat: 49.8667, lon: 8.65 },
    bbox: DARMSTADT_BBOX,
  },
  heidelberg: {
    slug: "heidelberg",
    name: "Heidelberg",
    short: "Heidelberg",
    adj: { de: "Heidelberger", en: "Heidelberg's" },
    i18nName: {
      de: { full: "Heidelberg", short: "Heidelberg" },
      en: { full: "Heidelberg", short: "Heidelberg" },
      fr: { full: "Heidelberg", short: "Heidelberg" },
    },
    region: "Baden-Württemberg",
    wikidata: "Q2966",
    centroid: { lat: 49.4122, lon: 8.71 },
    bbox: HEIDELBERG_BBOX,
  },
  mainz: {
    slug: "mainz",
    name: "Mainz",
    short: "Mainz",
    adj: { de: "Mainzer", en: "Mainz's" },
    i18nName: {
      de: { full: "Mainz", short: "Mainz" },
      en: { full: "Mainz", short: "Mainz" },
      fr: { full: "Mayence", short: "Mayence" },
    },
    region: "Rheinland-Pfalz",
    wikidata: "Q1720",
    centroid: { lat: 50.0, lon: 8.27 },
    bbox: RHEINMAIN_WEST_BBOX,
  },
  wiesbaden: {
    slug: "wiesbaden",
    name: "Wiesbaden",
    short: "Wiesbaden",
    adj: { de: "Wiesbadener", en: "Wiesbaden's" },
    i18nName: {
      de: { full: "Wiesbaden", short: "Wiesbaden" },
      en: { full: "Wiesbaden", short: "Wiesbaden" },
      fr: { full: "Wiesbaden", short: "Wiesbaden" },
    },
    region: "Hessen",
    wikidata: "Q1721",
    centroid: { lat: 50.0825, lon: 8.24 },
    bbox: RHEINMAIN_WEST_BBOX,
  },
  wuppertal: {
    slug: "wuppertal",
    name: "Wuppertal",
    short: "Wuppertal",
    adj: { de: "Wuppertaler", en: "Wuppertal's" },
    i18nName: {
      de: { full: "Wuppertal", short: "Wuppertal" },
      en: { full: "Wuppertal", short: "Wuppertal" },
      fr: { full: "Wuppertal", short: "Wuppertal" },
    },
    region: "Nordrhein-Westfalen",
    wikidata: "Q2107",
    centroid: { lat: 51.256, lon: 7.15 },
    bbox: WUPPERTAL_BBOX,
  },
  solingen: {
    slug: "solingen",
    name: "Solingen",
    short: "Solingen",
    adj: { de: "Solinger", en: "Solingen's" },
    i18nName: {
      de: { full: "Solingen", short: "Solingen" },
      en: { full: "Solingen", short: "Solingen" },
      fr: { full: "Solingen", short: "Solingen" },
    },
    region: "Nordrhein-Westfalen",
    wikidata: "Q2942",
    centroid: { lat: 51.171, lon: 7.085 },
    bbox: SOLINGEN_BBOX,
  },
  remscheid: {
    slug: "remscheid",
    name: "Remscheid",
    short: "Remscheid",
    adj: { de: "Remscheider", en: "Remscheid's" },
    i18nName: {
      de: { full: "Remscheid", short: "Remscheid" },
      en: { full: "Remscheid", short: "Remscheid" },
      fr: { full: "Remscheid", short: "Remscheid" },
    },
    region: "Nordrhein-Westfalen",
    wikidata: "Q3097",
    centroid: { lat: 51.178, lon: 7.193 },
    bbox: REMSCHEID_BBOX,
  },
};

export const DEFAULT_CITY: CitySlug = "frankfurt";

/**
 * A geofence region whose events fan out to several city surfaces. The region
 * bbox takes precedence over any overlapping single-city bbox in `cityFor`, so
 * a point inside it resolves to the region's members and never to the larger
 * city it nests within (Rhein-Main-West sits inside Frankfurt).
 */
export interface CityRegion {
  readonly slug: string;
  readonly bbox: Bbox;
  readonly cities: readonly CitySlug[];
}

export const REGIONS: readonly CityRegion[] = [
  { slug: "rhein-main-west", bbox: RHEINMAIN_WEST_BBOX, cities: ["mainz", "wiesbaden"] },
];

/** Resolve a (possibly untrusted) slug to its metadata, falling back to
 *  the default city so callers never have to null-check. */
export function cityMeta(slug: string | undefined): CityMeta {
  return CITIES[(slug ?? "") as CitySlug] ?? CITIES[DEFAULT_CITY];
}

/** Adjectival city form for inline copy. EN uses the possessive ("Hamburg's");
 *  FR has no distinct form here so it reuses the short name. */
export function cityAdj(slug: string | undefined, locale: Locale): string {
  const meta = cityMeta(slug);
  return locale === "en" ? meta.adj.en : locale === "de" ? meta.adj.de : meta.short;
}

/** Locale-aware city name for body copy. `full` is the title form
 *  ("Frankfurt am Main"), `short` the inline form ("Frankfurt"). */
export function cityName(slug: string | undefined, locale: Locale, form: "full" | "short" = "short"): string {
  return cityMeta(slug).i18nName[locale][form];
}

/**
 * Rewrite copy authored for the default city (Frankfurt) so it reads for
 * another city: swaps the canonical host and the locale-aware name forms via
 * literal replacement (no regex). Returns the text unchanged for the default
 * city. App-specific editorial phrasing (e.g. "Rhein-Main-Region") is the
 * caller's responsibility — pass it through `extra` substitutions.
 */
export function localizeCityText(
  text: string,
  slug: string | undefined,
  locale: Locale,
  apex?: string,
  extra?: ReadonlyArray<readonly [string, string]>,
): string {
  const from = CITIES[DEFAULT_CITY];
  const to = cityMeta(slug);
  if (to.slug === from.slug) return text;
  let out = text;
  if (apex) out = out.split(`${from.slug}.${apex}`).join(`${to.slug}.${apex}`);
  // Full name before short so the longer match wins ("…am Main" first).
  out = out.split(from.i18nName[locale].full).join(to.i18nName[locale].full);
  out = out.split(from.i18nName[locale].short).join(to.i18nName[locale].short);
  for (const [a, b] of extra ?? []) out = out.split(a).join(b);
  return out;
}

/** Canonical host for a city under a given apex, e.g. ("lehr.salon",
 *  "hamburg") → "hamburg.lehr.salon". */
export function cityHost(apex: string, slug: string | undefined): string {
  return `${cityMeta(slug).slug}.${apex}`;
}

/** Canonical https origin for a city under a given apex. */
export function cityUrl(apex: string, slug: string | undefined): string {
  return `https://${cityHost(apex, slug)}`;
}

/** Canonical URL for the museum app in a given city. Frankfurt keeps its
 *  SEO-primary host (museumsufer.app); other cities route to the
 *  <city>.ins.museum subdomain. */
export function museumUrl(slug: string | undefined): string {
  return cityMeta(slug).slug === DEFAULT_CITY ? "https://museumsufer.app" : cityUrl("ins.museum", slug);
}

/** Pick the nearest city to a coordinate by squared centroid distance.
 *  Used for geo-routing apex hits (degrees are fine at these latitudes
 *  for a simple "which is closer" comparison). */
export function nearestCity(lat: number, lon: number): CitySlug {
  let best: CitySlug = DEFAULT_CITY;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const meta of Object.values(CITIES)) {
    const d = (lat - meta.centroid.lat) ** 2 + (lon - meta.centroid.lon) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = meta.slug;
    }
  }
  return best;
}

/** Ray-casting point-in-polygon for a GeoJSON-style [lon, lat] ring.
 *  Dependency-free; plane geometry is fine at city scale. */
export function pointInPolygon(lat: number, lon: number, ring: ReadonlyArray<readonly [number, number]>): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const intersects = yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

/**
 * Assign a coordinate to a single "home" city. A REGIONS box is tried first
 * and wins outright — its nearest member is returned and the enclosing city is
 * never considered (so Rhein-Main-West beats Frankfurt). Otherwise the per-city
 * bbox is a cheap pre-filter; a city that also declares a `polygon` must
 * contain the point too, and when several still match the nearest centroid
 * wins. Returns null when the point lies outside every city. For the full set
 * of surfaces an event appears on (region fan-out), use `citiesFor`.
 */
export function cityFor(lat: number, lon: number): CitySlug | null {
  for (const region of REGIONS) {
    if (!inBbox(lat, lon, region.bbox)) continue;
    let nearest: CitySlug | null = null;
    let nearestDist = Number.POSITIVE_INFINITY;
    for (const slug of region.cities) {
      const c = CITIES[slug].centroid;
      const d = (lat - c.lat) ** 2 + (lon - c.lon) ** 2;
      if (d < nearestDist) {
        nearestDist = d;
        nearest = slug;
      }
    }
    return nearest;
  }
  let best: CitySlug | null = null;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const meta of Object.values(CITIES)) {
    if (!inBbox(lat, lon, meta.bbox)) continue;
    if (meta.polygon && !pointInPolygon(lat, lon, meta.polygon)) continue;
    const d = (lat - meta.centroid.lat) ** 2 + (lon - meta.centroid.lon) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = meta.slug;
    }
  }
  return best;
}

/**
 * City for an event: declarative first — an explicit `event.city` set by a
 * scraper/orchestrator wins (e.g. a museum's configured city) — else geometric
 * via `cityFor`. Returns null when neither resolves to a served city.
 */
export function cityOf(ev: { city?: string | null; lat?: number | null; lon?: number | null }): CitySlug | null {
  if (ev.city && ev.city in CITIES) return ev.city as CitySlug;
  if (typeof ev.lat === "number" && typeof ev.lon === "number") return cityFor(ev.lat, ev.lon);
  return null;
}

/** All city surfaces a home city appears on. Region members fan out to every
 *  sibling (Mainz ⇄ Wiesbaden); standalone cities map to just themselves. */
export function citySurfaces(slug: CitySlug): readonly CitySlug[] {
  for (const region of REGIONS) if (region.cities.includes(slug)) return region.cities;
  return [slug];
}

/** Every surface a coordinate serves, region-expanded — a Rhein-Main-West
 *  venue returns both Mainz and Wiesbaden. Empty when outside every city. */
export function citiesFor(lat: number, lon: number): CitySlug[] {
  const home = cityFor(lat, lon);
  return home ? [...citySurfaces(home)] : [];
}

/** Every surface an event belongs to — declarative or geometric, expanded
 *  across the home city's region. Empty when it resolves to no served city. */
export function citiesOf(ev: { city?: string | null; lat?: number | null; lon?: number | null }): CitySlug[] {
  const home = cityOf(ev);
  return home ? [...citySurfaces(home)] : [];
}

/** Does an item whose home city is `home` (default Frankfurt) surface on
 *  `city`? True when identical or region-siblings. */
export function servesCity(home: string | null | undefined, city: string): boolean {
  const surfaces: readonly string[] = citySurfaces((home ?? DEFAULT_CITY) as CitySlug);
  return surfaces.includes(city);
}

/** Coordinate analogue of `servesCity`: does a venue at (`lat`,`lon`) surface
 *  on `city`? Region-aware. */
export function coordServesCity(lat: number, lon: number, city: string): boolean {
  const surfaces: readonly string[] = citiesFor(lat, lon);
  return surfaces.includes(city);
}
