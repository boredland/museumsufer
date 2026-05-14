import { decodeEntities, GERMAN_MONTHS, stripHtml, todayIso } from "@museumsufer/core";
import { classify } from "../genre-heuristics";
import type { ScrapedEvent, ScrapeResult } from "../types";

const API_URL = "https://denkbar-ffm.de/wp-json/wp/v2/posts?categories=4&per_page=100";
const UA = "konzert.haus crawler / contact: jonas@bgdlabs.com";

// Include only music performances; talks go to lehrhaus instead.
const MUSIC_KEEP_RE = /\b(jazz|blaue\s+stunde|lieder\s+und\s+arien|acapella|a\s+capella|tag\s+der\s+musik)\b/i;
const MUSIC_TITLE_RE = /\b(konzert|musik)\b/i;

// "Weekday,? DD. Month[ YYYY][,·]"
const DATE_PREFIX_RE =
  /^(?:Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag),?\s*(\d{1,2})\.\s+(Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)(?:\s+(\d{4}))?\s*[,·]?\s*/i;

// "HH[:MM][ bis HH[:MM]][ Uhr][–/-· ]"
const TIME_STRIP_RE = /^(\d{1,2})(?::(\d{2}))?\s*(?:bis\s+(\d{1,2})(?::(\d{2}))?)?\s*(?:Uhr)?\s*[–\-·]?\s*/i;

interface WpPost {
  slug: string;
  link: string;
  title: { rendered: string };
  excerpt: { rendered: string };
}

export async function scrapeDenkbar(): Promise<ScrapeResult> {
  const today = todayIso();
  const res = await fetch(API_URL, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`denkbar fetch failed: ${res.status}`);
  const posts: WpPost[] = await res.json();
  const events: ScrapedEvent[] = [];

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

    if (!MUSIC_KEEP_RE.test(title) && !MUSIC_TITLE_RE.test(title)) continue;

    const description = stripHtml(decodeEntities(post.excerpt.rendered)).trim() || null;
    const slug = `denkbar-${post.slug}`;

    events.push({
      slug,
      title,
      description,
      date,
      time,
      end_time: endTime,
      genre: classify(title, null, description, "jazz"),
      detail_url: post.link,
      ticket_url: post.link,
    });
  }

  return { venue_slug: "denkbar", events };
}

function inferYear(day: string, mm: string, today: string): number {
  const currentYear = parseInt(today.slice(0, 4), 10);
  const candidate = `${currentYear}-${mm}-${day}`;
  return candidate >= today ? currentYear : currentYear + 1;
}
