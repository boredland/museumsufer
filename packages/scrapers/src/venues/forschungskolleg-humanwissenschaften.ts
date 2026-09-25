import { classifyTalk } from "@museumsufer/classify";
import { todayIso } from "@museumsufer/core/date";
import { stripHtml } from "@museumsufer/core/html";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";

/**
 * Forschungskolleg Humanwissenschaften, Bad Homburg (Goethe-Universität +
 * Werner Reimers Stiftung). The 2026 relaunch lists upcoming events as cards
 * on /events: `<a href="/events/<slug>">` around a `startdate` field, the
 * series in `category`, an `<h2>` title and a speaker `teaser`. The card has
 * the day only; the start time (or, for workshops, the end date) is in the
 * event page's `field startdate`, so each page is fetched.
 */
const BASE = "https://www.forschungskolleg-humanwissenschaften.de";
const LISTING_URL = `${BASE}/events`;
const UA = "museumsufer event-hub crawler / contact: jonas@bgdlabs.com";
const HEADERS = { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" };

const CARD_RE = /<a href="(\/events\/[^"]+)">\s*<div class="card[\s\S]*?<\/a>/g;
/** First day of the card's "17.11.2026" or "15.10.2026 &mdash; 17.10.2026". */
const CARD_DATE_RE = /class="field startdate">\s*<p[^>]*>\s*(\d{2})\.(\d{2})\.(\d{4})/;
const CATEGORY_RE = /class="field category">\s*<p>([\s\S]*?)<\/p>/;
const TITLE_RE = /class="field title">\s*<h2>([\s\S]*?)<\/h2>/;
const TEASER_RE = /class="field teaser">([\s\S]*?)<\/div>/;
/** The detail page's "Termin" value: "Dienstag<br>17.11.2026<br>18:30 Uhr" or
 *  "Donnerstag, 15.10.2026 —<br>Samstag, 17.10.2026". */
const TERMIN_RE = /class="field startdate">[\s\S]*?<div class="value">([\s\S]*?)<\/div>/;

export async function scrapeForschungskollegHumanwissenschaften(): Promise<VenueScrapeResult> {
  const html = await fetchHtml(LISTING_URL);
  const today = todayIso();
  const events: CanonicalScrapedEvent[] = [];

  for (const [card, path] of html.matchAll(CARD_RE)) {
    const day = card.match(CARD_DATE_RE);
    const title = stripQuotes(cleanText(card.match(TITLE_RE)?.[1] ?? ""));
    if (!day || !title || /^FÄLLT AUS!?/i.test(title)) continue;
    const date = `${day[3]}-${day[2]}-${day[1]}`;
    if (date < today) continue;

    const detailUrl = `${BASE}${path}`;
    const termin = cleanText((await fetchHtml(detailUrl)).match(TERMIN_RE)?.[1]?.replace(/<br\s*\/?>/gi, " ") ?? "");
    const time = termin.match(/(\d{1,2}):(\d{2})\s*Uhr/);
    const endDay = [...termin.matchAll(/(\d{2})\.(\d{2})\.(\d{4})/g)].at(1);
    const series = cleanText(card.match(CATEGORY_RE)?.[1]?.replace(/<br\s*\/?>/gi, " · ") ?? "").replace(
      /\s*·\s*$/,
      "",
    );
    const speaker = cleanText(card.match(TEASER_RE)?.[1] ?? "");
    const description = [speaker, series].filter(Boolean).join(" — ") || null;

    events.push({
      source_event_id: `fkh-${path.slice("/events/".length)}`,
      title,
      subtitle: series || null,
      date,
      end_date: endDay ? `${endDay[3]}-${endDay[2]}-${endDay[1]}` : null,
      time: time ? `${time[1].padStart(2, "0")}:${time[2]}` : null,
      detail_url: detailUrl,
      description,
      performers: speaker || null,
      language: detectEnglish(title) ? "en" : null,
      labels: [
        {
          label: `talk:${classifyTalk(title, description).toLowerCase()}`,
          confidence: 0.85,
          classifier: "keyword:talk",
        },
      ],
    });
  }

  return {
    source_slug: "forschungskolleg-humanwissenschaften",
    display_name: "Forschungskolleg Humanwissenschaften (Bad Homburg)",
    events,
  };
}

function detectEnglish(title: string): boolean {
  const t = title.toLowerCase();
  if (/[äöüß]/.test(t)) return false;
  if (/\b(der|die|das|den|dem|eine?|und|oder|nicht|von|zu|im|am|ist|wie|als|für|bei|mit|aus|über|durch)\b/.test(t)) {
    return false;
  }
  return /\b(the|of|and|on|to|in|is|with|how|why)\b.+\b(the|of|and|on|to|in|is|with)\b/.test(t);
}

function stripQuotes(s: string): string {
  return s.replace(/^[»„"„“‚'](.*)[«"”“’']$/, "$1").trim();
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`forschungskolleg-humanwissenschaften fetch failed: ${res.status}`);
  return res.text();
}

function cleanText(s: string): string {
  return stripHtml(s).replace(/\s+/g, " ").trim();
}
