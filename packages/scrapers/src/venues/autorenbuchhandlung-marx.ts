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

const ARTICLE_HEAD_RE = /^<article\s+id="post-(\d+)"[^>]*class="([^"]*)"/;
const TITLE_RE = /class="czr-title"\s+href="([^"]+)"[^>]*>\s*([\s\S]*?)\s*<\/a>/;
const H1_RE = /<h1[^>]*>([\s\S]*?)<\/h1>/;
// When the post's WordPress title is just a date ("Donnerstag, 20. November,
// 20 Uhr"), the real title is the leading <h2> of the body, and the flyer is
// the first inline image.
const CONTENT_H2_RE = /czr-wp-the-content"[^>]*>\s*<h2[^>]*>([\s\S]*?)<\/h2>/;
const CONTENT_IMG_RE =
  /czr-wp-the-content"[\s\S]*?<figure[^>]*wp-block-image[^>]*>\s*<a[^>]+href="([^"]+\.(?:jpe?g|png))"/i;
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

  // Split into per-article blocks (cut at the closing tag) so the optional
  // inner <h1> can't greedily span across articles — most listing cards have
  // no <h1>, and a single combined regex would collapse them into one match.
  for (const block of html.split(/(?=<article\s+id="post-)/)) {
    const head = block.match(ARTICLE_HEAD_RE);
    if (!head?.[2].includes("category-veranstaltungen")) continue;
    const article = block.split("</article>")[0];

    const titleMatch = article.match(TITLE_RE);
    if (!titleMatch) continue;

    const id = head[1];
    const detailUrl = titleMatch[1];
    const entryTitle = stripHtml(decodeEntities(titleMatch[2])).trim();
    const h1Match = article.match(H1_RE);
    const innerH1 = h1Match ? stripHtml(decodeEntities(h1Match[1])).trim() : "";
    const contentH2 = article.match(CONTENT_H2_RE);
    const bodyTitle = contentH2 ? stripHtml(decodeEntities(contentH2[1])).trim() : "";

    // Skip cancellation announcements and press releases. They're tagged
    // with the same category-veranstaltungen but aren't bookable events.
    if (/^\++/.test(entryTitle) || /abgesagt|pressemitteilung/i.test(entryTitle)) continue;

    const date = parseDate(entryTitle, currentYear, today);
    if (!date || date < today) continue;
    if (seen.has(id)) continue;
    seen.add(id);

    const timeMatch = entryTitle.match(TIME_RE);
    const time = timeMatch ? `${timeMatch[1].padStart(2, "0")}:${timeMatch[2] ?? "00"}` : null;

    // The body <h2> carries the real title when the post is titled by date;
    // otherwise fall back to the inner <h1>, then the cleaned entry title
    // (strip the "Einladung" prefix, the date tail, and any "| Weekday" tail).
    const title =
      bodyTitle ||
      innerH1 ||
      entryTitle
        .replace(/^Einladung[,:]?\s*/i, "")
        .replace(/,?\s*\d{1,2}.*$/, "")
        .replace(/\s*\|.*$/, "")
        .trim();

    const imageMatch = article.match(CONTENT_IMG_RE);
    const imageUrl = imageMatch ? imageMatch[1] : null;

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
      image_url: imageUrl,
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
