/**
 * Shared "Ask your AI" deep-link row. Each app passes a localised label,
 * aria text and a date-context prompt; the LLM_SERVICES list is rendered
 * uniformly across the four apps. Visual hooks (`askai`, `askai__label`,
 * `askai__row`, `askai__svc`) come from each app's inline-CSS.
 */
import { LLM_SERVICES } from "./llm-services";

export interface AskAiProps {
  /** Label preceding the icon row, e.g. "Frag eine KI" / "Ask an AI". */
  label: string;
  /** Aria-label / accessible description for the <section>. */
  aria: string;
  /** Pre-filled prompt; each service's buildUrl(prompt) wraps it for that target. */
  prompt: string;
}

export function AskAi({ label, aria, prompt }: AskAiProps) {
  return (
    <section class="askai" aria-label={aria}>
      <span class="askai__label">{label}</span>
      <div class="askai__row">
        {LLM_SERVICES.map((s) => (
          <a
            key={s.name}
            class="askai__svc"
            href={s.buildUrl(prompt)}
            target="_blank"
            rel="noopener"
            aria-label={s.name}
            title={s.name}
            style={`color:${s.color}`}
          >
            <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true" fill="currentColor">
              <path d={s.svgPath} />
            </svg>
          </a>
        ))}
      </div>
    </section>
  );
}
