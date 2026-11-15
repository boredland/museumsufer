import { todayIso } from "@museumsufer/core";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";
import { clean, EXHIBITION_LABEL, fetchText, parseDateSpan, VALENCIA } from "./_valencia";

/**
 * Centre del Carme Cultura Contemporània (CCCC), run by the Consorci de Museus.
 * The consortium's exhibition archive is a JS-loaded grid, but the home page's
 * slider links every current exhibition, across all its houses (the Castelló
 * museums too). Each `/exposicion/` page states "Dates:" and "Lloc:"; only the
 * ones held at the Centre del Carme are kept. `?lang=es` serves the Spanish
 * text instead of the default Valencian.
 */
const BASE = "https://www.consorcimuseus.gva.es";

export async function scrapeCentreDelCarme(): Promise<VenueScrapeResult> {
  const today = todayIso();
  const home = await fetchText(`${BASE}/`);
  const urls = [...new Set([...home.matchAll(/href="(https:\/\/www\.consorcimuseus\.gva\.es\/exposicion\/[^"]+)"/g)].map((m) => m[1]))];
  const events: CanonicalScrapedEvent[] = [];
  for (const url of urls) {
    const html = await fetchText(`${url}?lang=es`);
    const body = html.match(/id="content"[\s\S]*?<!-- #content -->/)?.[0] ?? html;
    // The page has no <h1>; the <title> is "TITLE – Consorci Museus".
    const heading = clean(html.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? "").replace(/\s*[–-]\s*Consorci Museus$/, "");
    const text = clean(body);
    const place = text.match(/Lugar:\s*(.+?)(?:\s+Organiza:|\s+Produce:|\s+Comisariado:|$)/)?.[1] ?? "";
    if (!/Carme/i.test(place)) continue;
    const span = parseDateSpan(text.match(/Fechas?:\s*(.+?)\s+Lugar:/)?.[1] ?? "", today);
    if (!heading || !span || (span.end ?? span.start) < today) continue;
    events.push({
      source_event_id: new URL(url).pathname,
      title: heading,
      description: clean(html.match(/property="og:description" content="([^"]*)"/)?.[1] ?? "") || null,
      date: span.start,
      end_date: span.end,
      detail_url: url,
      image_url: html.match(/og:image" content="([^"]+)"/)?.[1] ?? null,
      venue_room: place.split(".").slice(1).join(".").replace(/\s+Artista:.*$/, "").replace(/\.$/, "").trim() || null,
      labels: [EXHIBITION_LABEL],
      lat: 39.4786,
      lon: -0.3812,
      ...VALENCIA,
    });
  }
  return { source_slug: "centre-del-carme", display_name: "Centre del Carme Cultura Contemporània", events };
}
