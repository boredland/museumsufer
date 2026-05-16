import { classifyMusic, classifyTalk, detectTalkLanguage, looksLikeMusic } from "@museumsufer/classify";
import { todayIso } from "@museumsufer/core/date";
import { GERMAN_MONTHS } from "@museumsufer/core/german";
import { decodeEntities, stripHtml } from "@museumsufer/core/html";
import type { CanonicalScrapedEvent, ScrapedLabel, VenueScrapeResult } from "../types";

const API_URL = "https://denkbar-ffm.de/wp-json/wp/v2/posts?categories=4&per_page=100";
const UA = "museumsufer event-hub crawler / contact: jonas@bgdlabs.com";

const MUSIC_HINT_RE = /\b(jazz|blaue\s+stunde|lieder\s+und\s+arien|acapella|a\s+capella|tag\s+der\s+musik)\b/i;
const MUSIC_TITLE_RE = /\b(konzert|musik)\b/i;

const DATE_PREFIX_RE =
  /^(?:Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag),?\s*(\d{1,2})\.\s+(Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)(?:\s+(\d{4}))?\s*[,·]?\s*/i;

const TIME_STRIP_RE = /^(\d{1,2})(?::(\d{2}))?\s*(?:bis\s+(\d{1,2})(?::(\d{2}))?)?\s*(?:Uhr)?\s*[–\-·]?\s*/i;

interface WpPost {
  slug: string;
  link: string;
  title: { rendered: string };
  excerpt: { rendered: string };
}

/**
 * Denkbar at Schopenhauer-Haus hosts both talks and music evenings out of
 * one WordPress category (#4). Previously two apps each scraped this feed
 * with inverse filters — now we emit everything and tag with `music:*` or
 * `talk:*` so downstream apps can pick.
 */
export async function scrapeDenkbar(): Promise<VenueScrapeResult> {
  const today = todayIso();
  const res = await fetch(API_URL, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`denkbar fetch failed: ${res.status}`);
  const posts: WpPost[] = await res.json();
  const events: CanonicalScrapedEvent[] = [];

  for (const post of posts) {
    const rawTitle = stripHtml(decodeEntities(post.title.rendered.replace(/<br\s*\/?>\s*.*/is, ""))).trim();
    const dateMatch = DATE_PREFIX_RE.exec(rawTitle);
    if (!dateMatch) continue;

    const day = dateMatch[1].padStart(2, "0");
    const monthNum = GERMAN_MONTHS[dateMatch[2].toLowerCase()];
    if (!monthNum) continue;
    const mm = String(monthNum).padStart(2, "0");
    const year = dateMatch[3] ? parseInt(dateMatch[3], 10) : inferYear(day, mm, today);
    const date = `${year}-${mm}-${day}`;
    if (date < today) continue;

    const afterDate = rawTitle.slice(dateMatch[0].length);
    const timeMatch = TIME_STRIP_RE.exec(afterDate);
    let time: string | null = null;
    let endTime: string | null = null;
    let titleRaw: string;
    if (timeMatch) {
      time = `${timeMatch[1].padStart(2, "0")}:${timeMatch[2] ?? "00"}`;
      if (timeMatch[3]) endTime = `${timeMatch[3].padStart(2, "0")}:${timeMatch[4] ?? "00"}`;
      titleRaw = afterDate.slice(timeMatch[0].length);
    } else {
      titleRaw = afterDate;
    }
    const title = titleRaw.replace(/^[–\-·]\s*/, "").trim();
    if (!title) continue;

    const description = stripHtml(decodeEntities(post.excerpt.rendered)).trim() || null;
    const labels: ScrapedLabel[] = [];

    const isMusic = MUSIC_HINT_RE.test(title) || MUSIC_TITLE_RE.test(title) || looksLikeMusic(title, description);
    if (isMusic) {
      const genre = classifyMusic(title, null, description, "jazz");
      labels.push({ label: `music:${genre}`, confidence: 0.9, classifier: "keyword:music" });
    } else {
      const cat = classifyTalk(title, description).toLowerCase();
      labels.push({ label: `talk:${cat}`, confidence: 0.85, classifier: "keyword:talk" });
    }

    events.push({
      source_event_id: post.slug,
      title,
      description,
      date,
      time,
      end_time: endTime,
      detail_url: post.link,
      ticket_url: post.link,
      language: detectTalkLanguage(title, description),
      labels,
    });
  }

  return { source_slug: "denkbar-frankfurt", events };
}

function inferYear(day: string, mm: string, today: string): number {
  const currentYear = parseInt(today.slice(0, 4), 10);
  const candidate = `${currentYear}-${mm}-${day}`;
  return candidate >= today ? currentYear : currentYear + 1;
}
