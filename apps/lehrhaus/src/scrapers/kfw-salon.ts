import { classifyEvent, detectTalkLanguage } from "@museumsufer/core/classify";
import { todayIso } from "@museumsufer/core/date";
import { stripHtml } from "@museumsufer/core/html";
import type { ScrapedEvent } from "../types";
import { talkCategory } from "./shared";

const BASE = "https://www.kfw-stiftung.de";
const EVENTS_URL = `${BASE}/en/events/`;

const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const HEADERS = { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9,en;q=0.8" };

/**
 * KfW Stiftung hosts the Philosophie-Salon at Villa 102 (Bockenheimer Landstraße 102)
 * as well as other public lecture/dialogue events. The events page renders
 * server-side HTML with event cards linking to detail pages.
 *
 * Card structure (observed):
 *   <a href="/en/events/[slug]">
 *     <img .../>
 *     <div>[Category]</div>
 *     <h3>[Title]</h3>
 *     <time>[Date range or single date]</time>
 *   </a>
 */

const CARD_RE = /<a\s+href="(\/(?:en|de)\/events?\/[^"#]+)"[^>]*>([\s\S]*?)<\/a>/g;
const DATE_RE = /(\d{2})\.(\d{2})\.(\d{4})/;
const TITLE_RE = /<h\d[^>]*>([\s\S]*?)<\/h\d>/i;

export async function scrapeKfwSalon(): Promise<ScrapedEvent[]> {
  const html = await fetchHtml(EVENTS_URL);
  return parseEventsHtml(html);
}

export function parseEventsHtml(html: string): ScrapedEvent[] {
  const today = todayIso();
  const events: ScrapedEvent[] = [];
  const seen = new Set<string>();

  for (const m of html.matchAll(CARD_RE)) {
    const href = m[1];
    if (seen.has(href)) continue;
    seen.add(href);

    const inner = m[2];
    const title = stripHtml(inner.match(TITLE_RE)?.[1] ?? "").trim();
    if (!title) continue;

    if (classifyEvent(title) !== "Vortrag") continue;

    const dateMatch = inner.match(DATE_RE);
    if (!dateMatch) continue;

    const date = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`;
    if (date < today) continue;

    const timeMatch = inner.match(/(\d{1,2}):(\d{2})\s*(?:Uhr|h\b)/i);
    const time = timeMatch ? `${timeMatch[1].padStart(2, "0")}:${timeMatch[2]}` : null;

    events.push({
      title,
      date,
      time,
      detail_url: `${BASE}${href}`,
      category: talkCategory(title),
      language: detectTalkLanguage(title),
    });
  }

  return events;
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`kfw-stiftung fetch failed: ${res.status} ${url}`);
  return res.text();
}
