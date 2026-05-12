/**
 * Shared FAQ section. Each app passes a localised kicker + count label and the
 * list of items; the markup vocabulary (`.faq`, `.faq__head`, `.faq__row` …)
 * is uniform so a single set of CSS hooks styles all four apps' FAQ blocks.
 *
 * The first item opens by default (most common Q first); subsequent items are
 * collapsed. The toggle glyph is `.faq__toggle` and rotates via the
 * `.faq__item[open]` selector — styling lives in each app's stylesheet.
 */
import type { FaqItem } from "./faq";

export interface FaqProps {
  /** Section eyebrow, e.g. "Häufige Fragen" / "FAQ" / "Questions fréquentes". */
  kicker: string;
  /** Question/answer pairs. The first opens by default. */
  items: FaqItem[];
  /** Optional override for the right-aligned count label. Defaults to "01 — NN". */
  countLabel?: string;
  /** Optional aria-labelledby target — defaults to "faq-title". */
  id?: string;
}

export function Faq({ kicker, items, countLabel, id = "faq-title" }: FaqProps) {
  const total = String(items.length).padStart(2, "0");
  const label = countLabel ?? `01 — ${total}`;
  return (
    <section class="faq" aria-labelledby={id}>
      <header class="faq__head">
        <span class="faq__kicker" id={id}>
          {kicker}
        </span>
        <span class="faq__rule" aria-hidden="true" />
        <span class="faq__count">{label}</span>
      </header>
      <div class="faq__list">
        {items.map((item, i) => (
          <details key={`faq-${i}`} class="faq__item" open={i === 0 ? true : undefined}>
            <summary class="faq__row">
              <span class="faq__num" aria-hidden="true">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 class="faq__q">{item.q}</h3>
              <span class="faq__toggle" aria-hidden="true" />
            </summary>
            <p class="faq__a">{item.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
