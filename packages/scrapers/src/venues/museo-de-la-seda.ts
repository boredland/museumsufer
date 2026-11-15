import { todayIso } from "@museumsufer/core";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";
import { absolute, clean, EXHIBITION_LABEL, expectFound, fetchText, parseDateSpan, VALENCIA } from "./_valencia";

/**
 * Museo y Colegio del Arte Mayor de la Seda. `/exposiciones-temporales/` is a
 * news-style list; each entry is a press article whose prose says "se podrá
 * visitar hasta el 17 de enero de 2027". The opening date is the article's
 * publication date ("han inaugurado esta mañana"). The site's REST API is
 * blocked, and `/eventos/` only describes the venue's hire spaces.
 */
const BASE = "https://www.museodelasedavalencia.com";

export async function scrapeMuseoDeLaSeda(): Promise<VenueScrapeResult> {
  const today = todayIso();
  const list = await fetchText(`${BASE}/exposiciones-temporales/`);
  const events: CanonicalScrapedEvent[] = [];
  for (const entry of expectFound(list.split('<h3><a href="').slice(1), "museodelasedavalencia.com/exposiciones-temporales")) {
    const url = entry.slice(0, entry.indexOf('"'));
    const html = await fetchText(url);
    const text = clean(html.slice(html.indexOf("</h1>", html.indexOf("news_single_title")) + 5));
    const until = text.match(/hasta el (\d{1,2} de [a-zé]+ de \d{4})/i)?.[1];
    const end = until ? parseDateSpan(until, today)?.start : null;
    const opened = html.match(/article:published_time" content="(\d{4}-\d{2}-\d{2})/)?.[1];
    if (!end || !opened || end < today) continue;
    const quoted = text.match(/[`´'‘]([^`´'’]{8,120})[´'’]/)?.[1];
    events.push({
      source_event_id: new URL(url).pathname,
      title: quoted?.trim() ?? clean(html.match(/news_single_title">([\s\S]*?)<\/h1>/)?.[1] ?? ""),
      description: text.slice(0, 2000),
      date: opened,
      end_date: end,
      detail_url: absolute(BASE, url),
      image_url: html.match(/og:image" content="([^"]+)"/)?.[1] ?? null,
      labels: [EXHIBITION_LABEL],
      lat: 39.4707,
      lon: -0.3811,
      ...VALENCIA,
    });
  }
  return { source_slug: "museo-de-la-seda", display_name: "Museo de la Seda de Valencia", events };
}
