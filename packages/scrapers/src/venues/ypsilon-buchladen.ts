import { todayIso } from "@museumsufer/core/date";
import { decodeEntities, stripHtml } from "@museumsufer/core/html";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";

/**
 * Ypsilon Buchladen — bookshop on the Berger Straße that hosts regular
 * Lesungen. Since the 2026/2 programme the IONOS site gives every event its
 * own page under /veranstaltungen/ ("19-oktober-sommer-der-schlafenden-
 * hunde/"), linked from that page's navigation; archive pages sit next to
 * them. Each event page has one `textwrapper` whose non-empty paragraphs are
 * date line, speaker, title, format, then the description.
 */
const BASE = "https://www.y-buchladen.de";
const LIST_URL = `${BASE}/veranstaltungen/`;
const UA = "museumsufer event-hub crawler / contact: jonas@bgdlabs.com";

const MONTHS_DE: Record<string, number> = {
  januar: 1,
  februar: 2,
  märz: 3,
  maerz: 3,
  april: 4,
  mai: 5,
  juni: 6,
  juli: 7,
  august: 8,
  september: 9,
  oktober: 10,
  november: 11,
  dezember: 12,
};

/** Event pages are slugged "<day>-<month>-<title>"; archive pages are not. */
const EVENT_LINK_RE = /href="(https:\/\/www\.y-buchladen\.de\/veranstaltungen\/\d{1,2}-[^"/]+\/)"/g;
const TEXTWRAPPER_RE = /<div class="textwrapper">([\s\S]*?)<\/div>/;
const PARAGRAPH_RE = /<p[^>]*>([\s\S]*?)<\/p>/g;
/** "Montag, 19. Oktober 2026, 20.00 Uhr" — weekday optional. */
const DATE_LINE_RE = /(\d{1,2})\.\s*([A-Za-zäöü]+)\s*(\d{4}),?\s*(\d{1,2})[.:](\d{2})\s*Uhr/i;
const IMAGE_RE = /<a class="imagewrapper" href="(https:\/\/www\.y-buchladen\.de\/s\/cc_images\/[^"]+)"/;

export async function scrapeYpsilonBuchladen(): Promise<VenueScrapeResult> {
  const links = [...new Set([...(await fetchText(LIST_URL)).matchAll(EVENT_LINK_RE)].map((m) => decodeEntities(m[1])))];
  const today = todayIso();
  const events: CanonicalScrapedEvent[] = [];
  for (const url of links) {
    const event = parseEventPage(await fetchText(encodeURI(url)), url, today);
    if (event) events.push(event);
  }
  return { source_slug: "ypsilon-buchladen", display_name: "Ypsilon Buchladen", events };
}

function parseEventPage(html: string, url: string, today: string): CanonicalScrapedEvent | null {
  const block = html.match(TEXTWRAPPER_RE)?.[1];
  if (!block) return null;
  const paragraphs = [...block.matchAll(PARAGRAPH_RE)]
    .map((p) => stripHtml(decodeEntities(p[1])).replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const dateLine = paragraphs[0]?.match(DATE_LINE_RE);
  if (!dateLine || paragraphs.length < 2) return null;

  const month = MONTHS_DE[dateLine[2].toLowerCase().normalize("NFC")];
  if (!month) return null;
  const date = `${dateLine[3]}-${String(month).padStart(2, "0")}-${dateLine[1].padStart(2, "0")}`;
  if (date < today) return null;

  const [, speaker, titleLine = "", formatLine = ""] = paragraphs;
  return {
    source_event_id: `${date}|${speaker}`,
    title: titleLine ? `${speaker}: ${titleLine}` : speaker,
    description: paragraphs.slice(4).join(" ").slice(0, 600) || null,
    date,
    time: `${dateLine[4].padStart(2, "0")}:${dateLine[5]}`,
    detail_url: url,
    image_url: html.match(IMAGE_RE)?.[1] ?? null,
    raw_category: formatLine || null,
    performers: speaker,
    labels: [{ label: labelFor(formatLine), confidence: 0.85, classifier: "scraper-hardcoded" }],
  };
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" } });
  if (!res.ok) throw new Error(`ypsilon-buchladen fetch failed: ${res.status} ${url}`);
  return res.text();
}

function labelFor(format: string): string {
  const f = format.toLowerCase();
  if (/verlagsabend|gespräch|diskussion/.test(f)) return "talk:diskussion";
  if (/vortrag/.test(f)) return "talk:vortrag";
  return "talk:lesung";
}
