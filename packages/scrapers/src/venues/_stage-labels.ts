import { classifyMusic, classifyTalk, looksLikeMusic } from "@museumsufer/classify";
import type { ScrapedLabel } from "../types";

/**
 * Shared label resolver for stage venues (theaters, opera houses, performance
 * spaces). Most venues emit `stage:theater` — but the larger houses
 * (Schauspiel, Oper, Mousonturm, English Theatre) mix theatre with ballet
 * (`stage:dance`), opera/concerts (`music:*`), and talks (`talk:*`).
 *
 * The resolver runs cheap keyword probes against title + subtitle and emits
 * one label per matched namespace. When nothing matches the venue's
 * `defaultLabel` is applied (typically `stage:theater`).
 *
 * `classifier` defaults to `"upstream-tag"` because for theaters the source
 * is usually a venue-curated page, not a generic crawl; pass `"scraper-hardcoded"`
 * when the keyword pass is the only signal.
 */
export interface StageLabelOptions {
  title: string;
  subtitle?: string | null;
  /** Extra text to widen the keyword haystack (genre tag, season label). */
  hint?: string | null;
  /** Label emitted when no keyword fires. Defaults to `"stage:theater"`. */
  defaultLabel?: string;
  /** Classifier name attached to emitted labels. */
  classifier?: ScrapedLabel["classifier"];
  /** Default confidence for the matched / fallback label. */
  confidence?: number;
}

export function resolveStageLabels(opts: StageLabelOptions): ScrapedLabel[] {
  const haystack = `${opts.title} ${opts.subtitle ?? ""} ${opts.hint ?? ""}`.toLowerCase();
  const classifier = opts.classifier ?? "upstream-tag";
  const confidence = opts.confidence ?? 0.9;
  const labels: ScrapedLabel[] = [];

  if (/konzert|musik\b/.test(haystack) || looksLikeMusic(opts.title, opts.subtitle ?? opts.hint ?? null)) {
    const genre = classifyMusic(opts.title, opts.subtitle, opts.hint, "classical");
    labels.push({ label: `music:${genre}`, confidence, classifier });
  }
  if (/lesung|buchpräsentation|buchvorstellung|diskurs|diskussion|gespräch|podium|debatte/.test(haystack)) {
    const cat = classifyTalk(opts.title, opts.subtitle ?? opts.hint).toLowerCase();
    labels.push({ label: `talk:${cat}`, confidence, classifier });
  }
  if (/tanz|ballett|performance/.test(haystack)) {
    labels.push({ label: "stage:dance", confidence, classifier });
  }
  if (
    /theater|schauspiel|komödie|kabarett|comedy|variet[eé]|improvisations|figurentheater|puppentheater/.test(haystack)
  ) {
    labels.push({ label: "stage:theater", confidence, classifier });
  }
  if (/familie|kinder|jugend/.test(haystack)) {
    labels.push({ label: "museum:familie", confidence: confidence - 0.05, classifier });
  }

  if (labels.length === 0) {
    labels.push({ label: opts.defaultLabel ?? "stage:theater", confidence, classifier });
  }
  return labels;
}
