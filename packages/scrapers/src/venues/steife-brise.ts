import { decodeEntities, stripHtml, todayIso } from "@museumsufer/core";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";
import { resolveStageLabels } from "./_stage-labels";

/**
 * Steife Brise — Hamburg's long-running improv company (since 1992). No fixed
 * stage: shows run at partner venues (Imperial Theater, Cap San Diego,
 * Hafenbühne im PIERDREI, seasonal open-airs). The spielplan grid lazy-loads
 * over JetEngine AJAX, but the homepage server-renders the upcoming-shows
 * slider, which is what we parse. Imperial Theater dates also surface via the
 * `imperial-theater` source; the producer attribution differs, so both stand.
 */
const HOME_URL = "https://steife-brise.de/";
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

const MONTHS: Record<string, string> = {
  jan: "01",
  feb: "02",
  mär: "03",
  mae: "03",
  apr: "04",
  mai: "05",
  jun: "06",
  jul: "07",
  aug: "08",
  sep: "09",
  okt: "10",
  nov: "11",
  dez: "12",
};

const FIELD = (icon: string): RegExp =>
  new RegExp(`fa-${icon}[^>]*></i><div class="jet-listing-dynamic-field__content"\\s*>([^<]+)<`);

export async function scrapeSteifeBrise(): Promise<VenueScrapeResult> {
  const res = await fetch(HOME_URL, { headers: { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" } });
  if (!res.ok) throw new Error(`steife-brise fetch failed: ${res.status}`);
  const html = await res.text();
  const today = todayIso();

  const events: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();

  for (const item of html.split('class="jet-listing-grid__item').slice(1)) {
    const detailUrl = item.match(/data-url="([^"]+\/improtheater[^"]*)"/)?.[1];
    const dateRaw = item.match(FIELD("calendar-alt"))?.[1];
    const titleM = item.match(/<h2 class="jet-listing-dynamic-field__content"\s*>([^<]+)<\/h2>/);
    if (!detailUrl || !dateRaw || !titleM) continue;

    const dm = dateRaw.match(/(\d{1,2})\.\s+([A-Za-zÄÖÜäöü]+)\s+(\d{4})/);
    const month = dm ? MONTHS[dm[2].toLowerCase().slice(0, 3)] : undefined;
    if (!dm || !month) continue;
    const date = `${dm[3]}-${month}-${dm[1].padStart(2, "0")}`;
    if (date < today) continue;

    const slug = detailUrl.match(/\/([^/]+)\/?$/)?.[1] ?? `${date}-${titleM[1]}`;
    if (seen.has(slug)) continue;
    seen.add(slug);

    const timeM = item.match(FIELD("clock"))?.[1]?.match(/(\d{1,2}):(\d{2})/);
    const venue = decodeEntities(item.match(FIELD("map-marker-alt"))?.[1]?.trim() ?? "") || null;
    const terms = [...item.matchAll(/jet-listing-dynamic-terms__link">([^<]+)</g)].map((m) => m[1].trim());
    const title = stripHtml(decodeEntities(titleM[1])).trim();

    events.push({
      source_event_id: slug,
      title,
      subtitle: terms.join(", ") || null,
      description: null,
      date,
      time: timeM ? `${timeM[1].padStart(2, "0")}:${timeM[2]}` : null,
      detail_url: detailUrl,
      ticket_url: detailUrl,
      image_url: null,
      price_min: null,
      price_max: null,
      performers: null,
      venue_room: venue,
      raw_category: terms.join(", ") || null,
      labels: resolveStageLabels({
        title,
        hint: `${terms.join(" ")} Improvisationstheater`,
        defaultLabel: "stage:theater",
        confidence: 0.85,
        classifier: "scraper-hardcoded",
      }),
    });
  }

  return { source_slug: "steife-brise", display_name: "Steife Brise", events };
}
