import { detectTalkLanguage } from "@museumsufer/classify";
import { todayIso } from "@museumsufer/core/date";
import { decodeEntities, stripHtml } from "@museumsufer/core/html";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";

const API_URL = "https://blog.sub.uni-hamburg.de/index.php?rest_route=/wp/v2/posts&categories=9&per_page=100";

interface WPPost {
  id: number;
  date: string;
  link: string;
  title: { rendered: string };
  content: { rendered: string };
  excerpt: { rendered: string };
}

/**
 * Stabi Hamburg — the Staats- und Universitätsbibliothek Hamburg Carl von
 * Ossietzky (SUB), Von-Melle-Park. Its event posts live in the WordPress blog
 * under category 9. NOT the Hamburger Studienbibliothek (studienbibliothek.org),
 * which is a separate critical-theory library scraped in `hamburger-studienbibliothek.ts`.
 */
export async function scrapeStabiHamburg(): Promise<VenueScrapeResult> {
  const today = todayIso();
  const res = await fetch(API_URL);
  if (!res.ok) throw new Error(`stabi-hamburg fetch failed: ${res.status}`);
  const posts = (await res.json()) as WPPost[];

  const events: CanonicalScrapedEvent[] = [];

  for (const post of posts) {
    const title = decodeEntities(post.title.rendered).trim();

    // Skip exhibitions or general program flyers
    if (/^ausstellung:|sommerprogramm|veranstaltungsflyer/i.test(title)) continue;

    const excerpt = decodeEntities(post.excerpt.rendered);
    const content = decodeEntities(post.content.rendered);

    // Try to parse date, time from content/excerpt
    const parsed = parseEventDateTime(title, content || excerpt, post.date);
    if (!parsed) continue;

    const { date, time, end_time } = parsed;
    if (date < today) continue;

    const description = stripHtml(content).trim().slice(0, 600) || null;

    // Detect type of lecture
    let label = "talk:vortrag";
    if (/diskussion|podium/i.test(title)) {
      label = "talk:diskussion";
    } else if (/lesung/i.test(title)) {
      label = "talk:lesung";
    }

    events.push({
      source_event_id: String(post.id),
      title: title.replace(/\s*\(\d{1,2}\.\d{1,2}\.?\)/, "").trim(), // Strip date from title
      date,
      time,
      end_time,
      description,
      detail_url: post.link,
      language: detectTalkLanguage(title, description),
      labels: [{ label, confidence: 0.95, classifier: "scraper-hardcoded" }],
    });
  }

  return {
    source_slug: "stabi-hamburg",
    display_name: "Stabi Hamburg",
    events,
  };
}

function parseEventDateTime(title: string, text: string, postDateStr: string) {
  const cleanText = stripHtml(text).trim();

  // Look for: "Dienstag, 16.6., 18 Uhr, Vortragsraum"
  // or "Montag, 29.6., 17.30 Uhr bis 19.30 Uhr, Vortragsraum"
  const timeRegex =
    /(?:Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag),\s*(\d{1,2})\.(\d{1,2})\.,\s*(\d{1,2}(?:\.\d{2})?)\s*Uhr(?:\s*(?:bis|-)\s*(\d{1,2}(?:\.\d{2})?)\s*Uhr)?/i;
  const match = cleanText.match(timeRegex);

  let day = 0;
  let month = 0;
  let startTimeStr: string | null = null;
  let endTimeStr: string | null = null;

  if (match) {
    day = parseInt(match[1], 10);
    month = parseInt(match[2], 10);
    startTimeStr = match[3].replace(".", ":");
    if (!startTimeStr.includes(":")) startTimeStr += ":00";
    if (startTimeStr.length === 4) startTimeStr = `0${startTimeStr}`;

    if (match[4]) {
      endTimeStr = match[4].replace(".", ":");
      if (!endTimeStr.includes(":")) endTimeStr += ":00";
      if (endTimeStr.length === 4) endTimeStr = `0${endTimeStr}`;
    }
  } else {
    // Fallback: title date parsing e.g. (29.6.)
    const titleMatch = title.match(/\((\d{1,2})\.(\d{1,2})\.?\)/);
    if (titleMatch) {
      day = parseInt(titleMatch[1], 10);
      month = parseInt(titleMatch[2], 10);
    }
  }

  if (day === 0 || month === 0) return null;

  const postDate = new Date(postDateStr);
  const currentYear = postDate.getFullYear();
  const currentMonth = postDate.getMonth() + 1;

  // If the event month is smaller than the post publish month, it is likely next year
  const year = month < currentMonth - 2 ? currentYear + 1 : currentYear;

  const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return {
    date: dateStr,
    time: startTimeStr,
    end_time: endTimeStr,
  };
}
