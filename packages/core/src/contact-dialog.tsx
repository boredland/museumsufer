/**
 * Shared "Problem melden" / "Feedback" contact dialog. Drops into each app's
 * <body> and is opened by any element with [data-contact-open]; closed by
 * [data-contact-close] inside the dialog. The form posts to /api/contact
 * (Turnstile-verified, routed to feedback@<app-domain> via Cloudflare Email
 * Routing).
 *
 * Each app passes a localised translation object plus the dropdown category
 * options. Class vocabulary (`.dialog`, `.dialog__head`, `.field`,
 * `.btn-primary`) is canonical — every app's stylesheet styles the same
 * hooks; only typography + colour differ per design.
 */
export interface ContactCategory {
  /** Value sent in the form body. */
  value: string;
  /** Localised option label shown in the <select>. */
  label: string;
}

export interface ContactDialogTr {
  title: string;
  close: string;
  /** Short pitch line above the fields (theaters/konzert/landau show one; museums omits — pass empty string). */
  intro?: string;
  /** "Betrifft" eyebrow for the "regarding" line (auto-filled by client when opened from a card). */
  regarding: string;
  categoryLabel: string;
  emailLabel: string;
  emailPlaceholder?: string;
  messageLabel: string;
  messagePlaceholder?: string;
  submit: string;
}

export interface ContactDialogProps {
  tr: ContactDialogTr;
  /** Three category options shown in the <select>. */
  categories: ContactCategory[];
  /** Turnstile site key. When omitted the widget isn't rendered (eg. local dev). */
  turnstileSiteKey?: string;
  /** Whether the email field is required. Defaults to false. */
  emailRequired?: boolean;
  /** Optional wide-variant flag — matches Museums' 30rem max-width style. */
  wide?: boolean;
}

export function ContactDialog({ tr, categories, turnstileSiteKey, emailRequired, wide }: ContactDialogProps) {
  return (
    <dialog id="contact-dialog" class={`dialog${wide ? " dialog--wide" : ""}`}>
      <form id="contact-form" class="dialog__form" novalidate>
        <div class="dialog__head">
          <h2 class="dialog__title">{tr.title}</h2>
          <button type="button" data-contact-close aria-label={tr.close} class="dialog__close">
            <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20" aria-hidden="true">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z" />
            </svg>
          </button>
        </div>

        {tr.intro ? <p class="dialog__intro">{tr.intro}</p> : null}

        <div id="contact-regarding" hidden class="dialog__regarding">
          <span class="dialog__regarding-kicker">{tr.regarding}</span>
          <span id="contact-regarding-text" class="dialog__regarding-text" />
        </div>

        <label class="field">
          <span class="field__label">{tr.categoryLabel}</span>
          <select id="contact-category" name="category" required class="field__select">
            {categories.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>

        <label class="field">
          <span class="field__label">{tr.emailLabel}</span>
          <input
            type="email"
            id="contact-email"
            name="email"
            required={emailRequired}
            placeholder={tr.emailPlaceholder}
            class="field__input"
          />
        </label>

        <label class="field">
          <span class="field__label">{tr.messageLabel}</span>
          <textarea
            id="contact-message"
            name="message"
            required
            rows={4}
            placeholder={tr.messagePlaceholder}
            class="field__textarea"
          />
        </label>

        <input type="hidden" id="contact-context" name="context" />

        {turnstileSiteKey ? (
          <div class="cf-turnstile" data-sitekey={turnstileSiteKey} data-size="flexible" data-theme="auto" />
        ) : null}

        <div class="dialog__footer">
          <p id="contact-status" hidden class="dialog__status" aria-live="polite" />
          <button type="submit" id="contact-submit" class="btn-primary">
            {tr.submit}
          </button>
        </div>
      </form>
    </dialog>
  );
}
