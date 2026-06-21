import { classifyMusic } from "@museumsufer/classify";
import { todayIso } from "@museumsufer/core/date";
import { decodeEntities, stripHtml } from "@museumsufer/core/html";
import type { CanonicalScrapedEvent, ScrapedLabel, VenueScrapeResult } from "../types";

/**
 * Hugenottenhalle — Neu-Isenburg's municipal cultural hall (just south of
 * Frankfurt, inside the Frankfurt bbox). Its SitePark CMS renders a
 * `SP-Teaser` per event with a category kicker, headline, `SP-Scheduling`
 * date/time, and a detail link. The main calendar mixes everything (markets,
 * WDC exhibitions, …); the concert and kabarett programmes live on category
 * subpages, so we fetch those alongside the main listing and classify by the
 * kicker, dropping non-performance categories (markets/fairs/exhibitions).
 *
 * (Neu-Isenburg's Glashaus and Treffpunkt run separate, non-machine-readable
 * sites — not covered here.)
 */
const BASE = "https://www.hugenottenhalle.de";
const PAGES = [
  "/programm/aktuelle_veranstaltungen/",
  "/programm/aktuelle_veranstaltungen/klassik-oper-operette-musicals",
  "/programm/aktuelle_veranstaltungen/comedy-kabarett",
  "/programm/aktuelle_veranstaltungen/kinderveranstaltungen",
];
const UA = "museumsufer event-hub crawler / contact: jonas@bgdlabs.com";

// One SP-Teaser: kicker (category) → detail link + headline → scheduling block.
const TEASER_RE =
  /SP-Kicker__text">([^<]*)<[\s\S]*?SP-Teaser__link"\s+href="([^"]+)"[\s\S]*?SP-Teaser__headline[^>]*>([^<]+)<[\s\S]*?(SP-Scheduling[\s\S]*?<\/time>)/g;
const DATE_RE = /SP-Scheduling__date">(\d{1,2})\.(\d{1,2})\.(\d{4})/;
const TIME_RE = /SP-Scheduling__time__hour">(\d{1,2})<[\s\S]*?data-minute="(\d{1,2})"/;

export async function scrapeHugenottenhalle(): Promise<VenueScrapeResult> {
  const today = todayIso();
  const events: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();

  for (const path of PAGES) {
    let html: string;
    try {
      const res = await fetch(`${BASE}${path}`, { headers: { "User-Agent": UA } });
      if (!res.ok) continue;
      html = await res.text();
    } catch {
      continue;
    }

    for (const m of html.matchAll(TEASER_RE)) {
      const kicker = decodeEntities(m[1]).trim();
      const href = m[2];
      const title = stripHtml(decodeEntities(m[3])).replace(/\s+/g, " ").trim();
      const sched = m[4];

      const labels = classify(kicker);
      if (!labels) continue; // markets / fairs / exhibitions / misc

      const dm = DATE_RE.exec(sched);
      if (!dm) continue;
      const date = `${dm[3]}-${dm[2].padStart(2, "0")}-${dm[1].padStart(2, "0")}`;
      if (date < today) continue;
      const tm = TIME_RE.exec(sched);
      const time = tm ? `${tm[1].padStart(2, "0")}:${tm[2].padStart(2, "0")}` : null;

      const url = href.startsWith("http") ? href : `${BASE}${href}`;
      const id = href.split("/").pop() || `${title}-${date}`;
      const key = `${id}|${date}`;
      if (seen.has(key)) continue; // same event listed on main + category page
      seen.add(key);

      events.push({
        source_event_id: key,
        title,
        description: null,
        date,
        time,
        detail_url: url,
        ticket_url: url,
        image_url: null,
        labels,
      });
    }
  }

  return { source_slug: "hugenottenhalle", display_name: "Hugenottenhalle", events };
}

/** Map the SitePark category kicker to a label, or null to drop the event.
 *  Driven by the kicker only — the title can be misleading (e.g. "Filmbörse" is
 *  a collectors' market, kicker "Märkte…", not a screening). */
function classify(kicker: string): ScrapedLabel[] | null {
  const k = kicker.toLowerCase();
  if (/kino|film/.test(k)) {
    return [{ label: "film:cinema", confidence: 0.85, classifier: "keyword:event" }];
  }
  if (/klassik|oper|operette|musical|konzert|chor|sinfonie/.test(k)) {
    const genre = classifyMusic(kicker, null, null, "classical");
    return [{ label: `music:${genre}`, confidence: 0.8, classifier: "keyword:music" }];
  }
  if (/comedy|kabarett|theater|schauspiel|bühne/.test(k)) {
    return [{ label: "stage:kabarett", confidence: 0.8, classifier: "keyword:event" }];
  }
  if (/tanz|ballett/.test(k)) {
    return [{ label: "dance:buehne", confidence: 0.8, classifier: "keyword:event" }];
  }
  if (/lesung|literatur/.test(k)) {
    return [{ label: "talk:lesung", confidence: 0.8, classifier: "keyword:talk" }];
  }
  // Markets, fairs, exhibitions, "Sonstiges", info & education, workshops: not a
  // performance for any vertical.
  return null;
}
