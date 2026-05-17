import { classifyTalk } from "@museumsufer/classify";
import { todayIso } from "@museumsufer/core/date";
import { decodeEntities, stripHtml } from "@museumsufer/core/html";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";

/**
 * Autorenbuchhandlung Andreas Marx — Sachsenhausen bookshop on the
 * Museumsufer, runs frequent "Einladung" Lesungen and Gesprächsabende.
 * WordPress site, /www/category/veranstaltungen/ lists each event as
 * an <article class="... category-veranstaltungen ...">. Entry titles
 * follow patterns like "Einladung, 7. Mai, 20 Uhr" — sometimes with a
 * year, sometimes not.
 */
const BASE = "https://autorenbuchhandlung-marx.de";
const LIST_URL = `${BASE}/www/category/veranstaltungen/`;
const UA = "museumsufer event-hub crawler / contact: jonas@bgdlabs.com";

const ARTICLE_RE =
  /<article\s+id="post-(\d+)"[^>]*class="([^"]*category-veranstaltungen[^"]*)"[\s\S]*?class="czr-title"\s+href="([^"]+)"[^>]*>\s*([\s\S]*?)\s*<\/a>[\s\S]*?<h1[^>]*>([\s\S]*?)<\/h1>/g;
const DATE_FULL_RE = /(\d{1,2})\.(\d{1,2})\.(\d{4})/;
const DATE_MONTH_YEAR_RE =
  /(\d{1,2})\.\s*(januar|februar|m[aä]rz|april|mai|juni|juli|august|september|oktober|november|dezember)\s+(\d{4})/i;
const DATE_MONTH_RE =
  /(\d{1,2})\.\s*(januar|februar|m[aä]rz|april|mai|juni|juli|august|september|oktober|november|dezember)\b/i;
const TIME_RE = /(\d{1,2})(?:[.:](\d{2}))?\s*Uhr/i;

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

export async function scrapeAutorenbuchhandlungMarx(): Promise<VenueScrapeResult> {
  const res = await fetch(LIST_URL, { headers: { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" } });
  if (!res.ok) throw new Error(`autorenbuchhandlung-marx fetch failed: ${res.status}`);
  const html = await res.text();

  const today = todayIso();
  const currentYear = parseInt(today.slice(0, 4), 10);
  const events: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();

  for (const m of html.matchAll(ARTICLE_RE)) {
    const id = m[1];
    const detailUrl = m[3];
    const entryTitle = stripHtml(decodeEntities(m[4])).trim();
    const innerH1 = stripHtml(decodeEntities(m[5])).trim();

    // Skip cancellation announcements and press releases. They're tagged
    // with the same category-veranstaltungen but aren't bookable events.
    if (/^\++/.test(entryTitle) || /abgesagt|pressemitteilung/i.test(entryTitle)) continue;

    const date = parseDate(entryTitle, currentYear, today);
    if (!date || date < today) continue;
    if (seen.has(id)) continue;
    seen.add(id);

    const timeMatch = entryTitle.match(TIME_RE);
    const time = timeMatch ? `${timeMatch[1].padStart(2, "0")}:${timeMatch[2] ?? "00"}` : null;

    // Inner <h1> is usually the real title (Author/Title); fall back to the
    // entry title when it's empty (some posts use only the outer title).
    const title = innerH1 || entryTitle.replace(/^Einladung[,:]?\s*/i, "").replace(/,?\s*\d{1,2}.*$/, "");

    events.push({
      source_event_id: id,
      title,
      description: null,
      date,
      time,
      end_date: null,
      end_time: null,
      detail_url: detailUrl,
      ticket_url: null,
      image_url: null,
      raw_category: null,
      labels: [
        { label: `talk:${classifyTalk(title, null).toLowerCase()}`, confidence: 0.85, classifier: "keyword:talk" },
      ],
    });
  }

  return { source_slug: "autorenbuchhandlung-marx", display_name: "Autorenbuchhandlung Marx", events };
}

function parseDate(text: string, currentYear: number, today: string): string | null {
  // 1. Fully specified DD.MM.YYYY
  const full = text.match(DATE_FULL_RE);
  if (full) return `${full[3]}-${full[2].padStart(2, "0")}-${full[1].padStart(2, "0")}`;

  // 2. D. Month YYYY
  const withYear = text.match(DATE_MONTH_YEAR_RE);
  if (withYear) {
    const month = MONTHS_DE[withYear[2].toLowerCase().normalize("NFC")];
    if (!month) return null;
    return `${withYear[3]}-${String(month).padStart(2, "0")}-${withYear[1].padStart(2, "0")}`;
  }

  // 3. D. Month (no year) — current year, or next year if more than 60 days
  // in the past (the bookshop's autumn programme arrives in summer).
  const partial = text.match(DATE_MONTH_RE);
  if (partial) {
    const month = MONTHS_DE[partial[2].toLowerCase().normalize("NFC")];
    if (!month) return null;
    const day = partial[1].padStart(2, "0");
    const candidate = `${currentYear}-${String(month).padStart(2, "0")}-${day}`;
    const cutoff = new Date(today);
    cutoff.setDate(cutoff.getDate() - 60);
    const cutoffIso = cutoff.toISOString().slice(0, 10);
    if (candidate < cutoffIso) return `${currentYear + 1}-${String(month).padStart(2, "0")}-${day}`;
    return candidate;
  }
  return null;
}
