import { decodeEntities, todayIso } from "@museumsufer/core";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";
import { resolveStageLabels } from "./_stage-labels";

/**
 * Klabauter Theater — inclusive ensemble (actors with learning disabilities)
 * of Stiftung Das Rauhe Haus in Hamburg-Horn. The WordPress site builds its
 * spielplan with SiteOrigin Page Builder: a `<h3 class="widget-title">Monat
 * Jahr</h3>` header per month, then `<div class="textwidget">` blocks whose
 * `<p>` paragraphs carry the production title, an optional "zum Stück" link,
 * and date lines `<strong>DD.MM.YYYY </strong>| HH.MM Uhr | Label`. A single
 * date line may list several showtimes (`18.00, 19.00 & 20.00 Uhr`); each
 * becomes its own performance. Reachable only over the apex domain — the
 * `www.` host's TLS cert is broken, which is why direct fetches to it fail.
 */
const SPIELPLAN_URL = "https://klabauter-theater.de/spielplan/";
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

const MONTHS: Record<string, string> = {
  januar: "01",
  februar: "02",
  märz: "03",
  april: "04",
  mai: "05",
  juni: "06",
  juli: "07",
  august: "08",
  september: "09",
  oktober: "10",
  november: "11",
  dezember: "12",
};

export async function scrapeKlabauterTheater(): Promise<VenueScrapeResult> {
  const res = await fetch(SPIELPLAN_URL, {
    headers: { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" },
  });
  if (!res.ok) throw new Error(`klabauter-theater fetch failed: ${res.status}`);
  const html = await res.text();
  const today = todayIso();

  const start = html.indexOf("<h1><strong>SPIELPLAN");
  const region = start >= 0 ? html.slice(start, html.indexOf("<footer", start)) : html;

  const events: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();

  // Each month header introduces the textwidgets that follow it.
  for (const monthBlock of region.split(/<h3 class="widget-title">/).slice(1)) {
    const headerEnd = monthBlock.indexOf("</h3>");
    const header = monthBlock.slice(0, headerEnd).trim().toLowerCase();
    const monthName = header.split(/\s+/)[0];
    const month = MONTHS[monthName];
    if (!month) continue;

    for (const wm of monthBlock.matchAll(/<div class="textwidget">([\s\S]*?)<\/div>\s*<\/div>/g)) {
      // A textwidget can list several productions separated by empty
      // paragraphs; split on those so each production's title binds only
      // to its own date lines.
      for (const chunk of wm[1].split(/<p>(?:&nbsp;|\s)*<\/p>/)) {
        addShows(chunk, events, seen, today);
      }
    }
  }

  return { source_slug: "klabauter-theater", display_name: "Klabauter Theater", events };
}

function addShows(chunk: string, events: CanonicalScrapedEvent[], seen: Set<string>, today: string): void {
  const detailUrl = chunk.match(/<a[^>]+href="([^"]+)"/)?.[1]?.replace(/^http:/, "https:") ?? null;

  // Normalise to text lines: <br>/<p> become line breaks, then strip tags
  // and decode. Parsing text sidesteps the markup's quirks — e.g. the date
  // sometimes sits behind a stray `<br>` inside its own `<strong>`.
  const lines = decodeEntities(
    chunk
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<[^>]+>/g, ""),
  )
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  // A performance row is `DD.MM.YYYY | HH.MM[, HH.MM…] Uhr | Label`.
  const dateLine = /^(\d{2})\.(\d{2})\.(\d{4})\s*\|\s*([^|]*?)\s*(?:\|\s*(.*))?$/;
  const firstDateIdx = lines.findIndex((l) => dateLine.test(l));
  if (firstDateIdx < 0) return;

  const titleLines = lines
    .slice(0, firstDateIdx)
    .filter((l) => !/^zum (Stück|Festival)$/i.test(l) && !/^Ort:/i.test(l));
  const title = titleLines[0];
  if (!title) return;
  const subtitle = titleLines.slice(1).join(" — ") || null;

  // A trailing "Ort: …" names the host venue for the whole block (the
  // ensemble guests at festivals and partner stages).
  const venueRoom =
    lines
      .find((l) => /^Ort:/i.test(l))
      ?.replace(/^Ort:\s*/i, "")
      .trim() || null;

  for (const line of lines) {
    const m = line.match(dateLine);
    if (!m) continue;
    const [, dd, mm, yyyy, timesRaw, label] = m;
    const date = `${yyyy}-${mm}-${dd}`;
    if (date < today) continue;

    // One row may carry several showtimes: "18.00, 19.00 & 21.00 Uhr".
    const times = [...timesRaw.matchAll(/(\d{1,2})[.:](\d{2})/g)].map((t) => `${t[1].padStart(2, "0")}:${t[2]}`);
    const slots = times.length ? times : [null];

    for (const time of slots) {
      const sourceEventId = `${date}|${time ?? ""}|${title}`;
      if (seen.has(sourceEventId)) continue;
      seen.add(sourceEventId);
      events.push({
        source_event_id: sourceEventId,
        title,
        subtitle,
        description: null,
        date,
        time,
        detail_url: detailUrl ?? SPIELPLAN_URL,
        ticket_url: detailUrl ?? SPIELPLAN_URL,
        image_url: null,
        price_min: null,
        price_max: null,
        performers: null,
        venue_room: venueRoom,
        raw_category: label?.trim() || null,
        labels: resolveStageLabels({
          title,
          subtitle,
          // The inclusive ensemble's listing mixes Theaterstücke, szenische
          // Lesungen and Workshops; the "Theater" anchor guarantees a
          // stage label so the row survives the theater derive's filter.
          hint: "Theater inklusives Ensemble",
          defaultLabel: "stage:theater",
          confidence: 0.85,
          classifier: "scraper-hardcoded",
        }),
      });
    }
  }
}
