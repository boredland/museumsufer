/**
 * Parse the bundled `"<street>, <PLZ> <city>"` venue address string
 * into a structured schema.org PostalAddress object. Used by
 * /spielort/:slug, /quelle/:slug, /theater/:slug and /film/:id route
 * handlers so the venue JSON-LD passes Google's Rich Results validator.
 *
 * Three behaviours are needed across the apps and parameterised here:
 *
 * 1. Frankfurt-Hessen venues (lehrhaus, frankfurt-theaters): always
 *    stamp `addressRegion: "Hessen"` on success; return undefined for
 *    empty/unparseable input so the caller decides whether to emit a
 *    `location.address` at all.
 *
 * 2. Single-city sites (konzert-haus): return a fallback locality
 *    object on failure so synthesised stubs without a real street still
 *    carry "Frankfurt am Main" in the address slot.
 *
 * 3. Permissive sites (lichtspiel-haus): keep streetAddress when no
 *    PLZ is present, so cinemas with abbreviated address strings still
 *    surface what we know.
 */

export interface PostalAddressLd {
  "@type": "PostalAddress";
  streetAddress?: string;
  postalCode?: string;
  addressLocality?: string;
  addressRegion?: string;
  addressCountry: string;
}

export interface ParsePostalAddressOptions {
  /** ISO 3166-1 alpha-2 country code. Defaults to "DE". */
  country?: string;
  /** Region (Bundesland) stamped on every successful parse. e.g. "Hessen". */
  region?: string;
  /** Behaviour when input is empty or doesn't match the expected
   *  `<street>, <PLZ> <city>` shape:
   *  - `"undefined"` (default) → return undefined, caller skips emitting
   *    a `location.address` block.
   *  - `{ addressLocality }` → return a fallback PostalAddress carrying
   *    only the locality. Useful for single-city sites.
   *  - `"permissive"` → split on the first comma; keep whatever fields
   *    we can extract (street alone, or city alone), and fall back to a
   *    bare `{ addressCountry }` for empty input. */
  fallback?: "undefined" | "permissive" | { addressLocality: string };
}

const STRICT = /^(.+?),\s*(\d{4,5})\s+(.+)$/;

export function parsePostalAddress(
  addr: string | undefined | null,
  opts: ParsePostalAddressOptions = {},
): PostalAddressLd | undefined {
  const country = opts.country ?? "DE";
  const region = opts.region;
  const trimmed = (addr ?? "").trim();
  const fallbackMode = opts.fallback ?? "undefined";

  const makeLocalityFallback = (): PostalAddressLd | undefined => {
    if (fallbackMode === "undefined") return undefined;
    if (fallbackMode === "permissive") return { "@type": "PostalAddress", addressCountry: country };
    return {
      "@type": "PostalAddress",
      addressLocality: fallbackMode.addressLocality,
      addressCountry: country,
    };
  };

  if (!trimmed) return makeLocalityFallback();

  const m = trimmed.match(STRICT);
  if (m && /\d/.test(m[1])) {
    return {
      "@type": "PostalAddress",
      streetAddress: m[1].trim(),
      postalCode: m[2],
      addressLocality: m[3].trim(),
      ...(region && { addressRegion: region }),
      addressCountry: country,
    };
  }

  if (fallbackMode === "permissive") {
    const parts = trimmed.split(",").map((s) => s.trim());
    const [streetPart, cityPart] = parts;
    if (cityPart) {
      const plz = cityPart.match(/^(\d{4,5})\s+(.+)$/);
      return {
        "@type": "PostalAddress",
        streetAddress: streetPart || undefined,
        postalCode: plz?.[1],
        addressLocality: plz?.[2] ?? cityPart,
        ...(region && { addressRegion: region }),
        addressCountry: country,
      };
    }
    return { "@type": "PostalAddress", streetAddress: streetPart || undefined, addressCountry: country };
  }

  return makeLocalityFallback();
}
