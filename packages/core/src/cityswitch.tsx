import { cityName, cityUrl } from "./cities";
import type { Locale } from "./i18n";

/**
 * Inline city switcher for the masthead eyebrow. Lists every city a vertical
 * currently covers; the active one is emphasised, the others link to the same
 * path on that city's subdomain (cross-origin). Reuses the `.masthead__locality`
 * eyebrow so it inherits each app's type treatment; adds `.cityswitch*` hooks
 * for the inline layout + link styling.
 *
 * When a vertical covers a single city it degrades to the plain locality label
 * (no links), matching the pre-switcher behaviour.
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

export function CitySwitch({ apex, city, supported, locale, path = "/", ariaLabel }: CitySwitchProps) {
  const cities = supported.length ? supported : [city];
  const label = ariaLabel ?? NAV_LABEL[locale];

  if (cities.length <= 1) {
    return <p class="masthead__locality">{cityName(city, locale, "short")}</p>;
  }

  return (
    <nav class="masthead__locality cityswitch" aria-label={label}>
      {cities.map((c, i) => {
        const label = cityName(c, locale, "short");
        return (
          <>
            {i > 0 ? (
              <span class="cityswitch__sep" aria-hidden="true">
                {" · "}
              </span>
            ) : null}
            {c === city ? (
              <span class="cityswitch__current" aria-current="page">
                {label}
              </span>
            ) : (
              <a class="cityswitch__link" href={`${cityUrl(apex, c)}${path}`}>
                {label}
              </a>
            )}
          </>
        );
      })}
    </nav>
  );
}
