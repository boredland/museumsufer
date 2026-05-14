import { detectTalkLanguage } from "@museumsufer/core/classify";
import { todayIso } from "@museumsufer/core/date";
import { decodeEntities, stripHtml } from "@museumsufer/core/html";
import type { ScrapedEvent } from "../types";
import { talkCategory } from "./shared";

const BASE = "https://www.evangelische-akademie.de";
const LISTING_URL = `${BASE}/kalender/`;
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

// Tags to skip (REDAXO CMS tag IDs): 22=Musik, 25=Film, 27=Ausstellungen
const SKIP_TAGS = new Set([22, 25, 27]);

const EN_MONTHS: Record<string, string> = {
  January: "01",
  February: "02",
  March: "03",
  April: "04",
  May: "05",
  June: "06",
  July: "07",
  August: "08",
  September: "09",
  October: "10",
  November: "11",
  December: "12",
};

// Matches each event card: <div class="box grid-cell..." data-tags="N,N,..."><a href="/kalender/slug/id/">…</a></div>
const CARD_RE =
  /<div class="box grid-cell[^"]*"\s+data-tags="([^"]+)">\s*<a href="(\/kalender\/[^"]+)">([\s\S]*?)<\/a>\s*<\/div>/g;
const DAY_RE = /<div class="date-daydate">(\d+)<\/div>/;
const MONTH_RE = /<div class="date-month">([A-Za-z]+)<\/div>/;
const TITLE_RE = /<strong>([\s\S]*?)<\/strong>/;

export async function scrapeEvangelischeAkademie(): Promise<ScrapedEvent[]> {
  const today = todayIso();
  const res = await fetch(LISTING_URL, { headers: { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" } });
  if (!res.ok) throw new Error(`evangelische-akademie fetch failed: ${res.status}`);
  const html = await res.text();

  const events: ScrapedEvent[] = [];
  const seen = new Set<string>();

  for (const m of html.matchAll(CARD_RE)) {
    const tags = m[1].split(",").map((t) => parseInt(t.trim(), 10));
    if (tags.some((t) => SKIP_TAGS.has(t))) continue;

    const url = `${BASE}${m[2]}`;
    if (seen.has(url)) continue;
    seen.add(url);

    const cardHtml = m[3];
    const dayMatch = DAY_RE.exec(cardHtml);
    const monthMatch = MONTH_RE.exec(cardHtml);
    if (!dayMatch || !monthMatch) continue;

    const mm = EN_MONTHS[monthMatch[1]];
    if (!mm) continue;
    const dd = dayMatch[1].padStart(2, "0");
    const date = inferYear(dd, mm, today);
    if (!date || date < today) continue;

    const titleMatch = TITLE_RE.exec(cardHtml);
    const title = titleMatch ? stripHtml(decodeEntities(titleMatch[1])).trim() : "";
    if (!title) continue;

    events.push({
      title,
      date,
      detail_url: url,
      category: talkCategory(title),
      language: detectTalkLanguage(title),
    });
  }

  return events;
}

function inferYear(dd: string, mm: string, today: string): string {
  const year = parseInt(today.slice(0, 4), 10);
  const candidate = `${year}-${mm}-${dd}`;
  return candidate >= today ? candidate : `${year + 1}-${mm}-${dd}`;
}
