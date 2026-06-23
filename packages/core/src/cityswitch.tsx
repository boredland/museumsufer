import { cityName, cityUrl } from "./cities";
import type { Locale } from "./i18n";

/**
 * City switcher for the masthead eyebrow. It adapts to how many cities a
 * vertical covers, so it reads as a quiet dateline at any network size:
 *
 *   - 0–1 city  → the plain `.masthead__locality` label (no links).
 *   - 2–3       → an inline `A · B · C` switch; the active city is emphasised,
 *                 the others link to the same path on that city's subdomain.
 *   - 4+        → a pure-CSS `<details>` disclosure: the summary keeps the
 *                 eyebrow (current city + a quiet `+N` and a chevron); opening
 *                 reveals an alphabetically-sorted, scrollable menu of every
 *                 city. No JS, native keyboard/disclosure semantics, so it
 *                 carries the >150k-city roadmap without becoming a ticker.
 *
 * Reuses the `.masthead__locality` eyebrow + the `.cityswitch*` hooks each app
 * themes; the menu items reuse `.cityswitch__link` / `.cityswitch__current`.
 */
export interface CitySwitchProps {
  /** Apex domain for the vertical, e.g. "konzert.haus". */
  apex: string;
  /** Active city slug. */
  city: string;
  /** Cities this vertical covers, in display order (from the bundle). */
  supported: readonly string[];
  locale: Locale;
  /** Path (+ query) preserved across the switch, e.g. "/en/?date=2026-07-01". */
  path?: string;
  /** Localised aria-label for the nav. Defaults to a locale-aware label. */
  ariaLabel?: string;
}

const NAV_LABEL: Record<Locale, string> = {
  de: "Stadt wählen",
  en: "Choose city",
  fr: "Choisir la ville",
};

/** Up to this many cities read cleanly inline; beyond it we collapse to a menu. */
const INLINE_MAX = 3;

export function CitySwitch({ apex, city, supported, locale, path = "/", ariaLabel }: CitySwitchProps) {
  const cities = supported.length ? supported : [city];
  const label = ariaLabel ?? NAV_LABEL[locale];

  if (cities.length <= 1) {
    return <p class="masthead__locality">{cityName(city, locale, "short")}</p>;
  }

  if (cities.length <= INLINE_MAX) {
    return (
      <nav class="masthead__locality cityswitch" aria-label={label}>
        {cities.map((c, i) => (
          <>
            {i > 0 ? (
              <span class="cityswitch__sep" aria-hidden="true">
                {" · "}
              </span>
            ) : null}
            {c === city ? (
              <span class="cityswitch__current" aria-current="page">
                {cityName(c, locale, "short")}
              </span>
            ) : (
              <a class="cityswitch__link" href={`${cityUrl(apex, c)}${path}`}>
                {cityName(c, locale, "short")}
              </a>
            )}
          </>
        ))}
      </nav>
    );
  }

  const ordered = [...cities].sort((a, b) =>
    cityName(a, locale, "short").localeCompare(cityName(b, locale, "short"), locale),
  );
  return (
    <details class="cityswitch cityswitch--menu">
      <summary class="masthead__locality cityswitch__summary">
        <span class="cityswitch__here">{cityName(city, locale, "short")}</span>
        <span class="cityswitch__count" aria-hidden="true">{`+${cities.length - 1}`}</span>
        <span class="cityswitch__chevron" aria-hidden="true" />
      </summary>
      <nav class="cityswitch__menu" aria-label={label}>
        {ordered.map((c) =>
          c === city ? (
            <span class="cityswitch__current cityswitch__item" aria-current="page">
              {cityName(c, locale, "short")}
            </span>
          ) : (
            <a class="cityswitch__link cityswitch__item" href={`${cityUrl(apex, c)}${path}`}>
              {cityName(c, locale, "short")}
            </a>
          ),
        )}
      </nav>
    </details>
  );
}
