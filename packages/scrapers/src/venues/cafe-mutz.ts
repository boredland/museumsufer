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
 * Since the autumn 2026 programme the date leads the post title without a
 * year — "Mi, 30. Sept – FilmClub »Gelbe Briefe«", "Mi + Do, 4. u. 5. Nov:
 * Anna Liebst singt" — and the body only carries "Beginn: 19 Uhr". Earlier
 * posts opened the body with a numeric date line ("Mi, 17.06.2026 – 19:30
 * Uhr", "Doppelkonzert am 24. und 25.06.2026"), still read as the fallback.
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
/** Title prefix: weekday(s), then "30. Sept" / "4. u. 5. Nov", then "–" or ":". */
const TITLE_DATE_RE =
  /^[A-Za-z]{2}(?:\s*[+&]\s*[A-Za-z]{2})?,\s*((?:\d{1,2}\.\s*(?:u\.|und|&|,)?\s*)+)([A-Za-zä]{3,})\.?\s*[–:-]\s*/;
/** "Beginn: 19 Uhr" / "Beginn: 19:30 Uhr". */
const BEGIN_RE = /Beginn:?\s*(\d{1,2})(?:[:.](\d{2}))?\s*Uhr/;
const MONTH_PREFIX: Record<string, string> = {
  jan: "01",
  feb: "02",
  mär: "03",
  mar: "03",
  apr: "04",
  mai: "05",
  jun: "06",
  jul: "07",
  aug: "08",
  sep: "09",
  okt: "10",
  nov: "11",
  dez: "12",
};

const FILM_RE = /\bfilm(?:club)?\b|\bkino\b/i;
const MUSIC_HINT_RE = /\bkonzert|musik|weltmusik|band|chor|live\b|\bfolk\b|jazz|singt\b/i;
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
    const fullTitle = stripHtml(decodeEntities(post.title.rendered)).replace(/\s+/g, " ").trim();
    if (!fullTitle) continue;

    const body = `${stripHtml(decodeEntities(post.excerpt.rendered))} ${stripHtml(decodeEntities(post.content.rendered))}`;
    const fromTitle = parseTitleDates(fullTitle, today);
    const title = fromTitle ? fullTitle.slice(fromTitle.prefixLength).trim() : fullTitle;
    const dates = fromTitle?.dates ?? parseDates(body);
    if (dates.length === 0 || !title) continue; // intro / undated posts (e.g. "Kultur im Mutz")

    const begin = BEGIN_RE.exec(body);
    const timeMatch = begin ? null : TIME_RE.exec(body);
    const time = begin
      ? `${begin[1].padStart(2, "0")}:${begin[2] ?? "00"}`
      : timeMatch
        ? `${timeMatch[1].padStart(2, "0")}:${timeMatch[2]}`
        : null;

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

/** Dates from a "Mi, 30. Sept – …" title. The title has no year: the event
 *  is taken to fall within the next ~10 months, so a month more than two
 *  months behind today rolls into next year. */
function parseTitleDates(title: string, today: string): { dates: string[]; prefixLength: number } | null {
  const m = TITLE_DATE_RE.exec(title);
  const month = m ? MONTH_PREFIX[m[2].slice(0, 3).toLowerCase()] : undefined;
  if (!m || !month) return null;
  const thisYear = Number(today.slice(0, 4));
  const year = Number(month) < Number(today.slice(5, 7)) - 2 ? thisYear + 1 : thisYear;
  const days = [...new Set(m[1].match(/\d{1,2}/g) ?? [])];
  return { dates: days.map((d) => `${year}-${month}-${d.padStart(2, "0")}`), prefixLength: m[0].length };
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
