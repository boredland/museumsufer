/**
 * Shared language switcher. Renders one anchor per supported locale,
 * with the active one marked via `aria-current="page"` and the
 * `.langswitch__link--active` modifier. The clicked anchor reloads the
 * page with the new `?lang=` query parameter.
 *
 * Styling lives in each app's stylesheet — class hooks: .langswitch,
 * .langswitch__link, .langswitch__link--active.
 */
export interface LangSwitchProps<L extends string = string> {
  /** Active locale, e.g. "de". */
  locale: L;
  /** Locale order as displayed, e.g. ["de", "en", "fr"]. */
  supported: readonly L[];
  /** Localised aria-label for the nav element. */
  ariaLabel: string;
  /** Optional href builder — defaults to `?lang=${l}`. */
  buildHref?: (l: L) => string;
}

export function LangSwitch<L extends string>({ locale, supported, ariaLabel, buildHref }: LangSwitchProps<L>) {
  const href = buildHref ?? ((l: L) => `?lang=${l}`);
  return (
    <nav class="langswitch" aria-label={ariaLabel}>
      {supported.map((l) => (
        <a
          key={l}
          href={href(l)}
          data-lang={l}
          class={`langswitch__link${l === locale ? " langswitch__link--active" : ""}`}
          aria-current={l === locale ? "page" : undefined}
        >
          {l.toUpperCase()}
        </a>
      ))}
    </nav>
  );
}
