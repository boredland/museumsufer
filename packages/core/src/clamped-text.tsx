/**
 * Shared "clamped text + read-more" disclosure.
 *
 * A `<details>` whose *summary* carries the text: collapsed it renders a
 * line-clamped preview, open it renders the same node unclamped. So a short
 * description stays fully readable without interacting, and only a genuinely
 * long one grows a control.
 *
 * That inversion is the point. A plain `<details>` hides its content until
 * opened, burying one-line synopses behind a click; a bare CSS clamp shows a
 * preview but leaves the overflow unreachable. This does neither — and because
 * the text lives in exactly one node, crawlers and screen readers see it once,
 * not duplicated across a preview and a full copy.
 *
 * Text that cannot overflow the clamp renders as a plain paragraph: CSS cannot
 * measure overflow, so the decision is made here from a character estimate
 * rather than showing a dead "more" control next to a one-line synopsis.
 *
 * No JavaScript: the toggle is the native `<details>` marker, so it survives
 * htmx swaps and works before hydration. `--clamp-lines` sets the collapsed
 * height; the markup hooks (`.clamped`, `.clamped__text`, `.clamped__more`)
 * are uniform so each app styles them in its own register.
 */

/** Rough characters per rendered line, used only to decide whether the text can
 *  overflow the clamp at all. Deliberately conservative: over-estimating the
 *  line length would drop the control from something that does overflow, while
 *  under-estimating only shows it on a borderline case. */
const CHARS_PER_LINE = 60;

export interface ClampedTextProps {
  text: string;
  /** Localised control label, e.g. "Mehr" / "More". */
  moreLabel: string;
  /** Collapsed height in lines. Defaults to 3. */
  lines?: number;
  /** Class applied to the wrapper (and to the paragraph in the short case), so
   *  both shapes share the app's typography. */
  class?: string;
}

export function ClampedText({ text, moreLabel, lines = 3, class: extra }: ClampedTextProps) {
  if (text.length <= lines * CHARS_PER_LINE) {
    return <p class={extra ? `clamped-plain ${extra}` : "clamped-plain"}>{text}</p>;
  }
  return (
    <details class={extra ? `clamped ${extra}` : "clamped"} style={`--clamp-lines:${lines}`}>
      <summary class="clamped__summary">
        <span class="clamped__text">{text}</span>
        <span class="clamped__more" aria-hidden="true">
          {moreLabel}
        </span>
      </summary>
    </details>
  );
}
