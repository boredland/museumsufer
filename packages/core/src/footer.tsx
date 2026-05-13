/**
 * Shared editorial footer. Used at the bottom of every public app:
 * hairline rule, short description, action buttons (Subscribe / Report
 * problem), inline links separated by middots (iCal / RSS / API /
 * Impressum / GitHub), and a status toast region.
 *
 * Per-app stylesheet styles `.footer`, `.footer__rule`, `.footer__actions`,
 * `.footer__action`, `.footer__links`, `.footer__sep`, `.footer__toast`.
 */
import type { JSX } from "hono/jsx/jsx-runtime";

export interface FooterAction {
  /** Localised label (also serves as aria-label). */
  label: string;
  /** Attribute name that triggers the open behaviour, e.g. "data-contact-open". */
  openAttr: string;
  /** Inline SVG path data (rendered inside a 16×16 viewBox, stroke=currentColor). */
  icon: string;
  /** Optional stroke-fill flavour for the icon. */
  variant?: "stroke" | "fill";
}

export interface FooterLink {
  /** Anchor href. */
  href: string;
  /** Visible label. */
  label: string;
  /** If true, opens in a new tab with rel=noopener. */
  external?: boolean;
  /** Localised aria-label override (used by icon-only links). */
  ariaLabel?: string;
  /** Optional inline SVG element to prepend (eg. GitHub mark). */
  icon?: JSX.Element;
}

export interface FooterProps {
  /** One-line tagline, e.g. "Eine Übersicht des Spielplans an Frankfurts Bühnen." */
  description: string;
  /** Action buttons row (typically Subscribe + Report). */
  actions: FooterAction[];
  /** Inline links separated by middots. */
  links: FooterLink[];
  /** Whether to render the optional toast status region. */
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
                  fill={a.variant === "fill" ? "currentColor" : "none"}
                  stroke={a.variant === "fill" ? undefined : "currentColor"}
                  stroke-width={a.variant === "fill" ? undefined : "1.5"}
                >
                  <path d={a.icon} stroke-linecap="round" />
                </svg>
                <span>{a.label}</span>
              </button>
            );
          })}
        </div>
      ) : null}
      <div class="footer__links">
        {links.map((l, i) => (
          <>
            {i > 0 ? (
              <span class="footer__sep" aria-hidden="true">
                ·
              </span>
            ) : null}
            <a
              key={l.href}
              href={l.href}
              target={l.external ? "_blank" : undefined}
              rel={l.external ? "noopener" : undefined}
              aria-label={l.ariaLabel}
            >
              {l.icon ?? null}
              {l.label}
            </a>
          </>
        ))}
      </div>
      {toast ? <span class="footer__toast" role="status" aria-live="polite" /> : null}
    </footer>
  );
}
