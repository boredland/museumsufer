import { detectTalkLanguage } from "@museumsufer/core/classify";
import { todayIso } from "@museumsufer/core/date";
import { GERMAN_MONTHS } from "@museumsufer/core/german";
import { decodeEntities, stripHtml } from "@museumsufer/core/html";
import type { ScrapedEvent } from "../types";
import { talkCategory } from "./shared";

const BASE = "https://www.romanfabrik.de";
const CALENDAR_URL = `${BASE}/programm/kalender`;
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

// Romanfabrik TYPO3/calendarize: each event is a <li class="event-NNN panel panel-default state-STATE CATEGORIES">
// For lehrhaus we want "Text" (literary readings) and "Thema" (public discourse/lectures) — not "Ton" (music).
// "Thema" is broad at Romanfabrik (includes flea markets, tournaments), so we also apply a title drop-list.
const EVENT_LI_RE = /<li\s+class="event-\d+\s+panel\s+panel-default\s+state-([A-Za-z-]+)\s+([^"]*)"[\s\S]*?<\/li>/g;
const DROP_RE = /\b(konzert|quartett|quartet|trio|duo|jazz|flohmarkt|turnier|tanzabend|jam\s*session)\b/i;
const TITLE_LINK_RE = /<h3>\s*<a\s+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>\s*<\/h3>/;
const FULL_DATE_RE =
  /(Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag),\s+(\d{1,2})\.\s+(Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\s+(\d{4})/;
const HEADER_DATE_RE = /<div\s+class="eventHeader[^"]*">\s*(\d{1,2})\/<span\s+class="head-dat-small">(\d{1,2})<\/span>/;
const TIME_RE = /\/\s*(\d{1,2})[:.](\d{2})/;

export async function scrapeRomanfabrikLehrhaus(): Promise<ScrapedEvent[]> {
  const today = todayIso();
  const res = await fetch(CALENDAR_URL, { headers: { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" } });
  if (!res.ok) throw new Error(`romanfabrik fetch failed: ${res.status}`);
  const html = await res.text();

  const events: ScrapedEvent[] = [];
  const seen = new Set<string>();

  for (const m of html.matchAll(EVENT_LI_RE)) {
    const state = m[1].toLowerCase();
    if (state === "canceled") continue;

    const categories = m[2].trim().split(/\s+/).filter(Boolean);
    const hasText = categories.includes("Text");
    const hasThema = categories.includes("Thema");
    if (!hasText && !hasThema) continue;
    // Text+Ton crossovers are musical events with a literary framing — belongs in konzert.haus
    if (hasText && categories.includes("Ton")) continue;

    const titleMatch = TITLE_LINK_RE.exec(m[0]);
    if (!titleMatch) continue;

    const detailUrl = `${BASE}${decodeEntities(titleMatch[1])}`;
    if (seen.has(detailUrl)) continue;
    seen.add(detailUrl);

    const titleHtml = titleMatch[2];
    const strongMatch = /<strong>([\s\S]*?)<\/strong>/.exec(titleHtml);
    const title = stripHtml(decodeEntities(strongMatch?.[1] ?? titleHtml)).trim();
    if (!title || DROP_RE.test(title)) continue;

    const fullDate = FULL_DATE_RE.exec(m[0]);
    let date: string | null = null;
    if (fullDate) {
      const month = GERMAN_MONTHS[fullDate[3].toLowerCase()];
      if (month) date = `${fullDate[4]}-${String(month).padStart(2, "0")}-${fullDate[2].padStart(2, "0")}`;
    } else {
      const hd = HEADER_DATE_RE.exec(m[0]);
      if (hd) date = inferYear(hd[1], hd[2], today);
    }
    if (!date || date < today) continue;

    const tm = TIME_RE.exec(m[0]);
    const time = tm ? `${tm[1].padStart(2, "0")}:${tm[2]}` : null;

    events.push({
      title,
      date,
      time,
      detail_url: detailUrl,
      category: talkCategory(title),
      language: detectTalkLanguage(title),
    });
  }

  return events;
}

function inferYear(day: string, month: string, today: string): string | null {
  const year = parseInt(today.slice(0, 4), 10);
  const dd = day.padStart(2, "0");
  const mm = month.padStart(2, "0");
  const candidate = `${year}-${mm}-${dd}`;
  return candidate >= today ? candidate : `${year + 1}-${mm}-${dd}`;
}
