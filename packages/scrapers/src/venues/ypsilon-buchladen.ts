import { todayIso } from "@museumsufer/core/date";
import { decodeEntities, stripHtml } from "@museumsufer/core/html";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";

/**
 * Ypsilon Buchladen — bookshop on the Berger Straße that hosts regular
 * Lesungen. Upcoming events live on the homepage (the /lesung/ archive
 * page only carries event recaps after the fact). Each event block is a
 * Squarespace-style "textwrapper" with the date+time as the first bold
 * span, followed by speaker, title, format ("Lesung"/"Verlagsabend"),
 * and description paragraphs.
 */
const BASE = "https://www.y-buchladen.de";
const LIST_URL = `${BASE}/`;
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

const TEXTWRAPPER_RE = /<div\s+class="textwrapper">([\s\S]*?)<\/div>/g;
const DATE_LINE_RE =
  /<p>\s*<strong>\s*<span[^>]*>\s*(?:[A-Za-zäöü]+,\s*)?(\d{1,2})\.\s*([A-Za-zäöü]+)\s*(\d{4}),\s*(\d{1,2})[.:](\d{2})\s*Uhr/i;

export async function scrapeYpsilonBuchladen(): Promise<VenueScrapeResult> {
  const res = await fetch(LIST_URL, { headers: { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" } });
  if (!res.ok) throw new Error(`ypsilon-buchladen fetch failed: ${res.status}`);
  const html = await res.text();

  const today = todayIso();
  const events: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();

  for (const m of html.matchAll(TEXTWRAPPER_RE)) {
    const block = m[1];
    const dateLine = block.match(DATE_LINE_RE);
    if (!dateLine) continue;

    const month = MONTHS_DE[dateLine[2].toLowerCase().normalize("NFC")];
    if (!month) continue;
    const date = `${dateLine[3]}-${String(month).padStart(2, "0")}-${dateLine[1].padStart(2, "0")}`;
    if (date < today) continue;

    const time = `${dateLine[4].padStart(2, "0")}:${dateLine[5]}`;

    const paragraphs = [...block.matchAll(/<p>\s*([\s\S]*?)\s*<\/p>/g)]
      .map((p) => stripHtml(decodeEntities(p[1])).replace(/\s+/g, " ").trim())
      .filter(Boolean);
    if (paragraphs.length < 2) continue;

    // Date line is paragraphs[0]; speaker is [1]; title is [2]; format is [3];
    // remaining paragraphs are the description.
    const speaker = paragraphs[1];
    const titleLine = paragraphs[2] ?? "";
    const formatLine = paragraphs[3] ?? "";
    const title = titleLine ? `${speaker}: ${titleLine}` : speaker;
    const description = paragraphs.slice(4).join(" ").slice(0, 600) || null;

    const sourceEventId = `${date}|${speaker}`;
    if (seen.has(sourceEventId)) continue;
    seen.add(sourceEventId);

    events.push({
      source_event_id: sourceEventId,
      title,
      description,
      date,
      time,
      end_date: null,
      end_time: null,
      detail_url: LIST_URL,
      ticket_url: null,
      image_url: null,
      raw_category: formatLine || null,
      performers: speaker,
      labels: [{ label: labelFor(formatLine), confidence: 0.85, classifier: "scraper-hardcoded" }],
    });
  }

  return { source_slug: "ypsilon-buchladen", display_name: "Ypsilon Buchladen", events };
}

function labelFor(format: string): string {
  const f = format.toLowerCase();
  if (/verlagsabend|gespräch|diskussion/.test(f)) return "talk:diskussion";
  if (/vortrag/.test(f)) return "talk:vortrag";
  return "talk:lesung";
}
