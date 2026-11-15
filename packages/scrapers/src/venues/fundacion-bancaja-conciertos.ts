import { decodeEntities, todayIso } from "@museumsufer/core";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";
import { cleanText, fetchVlc, genreFromText, mapPool, musicLabel, pricesFrom } from "./_valencia-music";

const BASE = "https://www.fundacionbancaja.es";
const LIST_URL = `${BASE}/actividades/`;
// Plaça de Tetuan 23; looked up once by hand, never geocoded in the scrape.
const LAT = 39.4735;
const LON = -0.3702;

const MONTHS: Record<string, string> = {
  enero: "01", febrero: "02", marzo: "03", abril: "04", mayo: "05", junio: "06",
  julio: "07", agosto: "08", septiembre: "09", octubre: "10", noviembre: "11", diciembre: "12",
};

/** Concert pages say so in the slug or title; talks, workshops and exhibitions do not. */
const CONCERT = /concert|concierto|carmen-linares|dorantes|tim-ries|recital/i;

/**
 * Fundación Bancaja (Plaza de Tetuán), cycle "Els Concerts a la Fundació".
 * /actividades/ lists activity pages; each concert page has a single
 * "Fecha: 20 Noviembre 2026", "Horario: 20 h" and "Tarifas: 10 €" block. Only
 * pages held at Fundación Bancaja itself are kept (others are Castellón/Sagunto).
 */
export async function scrapeFundacionBancajaConciertos(): Promise<VenueScrapeResult> {
  const today = todayIso();
  const html = await fetchVlc(LIST_URL);
  const urls = [...new Set([...html.matchAll(/href="(https:\/\/www\.fundacionbancaja\.es\/actividad\/[^"/]+\/)"/g)].map((m) => m[1]))];
  if (urls.length === 0) throw new Error("fundacion-bancaja-conciertos: no activity links in listing");

  const pages = await mapPool(urls.filter((u) => CONCERT.test(u)), 4, async (url) => ({ url, html: await fetchVlc(url) }));
  const events: CanonicalScrapedEvent[] = [];
  for (const { url, html: page } of pages) {
    const text = cleanText(page.replace(/<\/(?:p|div|li|h\d|td|tr)>/gi, "\n"));
    const date = text.match(/Fecha\s*(\d{1,2}) (\p{L}+) (\d{4})(?!\s*al)/u);
    const month = date ? MONTHS[date[2].toLowerCase()] : undefined;
    // Cycle overview pages ("Del 25/09/2026 al 05/03/2027") have no single date.
    if (!date || !month) continue;
    const iso = `${date[3]}-${month}-${date[1].padStart(2, "0")}`;
    if (iso < today || !/Centro\s+Fundaci[oó]n Bancaja/i.test(text)) continue;
    const hour = text.match(/Horario\s*(\d{1,2})(?::(\d{2}))?\s*h/i);
    const title = cleanText(page.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1] ?? page.match(/<title>([^<|–-]+)/)?.[1] ?? "");
    if (!title) throw new Error(`fundacion-bancaja-conciertos: no title on ${url}`);
    const price = pricesFrom(text.match(/Tarifas\s*([^\n]{0,80})/)?.[1] ?? "");
    const og = page.match(/property="og:image" content="([^"]+)"/)?.[1];
    events.push({
      source_event_id: `${url.split("/").filter(Boolean).pop()}-${iso}`,
      title: title.replace(/\.\s*Els Concerts a la Fundaci[oó]$/i, ""),
      subtitle: /Els Concerts a la Fundaci/i.test(title) ? "Els Concerts a la Fundació" : null,
      date: iso,
      time: hour ? `${hour[1].padStart(2, "0")}:${hour[2] ?? "00"}` : null,
      detail_url: url,
      ticket_url: url,
      image_url: og ? decodeEntities(og) : null,
      price_min: price.min,
      price_max: price.max,
      language: "es",
      venue_room: "Fundación Bancaja",
      city: "valencia",
      lat: LAT,
      lon: LON,
      raw_category: "concierto",
      labels: musicLabel(genreFromText(`${title} ${url}`, "world"), 0.7),
    });
  }
  events.sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? ""));
  return { source_slug: "fundacion-bancaja-conciertos", display_name: "Fundación Bancaja", events };
}
