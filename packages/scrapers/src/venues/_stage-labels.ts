import {
  classifyDance,
  classifyMusic,
  classifyTalk,
  isWorkshopTitle,
  looksLikeMusic,
  looksLikeNonProgramme,
} from "@museumsufer/classify";
import type { ScrapedLabel } from "../types";

/**
 * Shared label resolver for stage venues (theaters, opera houses, performance
 * spaces). Most venues emit `stage:theater` — but the larger houses
 * (Schauspiel, Oper, Mousonturm, English Theatre) mix theatre with ballet
 * (`dance:*`), opera/concerts (`music:*`), and talks (`talk:*`).
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

/** Fallback must not mint a concert for a reading, slam or comedy night that merely sits in a music hall. */
const NOT_A_CONCERT_RE = /\b(?:lesung|roman|buch|autor(?:in)?|poetry|slam|comedy|kabarett|stand-?up|vortrag|wissenschaft)\b/i;

export function resolveStageLabels(opts: StageLabelOptions): ScrapedLabel[] {
  const haystack = `${opts.title} ${opts.subtitle ?? ""} ${opts.hint ?? ""}`.toLowerCase();
  const classifier = opts.classifier ?? "upstream-tag";
  const confidence = opts.confidence ?? 0.9;
  // Quiz/bingo/karaoke/advice hours and "Workshop: …" sessions are calendar entries, not performances.
  if (looksLikeNonProgramme(opts.title)) return [{ label: "event:venue", confidence: 0.5, classifier }];
  if (isWorkshopTitle(opts.title)) return [{ label: "talk:workshop", confidence: 0.7, classifier }];
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
    const genre = classifyDance(opts.title, opts.subtitle, opts.hint, "contemporary");
    labels.push({ label: `dance:${genre}`, confidence, classifier });
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
    const fallback = opts.defaultLabel ?? "stage:theater";
    const concertFallback = fallback.startsWith("music:") && NOT_A_CONCERT_RE.test(haystack);
    labels.push({ label: concertFallback ? "event:venue" : fallback, confidence, classifier });
  }
  return labels;
}
