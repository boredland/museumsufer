import { decodeEntities, todayIso } from "@museumsufer/core";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";
import { cleanText, fetchVlc, genreFromText, musicLabel } from "./_valencia-music";

const BASE = "https://palauvalencia.com";
const LAT = 39.4662;
const LON = -0.3605;

/** Card class → genre; the venue's own series are more reliable than text. */
const SERIES_GENRE: Record<string, "chamber" | "classical"> = {
  "cicle-cambra": "chamber",
  "abono-piano-2026-2027": "classical",
  "banda-municipal-de-val-egrave-ncia": "classical",
  "el-palau-amb-les-bandes": "classical",
};
/** Film festival screenings, training days and the Sabina pop tribute are not in scope. */
const SKIP_SERIES = /\bmostra-cinema-del-mediterrani\b/;
const SKIP_TITLE = /periscopio|mostra365|cine culpable|sabineando|\bvisuals\b/i;

/**
 * Palau de la Música de València. /programacio-i-vendes/ renders the whole
 * season server-side as `.card_container.event` blocks (date, time, trilingual
 * title spans, ticketing link on tickets.palauvalencia.com).
 */
export async function scrapePalauDeLaMusicaValencia(): Promise<VenueScrapeResult> {
  const today = todayIso();
  const html = await fetchVlc(`${BASE}/programacio-i-vendes/`);
  const events: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();

  for (const block of html.split(/<div id="event-(?=\d+")/).slice(1)) {
    const ev = parseCard(block, today);
    if (!ev || seen.has(ev.source_event_id)) continue;
    seen.add(ev.source_event_id);
    events.push(ev);
  }
  events.sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? ""));
  return { source_slug: "palau-de-la-musica-valencia", display_name: "Palau de la Música de València", events };
}

function parseCard(block: string, today: string): CanonicalScrapedEvent | null {
  const id = block.match(/^(\d+)"/)?.[1];
  const classes = block.match(/class="\s*([^"]*)"/)?.[1] ?? "";
  const date = block.match(/data-date="(\d{2})\/(\d{2})\/(\d{4})"/);
  if (!id || !date || SKIP_SERIES.test(classes)) return null;
  const iso = `${date[3]}-${date[2]}-${date[1]}`;
  if (iso < today) return null;

  const time = block.match(/Hora: <\/strong>[\s\S]*?<span class="notranslate">\s*(\d{1,2}:\d{2})/)?.[1];
  const esSpan = block.match(/<h5 class="card-title event-title"><span class="notranslate es">([\s\S]*?)<\/span><span class="notranslate va">/)?.[1];
  if (!esSpan) return null;
  const lines = esSpan
    .split(/<br\s*\/?>|<\/p>|<\/strong>/i)
    .map((l) => cleanText(l))
    .filter(Boolean)
    // "<strong>ALBA VENTURA</strong>, piano" splits into a name and a bare ", piano".
    .reduce<string[]>((acc, l) => {
      if (/^[,;]/.test(l) && acc.length > 0) acc[acc.length - 1] = `${acc[acc.length - 1]}${l}`;
      else acc.push(l);
      return acc;
    }, []);
  if (lines.length === 0 || SKIP_TITLE.test(lines.join(" "))) return null;

  const ticket = block.match(/href="((?:https?:)?\/\/tickets\.palauvalencia\.com[^"]+)"/)?.[1];
  const ticketUrl = ticket ? decodeEntities(ticket.startsWith("//") ? `https:${ticket}` : ticket) : null;
  const series = classes.split(/\s+/).find((c) => c in SERIES_GENRE);
  const genre = series ? SERIES_GENRE[series] : genreFromText(lines.join(" "), "classical");

  return {
    source_event_id: `${id}-${iso}-${time ?? ""}`,
    title: lines[0],
    subtitle: lines[1] ?? null,
    description: null,
    date: iso,
    time: time ? time.padStart(5, "0") : null,
    detail_url: `${BASE}/event/?id=${id}`,
    ticket_url: ticketUrl,
    image_url: block.match(/<img[^>]+src="([^"]+)"[^>]*card-img-top/)?.[1] ?? null,
    language: "es",
    performers: lines.slice(1).join(", ") || null,
    city: "valencia",
    lat: LAT,
    lon: LON,
    raw_category: classes.split(/\s+/).find((c) => c !== "" && !/^(card_container|event|d-none|animate-in|event-\d+|day-\d+)$/.test(c)) ?? null,
    labels: musicLabel(genre, 0.85),
  };
}
