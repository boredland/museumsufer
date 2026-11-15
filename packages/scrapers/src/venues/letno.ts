import { todayIso } from "@museumsufer/core";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";
import { absolute, clean, EXHIBITION_LABEL, eventLabels, expectFound, fetchText, monthNumber, parseDateSpan, iso, VALENCIA } from "./_valencia";

/**
 * L'ETNO, Museu Valencià d'Etnologia (Diputació de València), a Drupal 11 site.
 * `/es/exposiciones` lists the temporary and micro exhibitions as `views-row` cards with
 * "15 May 2023 - 31 Dic 2026"; `/es/actividades` lists dated sessions as
 * "15 Nov 2026 - 11:00 - 12:00", one row per session. Rows without a date are cycles
 * (no day to attach), prize calls and events held outside the museum; they are skipped.
 * The permanent exhibition has no dates and is not listed.
 */
const BASE = "https://letno.dival.es";
const GEO = { lat: 39.4784, lon: -0.3833 };
const ROW_SPLIT = '<div class="views-row">';
const NOT_AT_MUSEUM = /\/actividad\/convocatoria\/|actos-fuera-del-museo/;

export async function scrapeLetno(): Promise<VenueScrapeResult> {
  const today = todayIso();
  const [exhibitions, activities] = await Promise.all([
    fetchText(`${BASE}/es/exposiciones`),
    fetchText(`${BASE}/es/actividades`),
  ]);
  const events: CanonicalScrapedEvent[] = [];

  const expoRows = expectFound(exhibitions.split(ROW_SPLIT).slice(1).map(parseRow).filter((r) => r !== null), "letno.dival.es/es/exposiciones");
  for (const row of expoRows) {
    if (NOT_AT_MUSEUM.test(row.path)) continue;
    const span = parseDateSpan(row.dateText, today);
    if (!span || (span.end ?? span.start) < today) continue;
    events.push({
      source_event_id: row.path,
      title: row.title,
      date: span.start,
      end_date: span.end,
      detail_url: absolute(BASE, row.path),
      image_url: row.image,
      // "Antes del jardín" hangs in the NATÚRIA building in the Turia garden, not in the museum.
      venue_room: row.path.endsWith("/antes-del-jardin") ? "Edificio NATÚRIA (Jardín del Turia)" : null,
      labels: [EXHIBITION_LABEL],
      ...GEO,
      ...VALENCIA,
    });
  }

  const activityRows = expectFound(activities.split(ROW_SPLIT).slice(1).map(parseRow).filter((r) => r !== null), "letno.dival.es/es/actividades");
  for (const row of activityRows) {
    if (NOT_AT_MUSEUM.test(row.path)) continue;
    const m = row.dateText.match(/^(\d{1,2})\s+([A-Za-zñ]+)\s+(\d{4})\s+-\s+(\d{2}):(\d{2})(?:\s+-\s+(\d{2}):(\d{2}))?$/);
    const month = m ? monthNumber(m[2]) : null;
    if (!m || !month) continue;
    const date = iso(m[3], month, m[1]);
    if (date < today) continue;
    events.push({
      source_event_id: `${row.path}|${date}|${m[4]}:${m[5]}`,
      title: row.title,
      date,
      time: `${m[4]}:${m[5]}`,
      end_time: m[6] ? `${m[6]}:${m[7]}` : null,
      detail_url: absolute(BASE, row.path),
      image_url: row.image,
      raw_category: row.kicker || null,
      labels: eventLabels(row.path.split("/")[3]?.replace(/-/g, " "), row.kicker, row.title),
      ...GEO,
      ...VALENCIA,
    });
  }

  return { source_slug: "letno", display_name: "L'ETNO, Museu Valencià d'Etnologia", events };
}

function parseRow(row: string) {
  const path = row.match(/href="(\/es\/(?:actividad|exposicion)\/[^"]+)"/)?.[1];
  const dateText = clean(row.match(/views-field-field-fecha-del-evento"><div class="field-content">([\s\S]*?)<\/div><\/div>/)?.[1] ?? "");
  if (!path || !dateText) return null;
  // Titles sit in a `views-field-title(-1)` span; the kicker above them is the activity type.
  const titleHtml = row.match(/views-field-title(?:-1)?"><span class="field-content"><a [^>]*>([\s\S]*?)<\/a>/)?.[1] ?? "";
  const title = clean(titleHtml);
  if (!title) return null;
  const img = row.match(/<img[^>]+src="([^"?]+)/)?.[1];
  return {
    path,
    dateText,
    title,
    kicker: clean(row.match(/views-field-field-antetitulo"><div class="field-content">([\s\S]*?)<\/div>/)?.[1] ?? ""),
    image: img ? absolute(BASE, img) : null,
  };
}
