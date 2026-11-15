import { todayIso } from "@museumsufer/core";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";
import { absolute, clean, EXHIBITION_LABEL, eventLabels, expectFound, fetchText, iso, monthNumber, parseDateSpan, VALENCIA } from "./_valencia";

/**
 * IVAM (Institut Valencià d'Art Modern). Its WordPress theme renders the
 * `/es/exposiciones/` and `/es/actividades/` archives as server-side
 * `ivam-post-card` blocks grouped by `data-timeline` (present / future / past);
 * the past group is skipped. Card dates are "28 oct. 2026 – 11 abr. 2027".
 *
 * A card with a range is a recurring programme ("13 sep. 2025 – 20 dic. 2026"), not a
 * multi-day event. The app drops events dated before yesterday, so such a card would
 * vanish (or sit under its 2024 start). Its detail page lists the actual sessions
 * ("Sábado 5 de septiembre, 11h", "14 y 28 noviembre"); those become one event each.
 * A range with no session list is kept only when it starts in the future (a play space
 * opening on a given day); standing offers that began in the past are dropped.
 */
const BASE = "https://ivam.es";
const SLUG = "ivam";

export async function scrapeIvam(): Promise<VenueScrapeResult> {
  const today = todayIso();
  const [exhibitions, activities] = await Promise.all([
    fetchText(`${BASE}/es/exposiciones/`),
    fetchText(`${BASE}/es/actividades/`),
  ]);
  const events = [...expectFound(parseCards(exhibitions, today, true), "ivam.es exposiciones")];
  for (const card of expectFound(parseCards(activities, today, false), "ivam.es actividades")) {
    if (card.end_date) events.push(...(await expandSessions(card, today)));
    else events.push(card);
  }
  return { source_slug: SLUG, display_name: "IVAM", events };
}

const WEEKDAY = "(?:lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)";
// "Sábado 5 de septiembre, 11h" / "14 y 28 noviembre" / "Domingo 07 febrero, 12h"; must open the line.
const SESSION_RE = new RegExp(`^\\s*(?:${WEEKDAY}\\s+)?(\\d{1,2}(?:\\s*(?:,|y)\\s*\\d{1,2})*)\\s+(?:de\\s+)?([A-Za-zñ]+)(?:\\s+de\\s+(\\d{4}))?`, "i");
const TIME_RE = /\b(\d{1,2})(?::(\d{2}))?\s*h\b/;

async function expandSessions(card: CanonicalScrapedEvent, today: string): Promise<CanonicalScrapedEvent[]> {
  const html = await fetchText(card.detail_url!);
  const body = html.slice(html.indexOf("<main"), html.indexOf("Relacionados"));
  const lines = body
    .replace(/<\/(?:p|li|div|h\d)>|<br\s*\/?>/gi, "\n")
    .split("\n")
    .map((l) => clean(l))
    .filter(Boolean);
  const defaultTime = lines.find((l) => /^Horario:/i.test(l))?.match(TIME_RE);
  let year = Number(today.slice(0, 4));
  const sessions = new Map<string, CanonicalScrapedEvent>();
  for (const line of lines) {
    const heading = line.match(/^Fechas\s+(\d{4})/i);
    if (heading) year = Number(heading[1]);
    const m = line.match(SESSION_RE);
    const month = m ? monthNumber(m[2]) : null;
    if (!m || !month) continue;
    const time = line.slice(m[0].length).match(TIME_RE) ?? defaultTime;
    for (const day of m[1].match(/\d{1,2}/g) ?? []) {
      const date = iso(m[3] ?? year, month, day);
      if (date < today) continue;
      const hhmm = time ? `${time[1].padStart(2, "0")}:${time[2] ?? "00"}` : null;
      sessions.set(`${date}|${hhmm}`, {
        ...card,
        source_event_id: `${card.source_event_id}|${date}|${hhmm ?? ""}`,
        date,
        end_date: null,
        time: hhmm,
      });
    }
  }
  if (sessions.size > 0) return [...sessions.values()];
  return card.date >= today ? [card] : [];
}

function parseCards(html: string, today: string, exhibition: boolean): CanonicalScrapedEvent[] {
  const out: CanonicalScrapedEvent[] = [];
  for (const group of html.split('data-timeline="').slice(1)) {
    const timeline = group.slice(0, group.indexOf('"'));
    if (timeline === "past") continue;
    for (const card of group.split('<div class="ivam-post-card ').slice(1)) {
      const link = card.match(/<a href="([^"]+)" title="[^"]*">\s*<h3 class="ivam-post-card__title">([\s\S]*?)<\/h3>/);
      const span = parseDateSpan(clean(card.match(/<p class="date">([\s\S]*?)<\/p>/)?.[1] ?? ""), today);
      if (!link || !span || (span.end ?? span.start) < today) continue;
      const title = clean(link[2]);
      const categories = [...card.matchAll(/<span>([^<]+)<\/span>/g)].map((m) => clean(m[1]));
      const img = card.match(/<img class="ivam-post-card__img" src="([^"]+)"/)?.[1];
      out.push({
        source_event_id: `${exhibition ? "exposicion" : "actividad"}|${new URL(link[1]).pathname}`,
        title,
        date: span.start,
        end_date: span.end,
        detail_url: absolute(BASE, link[1]),
        image_url: img ? absolute(BASE, img) : null,
        raw_category: categories.join(", ") || null,
        venue_room: categories.find((c) => /^IVAM /.test(c)) ?? null,
        labels: exhibition ? [EXHIBITION_LABEL] : eventLabels(categories.join(" "), title),
        lat: 39.4796,
        lon: -0.3829,
        ...VALENCIA,
      });
    }
  }
  return out;
}
