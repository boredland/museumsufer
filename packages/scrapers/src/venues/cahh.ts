import { todayIso } from "@museumsufer/core";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";
import {
  absolute,
  addDaysIso,
  clean,
  EXHIBITION_LABEL,
  expectFound,
  eventLabels,
  fetchText,
  iso,
  monthNumber,
  parseDateSpan,
  VALENCIA,
} from "./_valencia";

/**
 * Centro de Arte Hortensia Herrero (Palacio Valeriola). `/actividades/` links
 * each activity page; a detail page opens with "Title 07 y 21 de noviembre
 * 12:00h" (several days share one page, so one event per day) followed by
 * "Duración … 7€". Pages flagged "Actividad finalizada" are skipped. The single
 * current exhibition sits on `/exposiciones/` as "29 abril - 25 octubre 2026"
 * right after its title.
 */
const BASE = "https://www.cahh.es";
const GEO = { lat: 39.4740, lon: -0.3733 };
const DAYS_RE = /(\d{1,2}(?:\s*(?:,|y)\s*\d{1,2})*)\s+de\s+([A-Za-zñ]+)/;

export async function scrapeCahh(): Promise<VenueScrapeResult> {
  const today = todayIso();
  const [list, exhibitions] = await Promise.all([fetchText(`${BASE}/actividades/`), fetchText(`${BASE}/exposiciones/`)]);
  const events: CanonicalScrapedEvent[] = [];

  const urls = expectFound([...new Set([...list.matchAll(/href="(https:\/\/www\.cahh\.es\/actividades\/[^"]+)"/g)].map((m) => m[1]))], "cahh.es/actividades");
  for (const url of urls) {
    const html = await fetchText(url);
    const text = clean(html.slice(html.indexOf("ENTRADAS") + 8, html.indexOf("Duración")));
    if (/^Actividad finalizada/i.test(text)) continue;
    const head = text.match(DAYS_RE);
    const month = head ? monthNumber(head[2]) : null;
    if (!head || !month || head.index === undefined) continue;
    const title = text.slice(0, head.index).trim();
    const time = text.match(/(\d{1,2}):(\d{2})\s*h/);
    const priceText = clean(html.slice(html.indexOf("Duración"), html.indexOf("Duración") + 1200)).slice(0, 80);
    const price = /GRATUITO/i.test(priceText) ? 0 : Number(priceText.match(/(\d+(?:[.,]\d+)?)\s*€/)?.[1]?.replace(",", ".") ?? NaN);
    const image = html.match(/og:image" content="([^"]+)"/)?.[1];
    for (const day of head[1].match(/\d{1,2}/g) ?? []) {
      const date = inUpcomingYear(month, day, today);
      if (!title || date < today) continue;
      events.push({
        source_event_id: `${new URL(url).pathname}|${date}`,
        title,
        description: clean(html.match(/property="og:description" content="([^"]*)"/)?.[1] ?? "") || null,
        date,
        time: time ? `${time[1].padStart(2, "0")}:${time[2]}` : null,
        detail_url: url,
        image_url: image ?? null,
        price_min: Number.isFinite(price) ? price : null,
        labels: eventLabels(title),
        ...GEO,
        ...VALENCIA,
      });
    }
  }

  // The exhibitions page has no per-show page; the dated line follows the title.
  const page = clean(exhibitions.slice(exhibitions.indexOf('id="content"')));
  for (const m of page.matchAll(/([^.]{3,80}?)\s+(\d{1,2}\s+[a-zé]+\s*-\s*\d{1,2}\s+[a-zé]+\s+\d{4})/gi)) {
    const span = parseDateSpan(m[2], today);
    const title = m[1].trim().replace(/^.*colección\.\s*/i, "");
    if (!span || !title || (span.end ?? span.start) < today) continue;
    events.push({
      source_event_id: `exposicion|${title.toLowerCase()}`,
      title,
      date: span.start,
      end_date: span.end,
      detail_url: absolute(BASE, "/exposiciones/"),
      labels: [EXHIBITION_LABEL],
      ...GEO,
      ...VALENCIA,
    });
  }
  return { source_slug: "cahh", display_name: "Centro de Arte Hortensia Herrero", events };
}

/** Pages give day and month only; pick the next occurrence that is not long past. */
function inUpcomingYear(month: string, day: string, today: string): string {
  const year = Number(today.slice(0, 4));
  const date = iso(year, month, day);
  return date < addDaysIso(today, -60) ? iso(year + 1, month, day) : date;
}
