import { todayIso } from "@museumsufer/core";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";
import { absolute, clean, EXHIBITION_LABEL, expectFound, fetchText, parseDateSpan, VALENCIA } from "./_valencia";

/**
 * Centre Cultural La Nau (Universitat de València). `exposiciones-actuales` renders each
 * running exhibition as an `activitat-box` card with a year-less date ("14 octubre al 14
 * febrero"); `parseDateSpan` places it relative to today. Cards linking anything other
 * than a `lista-actividad` page (the "Arte Público" open call) are not exhibitions.
 */
const BASE = "https://www.uv.es";
const LIST = `${BASE}/uvweb/cultura/es/exposiciones/centre-cultural-nau/exposiciones-actuales-1286061053908.html`;

export async function scrapeLaNau(): Promise<VenueScrapeResult> {
  const today = todayIso();
  const html = await fetchText(LIST);
  const cards = expectFound(html.split('<article class="activitat-box">').slice(1), "uv.es La Nau exposiciones-actuales");
  const events: CanonicalScrapedEvent[] = [];
  for (const card of cards) {
    const href = card.match(/href='([^']*lista-actividad[^']*)'/)?.[1];
    const headerHtml = card.match(/class="header-3">([\s\S]*?)<\/span>\s*<\/header>/)?.[1];
    if (!href || !headerHtml) continue;
    const span = parseDateSpan(clean(card.match(/class="date">([\s\S]*?)<\/div>/)?.[1] ?? ""), today);
    if (!span || (span.end ?? span.start) < today) continue;
    const img = card.match(/<img class="img-responsive" src="([^"]+)"/)?.[1];
    events.push({
      source_event_id: new URL(absolute(BASE, href)).searchParams.get("id") ?? href,
      title: title(headerHtml),
      date: span.start,
      end_date: span.end,
      detail_url: absolute(BASE, href),
      image_url: img ? absolute(BASE, encodeURI(img)) : null,
      labels: [EXHIBITION_LABEL],
      lat: 39.4717,
      lon: -0.3726,
      ...VALENCIA,
    });
  }
  return { source_slug: "la-nau", display_name: "Centre Cultural La Nau", events };
}

/** Headers embed the subtitle in `<div>`/`</br>` fragments: "TITLE<div>Subtitle</div>". */
function title(headerHtml: string): string {
  const parts = headerHtml
    .split(/<\/?br\s*\/?>|<\/?div>/i)
    .map((p) => clean(p))
    .filter(Boolean);
  return parts.reduce((acc, part) => (acc ? `${acc}${/[:.]$/.test(acc) ? " " : " – "}${part}` : part), "");
}
