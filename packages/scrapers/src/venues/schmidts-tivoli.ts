import { decodeEntities, stripHtml, todayIso } from "@museumsufer/core";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";
import { resolveStageLabels } from "./_stage-labels";

/**
 * Schmidt Theater, Schmidts Tivoli & Schmidtchen — the three Reeperbahn houses
 * of Schmidts Tivoli GmbH (Spielbudenplatz), modern Volkstheater, musicals and
 * comedy. One TYPO3 site; the spielplan loads dated performances over an AJAX
 * route (`loadSpielplanList`) returning ~a fortnight per call, so we page
 * forward by the last date seen. The individual house is kept as `venue_room`.
 */
const BASE = "https://www.tivoli.de";
const AJAX = `${BASE}/programm-tickets/spielplan/ajax.call?nameSpace=tx_auwtivoli_ajaxtivoli&route=loadSpielplanList&requestParameter%5Bdate%5D=`;
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const MAX_PAGES = 10;

// Day dividers carry `dd.mm.`; perf blocks carry the id + time/title/house.
const TOKEN =
  /<span class="time">(\d{2})\.(\d{2})\.<\/span>|<div class="perf" id="p(\d+)">([\s\S]*?<div class="perf-lower">[\s\S]*?<\/div>)/g;

export async function scrapeSchmidtsTivoli(): Promise<VenueScrapeResult> {
  const today = todayIso();
  const events: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();

  let ts = Math.floor(Date.now() / 1000);
  let year = Number(today.slice(0, 4));
  let prevMonth = 0;

  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await fetch(`${AJAX}${ts}`, {
      headers: { "User-Agent": UA, "X-Requested-With": "XMLHttpRequest", "Accept-Language": "de-DE,de;q=0.9" },
    });
    if (!res.ok) break;
    const html = await res.text();

    let curDate: string | null = null;
    let maxDate: string | null = null;
    let added = 0;

    for (const m of html.matchAll(TOKEN)) {
      if (m[1]) {
        const month = Number(m[2]);
        if (prevMonth && month < prevMonth) year++;
        prevMonth = month;
        curDate = `${year}-${m[2]}-${m[1]}`;
        continue;
      }
      const id = `p${m[3]}`;
      if (!curDate || seen.has(id)) continue;
      seen.add(id);

      const inner = m[4];
      const link = inner.match(/<div class="perf-upper">\s*<a href="([^"]+)">([\s\S]*?)<\/a>/);
      if (!link) continue;
      const title = stripHtml(decodeEntities(link[2])).replace(/\s+/g, " ").trim();
      if (!title) continue;

      const lower = inner.match(/<div class="perf-lower"><span>([^<]*)<\/span>([^<]*)/);
      const house = lower ? decodeEntities(lower[1]).trim() : null;
      const priceM = lower?.[2].match(/€\s*(\d+)(?:[.,](\d{2}))?/);
      const timeM = inner.match(/<div class="time">(\d{1,2}:\d{2})</);

      if (curDate >= today) {
        events.push({
          source_event_id: id,
          title,
          subtitle: house,
          description: null,
          date: curDate,
          time: timeM ? timeM[1] : null,
          detail_url: link[1],
          ticket_url: link[1],
          image_url: null,
          price_min: priceM ? Number(priceM[1]) + (priceM[2] ? Number(priceM[2]) / 100 : 0) : null,
          price_max: null,
          performers: null,
          venue_room: house,
          raw_category: /sold ?out|ausverkauft/i.test(inner) ? "sold_out" : null,
          labels: resolveStageLabels({
            title,
            hint: house,
            defaultLabel: "stage:theater",
            confidence: 0.85,
            classifier: "scraper-hardcoded",
          }),
        });
        added++;
      }
      if (!maxDate || curDate > maxDate) maxDate = curDate;
    }

    if (!maxDate || added === 0) break;
    ts = Math.floor(new Date(`${maxDate}T00:00:00Z`).getTime() / 1000) + 86_400;
  }

  return { source_slug: "schmidts-tivoli", display_name: "Schmidt Theater & Schmidts Tivoli", events };
}
