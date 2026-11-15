import { todayIso } from "@museumsufer/core";
import type { CanonicalScrapedEvent, ScraperContext, VenueScrapeResult } from "../types";
import { clean, EXHIBITION_LABEL, eventLabels, expectFound, fetchText, numericDates, VALENCIA } from "./_valencia";

/**
 * Museu de les Ciències Príncipe Felipe (Ciutat de les Arts i les Ciències). cac.es
 * fails TLS from direct fetches, so everything goes through `ctx.proxy`. The WordPress
 * list pages `/exposiciones/` and `/conferencias/` are server-rendered `<article>` cards
 * ending in "Temporal : dd/mm/yyyy – dd/mm/yyyy" (exhibitions) or a bare "dd/mm/yyyy"
 * (talks) plus "Recinto: …". The cards are newest-first, so the current ones sit on page
 * one. Only the museum and its Umbracle astronomy garden are kept; the Hemisfèric,
 * Oceanogràfic and Palau de les Arts have their own programmes.
 */
const BASE = "https://cac.es";
const SLUG = "museu-de-les-ciencies";
const GEO = { lat: 39.4548, lon: -0.3534 };
const ARTICLE_SPLIT = "<article ";

interface Card {
  url: string;
  title: string;
  dates: string[];
  image: string | null;
  place: string;
  temporary: boolean;
}

export async function scrapeMuseuDeLesCiencies(ctx: ScraperContext): Promise<VenueScrapeResult> {
  if (!ctx.proxy) throw new Error("museu-de-les-ciencies: cac.es needs FETCH_PROXY_URL (direct TLS is broken)");
  const today = todayIso();
  const [expoHtml, talksHtml] = await Promise.all([
    fetchText(`${BASE}/exposiciones/`, ctx.proxy),
    fetchText(`${BASE}/conferencias/`, ctx.proxy),
  ]);
  const expoCards = expectFound(parseCards(expoHtml), "cac.es/exposiciones");
  const talkCards = expectFound(parseCards(talksHtml), "cac.es/conferencias");
  const events: CanonicalScrapedEvent[] = [];

  for (const card of expoCards) {
    // Permanent and undated entries have no usable window.
    if (!card.temporary || card.dates.length < 2) continue;
    const [start, end] = [card.dates[0], card.dates[card.dates.length - 1]];
    if (end < today) continue;
    events.push({
      source_event_id: new URL(card.url).pathname,
      title: card.title,
      date: start,
      end_date: end,
      detail_url: card.url,
      image_url: card.image,
      venue_room: card.place,
      labels: [EXHIBITION_LABEL],
      ...GEO,
      ...VALENCIA,
    });
  }

  for (const card of talkCards) {
    const [date] = card.dates;
    if (!date || date < today) continue;
    const detail = await fetchText(card.url, ctx.proxy);
    const time = detail.match(/Hora:\s*(\d{1,2}):(\d{2})/)?.[0].match(/(\d{1,2}):(\d{2})/);
    // The cancellation notice replaces the abstract on the card ("se cancela la observación").
    if (/se cancela/i.test(card.title + clean(detail.match(/class="elementor-widget-container">\s*<p>([\s\S]*?)<\/p>/)?.[1] ?? ""))) continue;
    events.push({
      source_event_id: `${new URL(card.url).pathname}|${date}`,
      title: card.title,
      description: clean(detail.match(/property="og:description" content="([^"]*)"/)?.[1] ?? "") || null,
      date,
      time: time ? `${time[1].padStart(2, "0")}:${time[2]}` : null,
      detail_url: card.url,
      image_url: detail.match(/og:image" content="([^"]+)"/)?.[1] ?? card.image,
      venue_room: card.place,
      labels: /observaci[oó]n/i.test(card.title) ? eventLabels(card.title) : eventLabels(card.title, "conferencia"),
      ...GEO,
      ...VALENCIA,
    });
  }

  return { source_slug: SLUG, display_name: "Museu de les Ciències Príncipe Felipe", events };
}

function parseCards(html: string): Card[] {
  const out: Card[] = [];
  for (const article of html.split(ARTICLE_SPLIT).slice(1)) {
    const link = article.match(/<h2[^>]*><a href="(https:\/\/cac\.es\/(?:exposiciones|conferencias)\/[^"]+)">([\s\S]*?)<\/a><\/h2>/);
    if (!link) continue;
    const body = clean(article.slice(article.indexOf("<h2")));
    const [head] = body.split("Recinto:");
    const recinto = body.match(/Recinto:\s*(Museu de les Ci[eè]ncies|Umbracle|Hemisf[eè]ric|Oceanogr[aà]fic|Palau de les Arts|[ÁA]gora)/i)?.[1] ?? "";
    if (!/Museu de les Ci[eè]ncies|Umbracle/i.test(recinto)) continue;
    out.push({
      url: link[1],
      // A leading megaphone emoji marks promoted cards.
      title: clean(link[2]).replace(/^\p{Extended_Pictographic}\uFE0F?\s*/u, ""),
      dates: numericDates(head),
      image: article.match(/<img[^>]+src="(https:\/\/cac\.es\/wp-content\/uploads\/[^"]+)"/)?.[1] ?? null,
      place: /Umbracle/i.test(recinto) ? "Umbracle" : "Museu de les Ciències",
      temporary: /Temporal/.test(head),
    });
  }
  return out;
}
