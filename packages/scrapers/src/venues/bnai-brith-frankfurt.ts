import { todayIso } from "@museumsufer/core/date";
import { decodeEntities, normalizeUrl, stripHtml } from "@museumsufer/core/html";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";

/**
 * B'nai B'rith Frankfurt Schönstädt Loge — Joomla site, the terminkalender
 * page lists each event as one el-content block with two h4 headers (date
 * line + title), a short intro paragraph, and an image with a YYYYMMDD
 * filename prefix that doubles as a stable source_event_id.
 *
 * Events are lectures + cultural evenings in the loge — all map to
 * `talk:vortrag` since the loge's programme is exclusively talk-shaped.
 */
const BASE = "https://www.bnaibrith-ffm.de";
const LIST_URL = `${BASE}/de/aktivitaeten/aktueller-terminkalender`;
const UA = "museumsufer event-hub crawler / contact: jonas@bgdlabs.com";

const ITEM_RE =
  /<div class="el-content uk-panel uk-margin-top">([\s\S]*?)<\/div>\s*(?=<div class="el-content uk-panel uk-margin-top">|<\/div>\s*<\/div>\s*<div data-tag=|<\/div>\s*<div class="uk-grid)/g;
const H4_RE = /<h4>([\s\S]*?)<\/h4>/g;
const IMG_RE = /<img[^>]+src="(\/images\/Bilder_Terminkalender\/(\d{8})_[^"]+)"/i;
const IMG_ALL_RE = /<img[^>]+src="(\/images\/Bilder_Terminkalender\/\d{8}_[^"]+)"/gi;

const ANMELDEN_LINK_RE = /<a[^>]+href="(https?:\/\/forms\.gle\/[^"]+)"/i;

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

export async function scrapeBnaiBrithFrankfurt(): Promise<VenueScrapeResult> {
  const res = await fetch(LIST_URL, {
    headers: { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" },
  });
  if (!res.ok) throw new Error(`bnai-brith-frankfurt fetch failed: ${res.status}`);
  const html = await res.text();

  const today = todayIso();
  const events: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();

  for (const m of html.matchAll(ITEM_RE)) {
    const block = m[1];
    const headings = [...block.matchAll(H4_RE)].map((h) => stripHtml(decodeEntities(h[1])).trim());
    const parsed = headings[0] ? parseDateLine(headings[0]) : null;
    if (!parsed) continue;

    // Two layouts: date + title as two h4s (older entries), or one date h4
    // followed by the title as the first bold paragraph (current entries).
    const afterH4 = block.slice(block.search(/<\/h4>/i) + 5);
    const boldTitle = afterH4.match(/<p[^>]*>\s*<strong>([\s\S]*?)<\/strong>\s*<\/p>/i);
    const title = headings[1] || (boldTitle ? stripHtml(decodeEntities(boldTitle[1])).replace(/\s+/g, " ").trim() : "");
    // A dated block without a title means the markup drifted; returning [] would hide it.
    if (!title) throw new Error(`bnai-brith-frankfurt: dated block "${headings[0]}" has no recognisable title`);
    if (parsed.date < today) continue;

    // Sponsor logos share the YYYYMMDD prefix; prefer the first non-logo image
    // for display, but keep the first match's date prefix as the stable id.
    const imgMatch = block.match(IMG_RE);
    const imgs = [...block.matchAll(IMG_ALL_RE)];
    const display = imgs.find((i) => !/logo/i.test(i[1])) ?? imgs[0];
    const imageUrl = display ? normalizeUrl(display[1], BASE) : null;
    const sourceEventId = imgMatch ? imgMatch[2] : `${parsed.date}|${title}`;

    if (seen.has(sourceEventId)) continue;
    seen.add(sourceEventId);

    // Skip the salutation ("Liebe Schwestern und Brüder…") and the title paragraph.
    const paragraphs = [...afterH4.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
      .map((p) => stripHtml(decodeEntities(p[1])).replace(/\s+/g, " ").trim())
      .filter((p) => p && p !== title && !/^Liebe\b/.test(p));
    const description = paragraphs[0] ?? null;

    const ticketUrl = block.match(ANMELDEN_LINK_RE)?.[1] ?? null;

    events.push({
      source_event_id: sourceEventId,
      title,
      description,
      date: parsed.date,
      time: parsed.time,
      end_date: null,
      end_time: null,
      detail_url: LIST_URL,
      ticket_url: ticketUrl,
      image_url: imageUrl,
      raw_category: "Vortrag",
      labels: [{ label: "talk:vortrag", confidence: 0.9, classifier: "scraper-hardcoded" }],
    });
  }

  return { source_slug: "bnai-brith-frankfurt", display_name: "B'nai B'rith Frankfurt Schönstädt Loge", events };
}

function parseDateLine(line: string): { date: string; time: string | null } | null {
  // "Dienstag, 09. Juni 2026 19.00 Uhr" (linebreak collapsed by stripHtml).
  const m = line.match(
    /(\d{1,2})\.\s*(januar|februar|m[aä]rz|april|mai|juni|juli|august|september|oktober|november|dezember)\s+(\d{4})(?:[^\d]+(\d{1,2})[.:](\d{2}))?/i,
  );
  if (!m) return null;
  const month = MONTHS_DE[m[2].toLowerCase().normalize("NFC")];
  if (!month) return null;
  const date = `${m[3]}-${String(month).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  const time = m[4] && m[5] ? `${m[4].padStart(2, "0")}:${m[5]}` : null;
  return { date, time };
}
