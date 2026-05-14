import { decodeEntities, slugify, stripHtml, todayIso } from "@museumsufer/core";
import { classify } from "../genre-heuristics";
import type { ScrapedEvent, ScrapeResult } from "../types";

const BASE = "https://www.evangelische-akademie.de";
const LISTING_URL = `${BASE}/kalender/`;
const UA = "konzert.haus crawler / contact: jonas@bgdlabs.com";
const THROTTLE_MS = 200;

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

// Event cards with tag 22 (Musik) in data-tags attribute
const CARD_RE =
  /<div class="box grid-cell[^"]*"\s+data-tags="([^"]+)">\s*<a href="(\/kalender\/[^"]+)">([\s\S]*?)<\/a>\s*<\/div>/g;
const DAY_RE = /<div class="date-daydate">(\d+)<\/div>/;
const MONTH_RE = /<div class="date-month">([A-Za-z]+)<\/div>/;
const TITLE_RE = /<strong>([\s\S]*?)<\/strong>/;

// Detail page fields
const YEAR_RE = /<div class="date-year">(\d{4})<\/div>/;
// "HH.MM – HH.MM Uhr" or "HH.MM Uhr" inside title-additional
const TIME_RANGE_RE = /(\d{1,2})\.(\d{2})\s*(?:&ndash;|–|-)\s*(\d{1,2})\.(\d{2})\s*Uhr/i;
const TIME_SINGLE_RE = /(\d{1,2})\.(\d{2})\s*Uhr/i;
const PRICE_RE = /(\d+(?:[.,]\d{1,2})?)\s*Euro/gi;
const TITLE_ADDITIONAL_RE = /<div class="title-additional">([\s\S]*?)<\/div>/;

export async function scrapeEvangelischeAkademie(): Promise<ScrapeResult> {
  const today = todayIso();
  const html = await fetchText(LISTING_URL);
  const events: ScrapedEvent[] = [];
  const seen = new Set<string>();

  for (const m of html.matchAll(CARD_RE)) {
    const tags = m[1].split(",").map((t) => parseInt(t.trim(), 10));
    if (!tags.includes(22)) continue;

    const detailPath = m[2];
    const detailUrl = `${BASE}${detailPath}`;
    if (seen.has(detailUrl)) continue;
    seen.add(detailUrl);

    const cardHtml = m[3];
    const dayMatch = DAY_RE.exec(cardHtml);
    const monthMatch = MONTH_RE.exec(cardHtml);
    if (!dayMatch || !monthMatch) continue;

    const mm = EN_MONTHS[monthMatch[1]];
    if (!mm) continue;
    const dd = dayMatch[1].padStart(2, "0");

    const titleMatch = TITLE_RE.exec(cardHtml);
    const title = titleMatch ? stripHtml(decodeEntities(titleMatch[1])).trim() : "";
    if (!title) continue;

    // Subtitle: text after </strong><br> inside box-bottom
    const subtitleMatch = /<strong>[\s\S]*?<\/strong><br>([\s\S]*?)\s*$/.exec(
      cardHtml.replace(/[\s\S]*<div class="box-bottom[^"]*">([\s\S]*)<\/a>$/, "$1"),
    );
    const subtitle = subtitleMatch ? stripHtml(decodeEntities(subtitleMatch[1])).trim() || null : null;

    await sleep(THROTTLE_MS);
    const detail = await fetchDetail(detailUrl);
    if (!detail.year) continue;

    const date = `${detail.year}-${mm}-${dd}`;
    if (date < today) continue;

    const slug = slugFromPath(detailPath) ?? slugify(`eaf-${date}-${title}`);

    events.push({
      slug,
      title,
      subtitle,
      description: null,
      date,
      time: detail.time,
      end_time: detail.endTime,
      genre: classify(title, subtitle, null, "chamber"),
      image_url: null,
      detail_url: detailUrl,
      ticket_url: detailUrl,
      price_min: detail.priceMin,
      price_max: detail.priceMax,
      venue_room: null,
      performers: subtitle,
    });
  }

  return { venue_slug: "evangelische-akademie", events };
}

interface DetailFields {
  year: string | null;
  time: string | null;
  endTime: string | null;
  priceMin: number | null;
  priceMax: number | null;
}

async function fetchDetail(url: string): Promise<DetailFields> {
  let html: string;
  try {
    html = await fetchText(url);
  } catch {
    return { year: null, time: null, endTime: null, priceMin: null, priceMax: null };
  }

  const year = YEAR_RE.exec(html)?.[1] ?? null;

  const additionalRaw = TITLE_ADDITIONAL_RE.exec(html)?.[1] ?? "";
  const additional = decodeEntities(additionalRaw);

  const rangeMatch = TIME_RANGE_RE.exec(additional);
  let time: string | null = null;
  let endTime: string | null = null;
  if (rangeMatch) {
    time = `${rangeMatch[1].padStart(2, "0")}:${rangeMatch[2]}`;
    endTime = `${rangeMatch[3].padStart(2, "0")}:${rangeMatch[4]}`;
  } else {
    const singleMatch = TIME_SINGLE_RE.exec(additional);
    if (singleMatch) time = `${singleMatch[1].padStart(2, "0")}:${singleMatch[2]}`;
  }

  const prices: number[] = [];
  for (const pm of html.matchAll(PRICE_RE)) {
    const value = parseFloat(pm[1].replace(",", "."));
    if (Number.isFinite(value) && value > 0 && value < 500) prices.push(value);
  }

  return {
    year,
    time,
    endTime,
    priceMin: prices.length ? Math.min(...prices) : null,
    priceMax: prices.length > 1 ? Math.max(...prices) : null,
  };
}

function slugFromPath(path: string): string | null {
  const m = /\/kalender\/[^/]+\/(\d+)\//.exec(path);
  return m ? `eaf-${m[1]}` : null;
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" } });
  if (!res.ok) throw new Error(`evangelische-akademie fetch failed: ${url} → ${res.status}`);
  return res.text();
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
