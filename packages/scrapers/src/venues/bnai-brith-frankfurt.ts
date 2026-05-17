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
const FIRST_BODY_P_RE = /<\/h4>\s*<p[^>]*>([\s\S]*?)<\/p>/i;
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
    if (headings.length < 2) continue;

    const parsed = parseDateLine(headings[0]);
    if (!parsed) continue;
    if (parsed.date < today) continue;

    const title = headings[1];
    if (!title) continue;

    const imgMatch = block.match(IMG_RE);
    const imageUrl = imgMatch ? normalizeUrl(imgMatch[1], BASE) : null;
    const sourceEventId = imgMatch ? imgMatch[2] : `${parsed.date}|${title}`;
    if (seen.has(sourceEventId)) continue;
    seen.add(sourceEventId);

    const intro = block.match(FIRST_BODY_P_RE)?.[1];
    const description = intro ? stripHtml(decodeEntities(intro)).trim() || null : null;
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
