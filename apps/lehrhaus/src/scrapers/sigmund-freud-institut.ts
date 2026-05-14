import { todayIso } from "@museumsufer/core/date";
import { GERMAN_MONTHS } from "@museumsufer/core/german";
import { decodeEntities, stripHtml } from "@museumsufer/core/html";
import type { ScrapedEvent } from "../types";
import { talkCategory } from "./shared";

const API_URL = "https://sigmund-freud-institut.de/index.php/wp-json/wp/v2/posts?categories=4&per_page=100";
const UA = "lehrhaus crawler / contact: jonas@bgdlabs.com";

// "am DD. Month YYYY[ um/ab HH:MM[ Uhr]]"
const DATE_TIME_RE =
  /\bam\s+(\d{1,2})\.\s+(Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\s+(\d{4})(?:\s+(?:um|ab)\s+(\d{1,2}):(\d{2})\s*(?:Uhr)?)?/i;

interface WpPost {
  link: string;
  title: { rendered: string };
}

export async function scrapeSigmundFreudInstitut(): Promise<ScrapedEvent[]> {
  const today = todayIso();
  const res = await fetch(API_URL, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`sigmund-freud-institut fetch failed: ${res.status}`);
  const posts: WpPost[] = await res.json();
  const events: ScrapedEvent[] = [];

  for (const post of posts) {
    const title = stripHtml(decodeEntities(post.title.rendered)).trim();
    const m = DATE_TIME_RE.exec(title);
    if (!m) continue;

    const monthNum = GERMAN_MONTHS[m[2].toLowerCase()];
    if (!monthNum) continue;
    const date = `${m[3]}-${String(monthNum).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    if (date < today) continue;

    const time = m[4] ? `${m[4].padStart(2, "0")}:${m[5]}` : null;

    events.push({
      title,
      date,
      time,
      detail_url: post.link,
      category: talkCategory(title),
    });
  }

  return events;
}
