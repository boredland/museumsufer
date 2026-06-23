import { classifyMusic, classifyTalk, detectTalkLanguage, looksLikeMusic } from "@museumsufer/classify";
import { todayIso } from "@museumsufer/core/date";
import { HTML_EVENTS_CACHE } from "../data/html-events-cache";
import type { RawProgrammeEvent } from "../programme-events";
import type { CanonicalScrapedEvent, ScrapedLabel, VenueScrapeResult } from "../types";

/**
 * Hamburger Studienbibliothek (HSB) — studienbibliothek.org. A small
 * critical-theory library in Hamburg-Rothenburgsort whose evening programme —
 * avant-garde "Bibliothekskonzerte", talks, discussions — is published only as
 * free German prose in the index page's news feed: no API, no microdata, dates
 * buried mid-sentence ("Montag, 22. Juni 2026, 20 Uhr"), layout per item.
 *
 * So it is NOT parsed during the scrape. `scripts/refresh-html-cache.ts` is run
 * by hand, has the AI proxy structure the page text, and commits the result to
 * `src/data/html-events-cache.ts` (see AGENTS.md — an LLM call is
 * non-deterministic + network-bound and never belongs in `scrape()`). This
 * scraper reads only that committed cache, so reruns stay deterministic + offline.
 *
 * NOT the Stabi (Staats- und Universitätsbibliothek, blog.sub.uni-hamburg.de),
 * which is the separate `stabi-hamburg` scraper.
 */
const TAG = "hamburger-studienbibliothek";
const PAGE_URL = "https://www.studienbibliothek.org/index.shtml";

export async function scrapeHamburgerStudienbibliothek(): Promise<VenueScrapeResult> {
  const today = todayIso();
  const cached = HTML_EVENTS_CACHE[TAG];
  const events = (cached?.events ?? [])
    .map((r) => toCanonical(r, today))
    .filter((e): e is CanonicalScrapedEvent => e !== null);
  return { source_slug: TAG, display_name: "Hamburger Studienbibliothek", events };
}

function toCanonical(r: RawProgrammeEvent, today: string): CanonicalScrapedEvent | null {
  // Filter past events in-code (after the cache read) — keeps the cache
  // today-independent and the build deterministic for same-day reruns.
  if ((r.end_date ?? r.date) < today) return null;
  const description = r.description ?? null;
  return {
    source_event_id: `${r.date}|${r.time ?? ""}|${r.title}`,
    title: r.title,
    description,
    date: r.date,
    time: r.time ?? null,
    end_date: r.end_date ?? null,
    end_time: r.end_time ?? null,
    detail_url: PAGE_URL,
    performers: r.performers ?? null,
    price_min: r.price_min ?? null,
    language: detectTalkLanguage(r.title, description),
    labels: labelsFor(r.title, description),
  };
}

/** HSB runs two event classes: avant-garde "Bibliothekskonzerte" (→ music, genre
 *  refined from the description, defaulting to experimental for this venue) and
 *  political talks/discussions/readings (→ talk:*). Music wins only on an explicit
 *  music signal; everything else is a talk, matching the venue's lecture core. */
function labelsFor(title: string, description: string | null): ScrapedLabel[] {
  // Every HSB concert is titled "Bibliothekskonzert"; that compound slips past
  // looksLikeMusic's \bkonzert\b boundary, so match the substring directly.
  if (/konzert/i.test(title) || looksLikeMusic(title, description)) {
    const genre = classifyMusic(title, null, description, "experimental");
    return [{ label: `music:${genre}`, confidence: 0.9, classifier: "keyword:music" }];
  }
  const category = classifyTalk(title, description).toLowerCase();
  return [{ label: `talk:${category}`, confidence: 0.9, classifier: "keyword:talk" }];
}
