import { todayIso } from "@museumsufer/core/date";
import { decodeEntities, stripHtml } from "@museumsufer/core/html";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";

/**
 * Botschaft der Wildtiere (HafenCity, Hamburg) — the Deutsche Wildtier
 * Stiftung's exhibition house, which also runs "Deutschlands einziges
 * Naturfilmkino": a weekly Naturfilm-Mittwoch showing the 50 finalists of the
 * European Wildlife Film Awards.
 *
 * The /kino page (Kirby CMS, server-rendered) lists the upcoming screenings as
 * cards. Each card carries a film heading, a CDN image under
 * `/media/pages/movies/<slug>/…` (the slug is also the `/movies/<slug>` detail
 * page), and a "Vorstellung am" block with the date+time ("Mi. 24.6., 18:30
 * Uhr") — no year, so it's inferred against today.
 */
const KINO_URL = "https://www.botschaftderwildtiere.de/kino";
const SITE_BASE = "https://www.botschaftderwildtiere.de";
const UA = "museumsufer event-hub crawler / contact: jonas@bgdlabs.com";

// Anchor on the "Vorstellung am" label so we only match real screening cards
// (the bare `opacity-80` body class is reused elsewhere on the page).
const SHOW_RE =
  /Vorstellung am<\/div>[\s\S]{0,160}?opacity-80">\s*\w{2,3}\.\s*(\d{1,2})\.(\d{1,2})\.,\s*(\d{1,2}):(\d{2})\s*Uhr/g;
const HEADING_RE = /<div class="font-h[23][^"]*">([\s\S]*?)<\/div>/g;
const MEDIA_RE = /(https:\/\/www\.botschaftderwildtiere\.de\/media\/pages\/movies\/([^/"]+)\/[^"]+\.jpg)/g;

export async function scrapeBotschaftDerWildtiere(): Promise<VenueScrapeResult> {
  const today = todayIso();
  const res = await fetch(KINO_URL, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`botschaft-der-wildtiere fetch failed: ${res.status}`);
  const html = await res.text();

  const events: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();
  let prev = 0;

  for (const m of html.matchAll(SHOW_RE)) {
    const start = m.index ?? 0;
    const window = html.slice(prev, start);
    prev = start;

    // Only the Naturfilmkino finalist films link to the European Wildlife
    // Film Awards competition (the title links to the award page). This gate
    // drops the venue's occasional non-film events (concerts, family
    // theatre), whose differently-laid-out cards would otherwise mis-pair.
    if (!/europeanwildlifefilmawards\.eu\/de\/wettbewerb/.test(window)) continue;

    const date = inferDate(m[1], m[2], today);
    const time = `${m[3].padStart(2, "0")}:${m[4]}`;
    if (!date || date < today) continue;

    // Title = last heading before the date block; slug/image = last movie
    // asset before it (cards render heading → image → "Vorstellung am").
    const headings = [...window.matchAll(HEADING_RE)];
    const media = [...window.matchAll(MEDIA_RE)];
    const slug = media.length ? media[media.length - 1][2] : null;
    const image = media.length ? media[media.length - 1][1] : null;
    const rawTitle = headings.length ? headings[headings.length - 1][1] : "";
    const title = stripHtml(decodeEntities(rawTitle)).replace(/\s+/g, " ").trim();
    if (!title) continue;

    const key = `${slug ?? title}|${date}|${time}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const detailUrl = slug ? `${SITE_BASE}/movies/${slug}` : KINO_URL;
    events.push({
      source_event_id: key,
      title,
      description: null,
      date,
      time,
      detail_url: detailUrl,
      ticket_url: detailUrl,
      image_url: image,
      labels: [{ label: "film:cinema", confidence: 0.9, classifier: "scraper-hardcoded" }],
    });
  }

  return { source_slug: "botschaft-der-wildtiere", display_name: "Botschaft der Wildtiere", events };
}

/** "24", "6" (no year) → ISO date, inferring the year against `today`.
 *  A month more than 6 behind today's wraps to next year (Dec→Jan rollover). */
function inferDate(dRaw: string, mRaw: string, today: string): string | null {
  const dd = dRaw.padStart(2, "0");
  const mm = mRaw.padStart(2, "0");
  const curYear = parseInt(today.slice(0, 4), 10);
  const monthsBehind = Number(today.slice(5, 7)) - Number(mm);
  const year = monthsBehind > 6 ? curYear + 1 : curYear;
  return `${year}-${mm}-${dd}`;
}
