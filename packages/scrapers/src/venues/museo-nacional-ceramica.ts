import { todayIso } from "@museumsufer/core";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";
import { absolute, addDaysIso, clean, EXHIBITION_LABEL, eventLabels, fetchText, OPEN_ENDED_DAYS, parseDateSpan, VALENCIA } from "./_valencia";

/**
 * Museo Nacional de Cerámica y Artes Suntuarias "González Martí" (Palacio del
 * Marqués de Dos Aguas). The Ministry of Culture microsite lists current
 * exhibitions at `/exposiciones.html` and dated concerts/activities at
 * `/actividades.html`, each linking a detail page whose "Fecha(s)" block gives
 * the dates ("Del 15 de septiembre al 31 de octubre", "Lunes 30 de noviembre a
 * las 20:00 h"). An exhibition announced only by "Inauguración 16 de septiembre
 * de 2026" gets an open end. Archive pages (`historico`) are not followed.
 */
const BASE = "https://www.cultura.gob.es";
const ROOT = `${BASE}/mnceramica`;

export async function scrapeMuseoNacionalCeramica(): Promise<VenueScrapeResult> {
  const today = todayIso();
  const [exhibitionList, activityList] = await Promise.all([
    fetchText(`${ROOT}/exposiciones.html`),
    fetchText(`${ROOT}/actividades.html`),
  ]);
  const events: CanonicalScrapedEvent[] = [];
  for (const [list, exhibition] of [
    [exhibitionList, true],
    [activityList, false],
  ] as const) {
    for (const path of detailPaths(list, exhibition)) {
      const event = await parseDetail(absolute(BASE, path), exhibition, today);
      if (event) events.push(event);
    }
  }
  return { source_slug: "museo-nacional-ceramica", display_name: "Museo Nacional de Cerámica González Martí", events };
}

function detailPaths(html: string, exhibition: boolean): string[] {
  const dir = exhibition ? "exposiciones" : "actividades";
  const re = new RegExp(`class="titulo">\\s*<a href="(/mnceramica/${dir}/[^"]+\\.html)"`, "g");
  return [...new Set([...html.matchAll(re)].map((m) => m[1]))].filter((p) => !/historico|\/(conciertos|otras-actividades)\.html$/.test(p));
}

async function parseDetail(url: string, exhibition: boolean, today: string): Promise<CanonicalScrapedEvent | null> {
  const html = await fetchText(url);
  const title = clean(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1] ?? "");
  const text = clean(html.slice(html.indexOf('id="contenido"')));
  const raw = text.match(/Fechas?\s+(.+?)(?=\s+(?:Sala|Cat[aá]logo|Programa|Reservas|Comisari|Organiza|Nota de)\b|$)/)?.[1] ?? "";
  const span = parseDateSpan(raw.replace(/^Inauguraci[oó]n\s+/i, ""), today);
  // A bare "Inauguración <date>" gives no closing date; list it for OPEN_ENDED_DAYS from opening.
  const openEnded = exhibition && /^Inauguraci[oó]n/i.test(raw) && span?.end === null;
  const endDate = span ? (openEnded ? addDaysIso(span.start, OPEN_ENDED_DAYS) : span.end) : null;
  if (!title || !span || (endDate ?? span.start) < today) return null;
  const time = raw.match(/(\d{1,2}):(\d{2})\s*h/);
  const image = html.match(/og:image" content="([^"]+)"/)?.[1];
  return {
    source_event_id: new URL(url).pathname,
    title,
    description: clean(html.match(/<h1[\s\S]*?<\/h1>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/)?.[1] ?? "").slice(0, 2000) || null,
    date: span.start,
    end_date: exhibition ? endDate : null,
    time: time ? `${time[1].padStart(2, "0")}:${time[2]}` : null,
    detail_url: url,
    venue_room: text.match(/Sala de exposiciones temporales [IV]+|Sal[oó]n de baile/)?.[0] ?? null,
    labels: exhibition ? [EXHIBITION_LABEL] : eventLabels(title, raw),
    lat: 39.4721,
    lon: -0.3774,
    ...VALENCIA,
  };
}
