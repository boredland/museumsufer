import { classifyMusic, classifyTalk, detectTalkLanguage, looksLikeMusic } from "@museumsufer/classify";
import { todayIso } from "@museumsufer/core/date";
import { decodeEntities, stripHtml } from "@museumsufer/core/html";
import type { CanonicalScrapedEvent, ScrapedLabel, VenueScrapeResult } from "../types";

/**
 * Café Mutz in Frankfurt-Niederursel runs a small cultural programme out of
 * its hall ("Kultur im Mutz", WordPress category 4): readings, world-music and
 * folk concerts, and a FilmClub. Like denkbar, one feed mixes genres, so we
 * emit each post with a `music:*`, `film:*` or `talk:*` label and let the
 * downstream apps pick.
 *
 * Unlike most WP feeds the event date isn't in the post title — it opens the
 * body as a German numeric date line, e.g. "Mi, 17.06.2026 – 19:30 Uhr" or
 * "Doppelkonzert am 24. und 25.06.2026 – 19:00 Uhr" (two performances).
 */
const API_URL =
  "https://www.cafemutz.de/wp-json/wp/v2/posts?categories=4&per_page=50&_fields=id,slug,link,title,excerpt,content";
const UA = "museumsufer event-hub crawler / contact: jonas@bgdlabs.com";

// A full DD.MM.YYYY date (day may be single-digit).
const DATE_RE = /(\d{1,2})\.(\d{1,2})\.(\d{4})/;
// "24. und 25.06.2026" / "24., 25. & 26.06.2026" — leading bare days sharing
// the trailing month + year. Captures the bare day list and the full date.
const MULTI_DAY_RE = /((?:\d{1,2}\.\s*(?:und|,|&|\/|\bbis\b)\s*)+)(\d{1,2})\.(\d{1,2})\.(\d{4})/i;
const TIME_RE = /(\d{1,2})[:.](\d{2})\s*Uhr/;

const FILM_RE = /\bfilm(?:club)?\b|\bkino\b/i;
const MUSIC_HINT_RE = /\bkonzert|musik|weltmusik|band|chor|live\b/i;
// classifyTalk doesn't recognise "Lesebühne"; tag reading formats explicitly.
const LESUNG_RE = /lese(?:b[üu]hne|ung)|\blesung\b|poetry|poetry\s*slam|literatur/i;

interface WpPost {
  id: number;
  slug: string;
  link: string;
  title: { rendered: string };
  excerpt: { rendered: string };
  content: { rendered: string };
}

export async function scrapeCafeMutz(): Promise<VenueScrapeResult> {
  const today = todayIso();
  const res = await fetch(API_URL, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`cafe-mutz fetch failed: ${res.status}`);
  const posts: WpPost[] = await res.json();
  const events: CanonicalScrapedEvent[] = [];

  for (const post of posts) {
    const title = stripHtml(decodeEntities(post.title.rendered)).replace(/\s+/g, " ").trim();
    if (!title) continue;

    // The date opens the body; excerpt usually carries it, content is the fallback.
    const body = `${stripHtml(decodeEntities(post.excerpt.rendered))} ${stripHtml(decodeEntities(post.content.rendered))}`;
    const dates = parseDates(body);
    if (dates.length === 0) continue; // intro / undated posts (e.g. "Kultur im Mutz")

    const timeMatch = TIME_RE.exec(body);
    const time = timeMatch ? `${timeMatch[1].padStart(2, "0")}:${timeMatch[2]}` : null;

    const description = stripHtml(decodeEntities(post.excerpt.rendered)).replace(/\s+/g, " ").trim() || null;
    const labels = classify(title, description);

    for (const date of dates) {
      if (date < today) continue;
      events.push({
        // One post can hold several performances (Doppelkonzert) — keep ids unique.
        source_event_id: dates.length > 1 ? `${post.slug}|${date}` : post.slug,
        title,
        description,
        date,
        time,
        detail_url: post.link,
        ticket_url: post.link,
        language: detectTalkLanguage(title, description),
        labels,
      });
    }
  }

  return { source_slug: "cafe-mutz", display_name: "Café Mutz", events };
}

/** All event dates a post refers to, ISO `YYYY-MM-DD`, in document order. */
function parseDates(text: string): string[] {
  const multi = MULTI_DAY_RE.exec(text);
  if (multi) {
    const mm = multi[3].padStart(2, "0");
    const year = multi[4];
    const leadDays = multi[1].match(/\d{1,2}/g) ?? [];
    const days = [...leadDays, multi[2]];
    return [...new Set(days)].map((d) => `${year}-${mm}-${d.padStart(2, "0")}`);
  }
  const single = DATE_RE.exec(text);
  if (single) {
    return [`${single[3]}-${single[2].padStart(2, "0")}-${single[1].padStart(2, "0")}`];
  }
  return [];
}

function classify(title: string, description: string | null): ScrapedLabel[] {
  if (FILM_RE.test(title)) {
    return [{ label: "film:cinema", confidence: 0.9, classifier: "keyword:event" }];
  }
  if (MUSIC_HINT_RE.test(title) || looksLikeMusic(title, description)) {
    // Niederursel's café programme skews world / folk; default there when the
    // genre classifier can't pin one from the title.
    const genre = classifyMusic(title, null, description, "world");
    return [{ label: `music:${genre}`, confidence: 0.85, classifier: "keyword:music" }];
  }
  if (LESUNG_RE.test(title)) {
    return [{ label: "talk:lesung", confidence: 0.85, classifier: "keyword:talk" }];
  }
  const cat = classifyTalk(title, description).toLowerCase();
  return [{ label: `talk:${cat}`, confidence: 0.8, classifier: "keyword:talk" }];
}
