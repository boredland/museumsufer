/**
 * Shared editorial footer. Hairline rule, short description, action buttons
 * (Subscribe / Report problem), inline middot-separated links (iCal / RSS /
 * API / Impressum / GitHub), and a status toast region.
 *
 * Class hooks (per-app stylesheets define typography + colour):
 *   .footer, .footer__rule, .footer__description, .footer__actions,
 *   .footer__action, .footer__links, .footer__sep, .footer__toast
 */
import { Fragment } from "hono/jsx";
import type { JSX } from "hono/jsx/jsx-runtime";

/**
 * Standard action shapes — the two flavours every app uses. Picked via
 * `kind` instead of duplicating the SVG path strings across four call
 * sites. Apps that want a one-off icon can still pass `kind: "custom"`
 * with their own path.
 */
export type FooterActionKind = "digest" | "report" | "custom";

const ACTION_ICONS: Record<Exclude<FooterActionKind, "custom">, string> = {
  // Bell — "Push abonnieren / Subscribe".
  digest: "M3 6a5 5 0 0 1 10 0v3l1.2 1.6a.5.5 0 0 1-.4.8H2.2a.5.5 0 0 1-.4-.8L3 9V6ZM6.5 13a1.5 1.5 0 0 0 3 0",
  // Circled-i — "Problem melden / Report problem".
  report: "M14.5 8a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0ZM8 4.5v4M8 11h.01",
};

export interface FooterAction {
  /** Localised label (also the aria-label). */
  label: string;
  /** Attribute that wires the open behaviour, e.g. `data-contact-open`. */
  openAttr: string;
  /** Picks one of the two standard SVGs, or `"custom"` + a `customIcon` path. */
  kind?: FooterActionKind;
  /** Inline SVG path data — required when `kind === "custom"`. */
  customIcon?: string;
}

export interface FooterLink {
  href: string;
  label: string;
  /** Opens in a new tab + `rel="noopener"`. */
  external?: boolean;
  /** aria-label override for icon-only links. */
  ariaLabel?: string;
  /** Optional inline SVG prepended to the label (e.g. the GitHub mark). */
  icon?: JSX.Element;
}

export interface FooterProps {
  description: string;
  actions: FooterAction[];
  links: FooterLink[];
  toast?: boolean;
}

export function Footer({ description, actions, links, toast = true }: FooterProps) {
  return (
    <footer class="footer">
      <span class="footer__rule" aria-hidden="true" />
      <p class="footer__description">{description}</p>
      {actions.length > 0 ? (
        <div class="footer__actions">
          {actions.map((a) => {
            const path = a.kind === "custom" ? a.customIcon : ACTION_ICONS[a.kind ?? "digest"];
            const buttonProps: Record<string, unknown> = {
              type: "button",
              class: "footer__action",
              "aria-label": a.label,
              [a.openAttr]: true,
            };
            return (
              <button key={a.label} {...buttonProps}>
                <svg
                  viewBox="0 0 16 16"
                  width="13"
                  height="13"
                  aria-hidden="true"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                >
                  <path d={path} stroke-linecap="round" />
                </svg>
                <span>{a.label}</span>
              </button>
            );
          })}
        </div>
      ) : null}
      <div class="footer__links">
        {links.map((l, i) => (
          <Fragment key={l.href}>
            {i > 0 ? (
              <span class="footer__sep" aria-hidden="true">
                ·
              </span>
            ) : null}
            <a
              href={l.href}
              target={l.external ? "_blank" : undefined}
              rel={l.external ? "noopener" : undefined}
              aria-label={l.ariaLabel}
            >
              {l.icon ?? null}
              {l.label}
            </a>
          </Fragment>
        ))}
      </div>
      {toast ? <span class="footer__toast" role="status" aria-live="polite" /> : null}
    </footer>
  );
}
