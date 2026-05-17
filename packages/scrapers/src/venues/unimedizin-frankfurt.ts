import { todayIso } from "@museumsufer/core/date";
import { decodeEntities, stripHtml } from "@museumsufer/core/html";
import { type ProxyConfig, proxyFetch } from "../proxy";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";

/**
 * Universitätsklinikum Frankfurt (KGU / Goethe-Uni medical campus) — TYPO3
 * sf_event_mgt listing. Direct fetches work for now, but the front page is
 * Cloudflare-gated for datacenter IPs, so we route through FETCH_PROXY when
 * configured — mirrors the stadtbuecherei pattern.
 *
 * Each event card is an <a class="holder" href="/detail/veranstaltung/SLUG">
 * with the date+time in a "gradient red color" tag and the title in a
 * "<div class='box'><div class='title'>...</div>". Programme includes
 * patient lectures (Krebs-Informationsabende, Symposien, Tag der offenen
 * Tür) plus internal/clinical events; we keep them all as talk:vortrag
 * since the page doesn't expose a separate audience flag.
 */
const BASE = "https://www.unimedizin-ffm.de";
const LIST_URL = `${BASE}/ueber-uns/veranstaltungen`;
const UA = "museumsufer event-hub crawler / contact: jonas@bgdlabs.com";

const CARD_RE = /<a\s+class="holder"\s+href="(\/detail\/veranstaltung\/[^"]+)"[^>]*>([\s\S]*?)<\/a>(?=\s*<\/div>)/g;
const DATE_RE = /(\d{2})\.(\d{2})\.(\d{4})\s*-\s*(\d{1,2}):(\d{2})/;
const TITLE_RE = /<div\s+class="box">[\s\S]*?<div\s+class="title">\s*([\s\S]*?)\s*<\/div>/;
const IMAGE_RE = /<img[^>]+src="([^"]+)"/;

export async function scrapeUnimedizinFrankfurt(proxy: ProxyConfig | null): Promise<VenueScrapeResult> {
  const res = await proxyFetch(LIST_URL, proxy, {
    headers: { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" },
  });
  if (!res.ok) throw new Error(`unimedizin-frankfurt fetch failed: ${res.status}`);
  const html = await res.text();

  const today = todayIso();
  const events: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();

  for (const m of html.matchAll(CARD_RE)) {
    const href = m[1];
    const block = m[2];

    const dateMatch = block.match(DATE_RE);
    if (!dateMatch) continue;
    const date = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`;
    if (date < today) continue;
    const time = `${dateMatch[4].padStart(2, "0")}:${dateMatch[5]}`;

    const title = stripHtml(decodeEntities(block.match(TITLE_RE)?.[1] ?? "")).trim();
    if (!title) continue;

    const slug = href.split("/").filter(Boolean).pop() ?? title;
    if (seen.has(slug)) continue;
    seen.add(slug);

    const imageHref = block.match(IMAGE_RE)?.[1];
    const imageUrl = imageHref ? (imageHref.startsWith("http") ? imageHref : `${BASE}${imageHref}`) : null;

    events.push({
      source_event_id: slug,
      title,
      description: null,
      date,
      time,
      end_date: null,
      end_time: null,
      detail_url: `${BASE}${href}`,
      ticket_url: null,
      image_url: imageUrl,
      raw_category: null,
      labels: [{ label: "talk:vortrag", confidence: 0.7, classifier: "scraper-hardcoded" }],
    });
  }

  return { source_slug: "unimedizin-frankfurt", display_name: "Universitätsklinikum Frankfurt", events };
}
