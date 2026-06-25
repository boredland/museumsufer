import { todayIso } from "@museumsufer/core/date";
import { decodeEntities } from "@museumsufer/core/html";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";

const BASE = "https://www.staatstheater-mainz.com";
const MONTHS = [
  "januar",
  "februar",
  "märz",
  "april",
  "mai",
  "juni",
  "juli",
  "august",
  "september",
  "oktober",
  "november",
  "dezember",
];
const UA = "Mozilla/5.0 (compatible; Museumsufer/1.0)";

/**
 * Staatstheater Mainz — flagship theatre. The schedule is server-rendered
 * monthly HTML at `/uebersicht/{month}`. Each day row contains hidden
 * performance blocks: `<div id="t{YYYYMMDD}{slug}">` with:
 * - `<span class="single_location">` — stage
 * - Time + category link
 * - `<a class="titel" href="...">` — title
 * - `<p>` subtitle, `<a class="kk_link">` ticket (Eventim)
 */
export async function scrapeStaatstheaterMainz(): Promise<VenueScrapeResult> {
  const today = todayIso();
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const allEvents: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();

  for (let mi = currentMonth; mi <= currentMonth + 2; mi++) {
    const m = mi % 12;
    const monthName = MONTHS[m];
    const year = mi >= 12 ? currentYear + 1 : currentYear;
    try {
      const res = await fetch(`${BASE}/uebersicht/${monthName}`, { headers: { "User-Agent": UA } });
      if (!res.ok) continue;
      const events = parseMonth(await res.text(), year, m, today, seen);
      allEvents.push(...events);
    } catch {
      /* month not published yet */
    }
  }

  return { source_slug: "staatstheater-mainz", display_name: "Staatstheater Mainz", events: allEvents };
}

function parseMonth(
  html: string,
  year: number,
  monthIdx: number,
  today: string,
  seen: Set<string>,
): CanonicalScrapedEvent[] {
  const month = monthIdx + 1;
  const events: CanonicalScrapedEvent[] = [];

  const anchorRe = /<div\s+id=['"]t(\d{8})([^'"]*)['"]/g;
  let anchor: RegExpExecArray | null;
  while ((anchor = anchorRe.exec(html)) !== null) {
    const dateStr = anchor[1];
    if (!dateStr || dateStr.length !== 8) continue;
    const day = parseInt(dateStr.slice(6, 8), 10);
    const m = parseInt(dateStr.slice(4, 6), 10);
    const y = parseInt(dateStr.slice(0, 4), 10);
    if (m !== month) continue;
    const date = `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    if (date < today) continue;

    const block = html.slice(anchor.index, anchor.index + 3000);

    // Stage: <span class='single_location'>Großes Haus<br/></span>
    const locMatch = block.match(/<span\s+class=['"]single_location['"]>([^<]+)</);
    const venue = locMatch ? decodeEntities(locMatch[1].trim()) : null;

    // Time: 19:30-22:00 → Oper
    const timeMatch = block.match(
      /(\d{1,2}):(\d{2})(?:\s*[-–]\s*(\d{1,2}):(\d{2}))?\s*→\s*(?:<a[^>]*>)?([^<]+)(?:<\/a>)?/,
    );
    let time: string | null = null;
    let endTime: string | null = null;
    let category: string | null = null;
    if (timeMatch) {
      time = `${timeMatch[1].padStart(2, "0")}:${timeMatch[2]}`;
      if (timeMatch[3]) endTime = `${timeMatch[3].padStart(2, "0")}:${timeMatch[4]}`;
      category = timeMatch[5].trim();
    }

    // "18:45 Einführung" (intro talk, not main event — skip as standalone)
    const einfMatch = block.match(/(\d{1,2}):(\d{2})\s+Einführung/);
    if (einfMatch && !timeMatch) continue; // standalone "Einführung" is not a performance

    // Title: <a class='titel' href='...'>Falstaff</a>
    const titleMatch = block.match(/<a\s+class=['"]titel['"]\s+href=['"]([^'"]+)['"]>([^<]+)<\/a>/);
    if (!titleMatch) continue;
    const detailUrl = titleMatch[1].startsWith("http") ? titleMatch[1] : `${BASE}${titleMatch[1]}`;
    const title = decodeEntities(titleMatch[2].trim());

    // Subtitle: <p>Giuseppe Verdi (1893)</p>
    const subMatch = block.match(/<p>([^<]+)<\/p>/);
    const subtitle = subMatch ? decodeEntities(subMatch[1].trim()) : null;

    // Ticket: <a class='kk_link' href='...'>Karten kaufen</a>
    const ticketMatch = block.match(/<a\s+[^>]*class=['"]kk_link['"][^>]*href=['"]([^'"]+)['"]/);
    const ticketUrl = ticketMatch ? ticketMatch[1] : null;

    const key = `${title}|${date}|${time ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);

    events.push({
      source_event_id: key,
      title,
      description: subtitle,
      date,
      time,
      end_time: endTime,
      detail_url: detailUrl,
      ticket_url: ticketUrl,
      venue_room: venue,
      raw_category: category,
      labels: buildLabels(title, category),
    });
  }

  return events;
}

function buildLabels(
  title: string,
  category: string | null,
): Array<{ label: string; confidence: number; classifier: "scraper-hardcoded" }> {
  const labels: Array<{ label: string; confidence: number; classifier: "scraper-hardcoded" }> = [
    { label: "stage:theater", confidence: 0.95, classifier: "scraper-hardcoded" },
  ];
  const t = title.toLowerCase();
  if (category === "Oper" || t.includes("oper")) {
    labels.push({ label: "music:opera", confidence: 0.8, classifier: "scraper-hardcoded" });
  } else if (category === "Tanz" || t.includes("tanz") || t.includes("ballett")) {
    labels.push({ label: "stage:dance", confidence: 0.8, classifier: "scraper-hardcoded" });
  } else if (category === "Konzert" || t.includes("konzert")) {
    labels.push({ label: "music:classical", confidence: 0.8, classifier: "scraper-hardcoded" });
  } else if (category === "Schauspiel" || t.includes("schauspiel")) {
    labels.push({ label: "stage:drama", confidence: 0.8, classifier: "scraper-hardcoded" });
  }
  return labels;
}
