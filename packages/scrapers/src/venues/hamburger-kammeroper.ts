import { decodeEntities, slugify, stripHtml, todayIso } from "@museumsufer/core";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";
import { resolveStageLabels } from "./_stage-labels";

const TERMINE_URL = "https://alleetheater.de/kammeroper/termine/";
const WP_API = "https://alleetheater.de/wp-json/wp/v2/allee_dates";
const TICKET_BASE = "https://alleetheater.eventim-inhouse.de/webshop/webticket/shop?kassierer=web&event=";
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

/**
 * Hamburger Kammeroper is housed at Allee Theater. Their Spielplan/Termine page
 * at alleetheater.de/kammeroper/termine/ lists productions (operas) with
 * individual performance dates.
 *
 * We scrape in two steps:
 *  1. Fetch the termine HTML to identify production titles (from h2 links)
 *     and their eventim-inhouse event IDs.
 *  2. Query the Allee Theater WP REST API (allee_dates custom post type) where
 *     each post has a title like "IDOMENEO 12.06.2026" to get per-performance dates.
 */
export async function scrapeHamburgerKammeroper(): Promise<VenueScrapeResult> {
  const today = todayIso();
  const events: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();

  // Step 1: get production titles from the kammeroper termine HTML
  let html: string;
  try {
    const res = await fetch(TERMINE_URL, {
      headers: { "User-Agent": UA, Accept: "text/html", "Accept-Language": "de-DE,de;q=0.9" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    html = await res.text();
  } catch (err) {
    console.warn("Hamburger Kammeroper fetch error:", err);
    return { source_slug: "hamburger-kammeroper", display_name: "Hamburger Kammeroper", events: [] };
  }

  // Extract unique production titles from <h2>…<a href="?event=NNN">Title</a>…</h2>
  const productionTitles = new Set<string>();
  const titleEventMap = new Map<string, string>(); // title → first event ID
  for (const m of html.matchAll(/event=(\d+)[^>]*>\s*([^<]+?)\s*<\/a>/g)) {
    const title = decodeEntities(m[2]).trim();
    if (!title || title.length < 2) continue;
    productionTitles.add(title.toUpperCase());
    if (!titleEventMap.has(title.toUpperCase())) titleEventMap.set(title.toUpperCase(), m[1]);
  }

  if (productionTitles.size === 0) {
    console.warn("Hamburger Kammeroper: no productions found in HTML");
    return { source_slug: "hamburger-kammeroper", display_name: "Hamburger Kammeroper", events: [] };
  }

  // Step 2: query WP REST API for each production title
  // Post titles are like "IDOMENEO 12.06.2026" — we search by production name
  for (const prodTitle of productionTitles) {
    const shortTitle = prodTitle.split(" ")[0]; // e.g. "IDOMENEO" or "DON"
    const searchTerm = prodTitle.length <= 6 ? prodTitle : shortTitle;
    let page = 1;
    while (page <= 5) {
      let posts: Array<{ id: number; title: { rendered: string }; slug: string }>;
      try {
        const url = `${WP_API}?per_page=100&page=${page}&_fields=id,title,slug&search=${encodeURIComponent(searchTerm)}`;
        const r = await fetch(url, { headers: { "User-Agent": UA } });
        if (!r.ok) break;
        posts = (await r.json()) as typeof posts;
        if (!posts.length) break;
      } catch {
        break;
      }

      for (const post of posts) {
        const postTitle = cleanText(post.title.rendered);
        // Only accept posts whose title starts with this production title
        if (!postTitle.toUpperCase().startsWith(prodTitle)) continue;
        // Filter out dining/accessory entries ("Speisen", "Opernmenü")
        if (/^(speisen|opernmen)/i.test(postTitle)) continue;

        // Parse date from end of title e.g. "IDOMENEO 21.06.2026"
        const dateMatch = postTitle.match(/(\d{2})\.(\d{2})\.(\d{4})$/);
        if (!dateMatch) continue;
        const date = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`;
        if (date < today) continue;

        // Extract production title without date
        const cleanProd = postTitle.replace(/\s+\d{2}\.\d{2}\.\d{4}$/, "").trim();
        const ticketEventId = titleEventMap.get(prodTitle) ?? "";
        const ticketUrl = ticketEventId ? `${TICKET_BASE}${ticketEventId}` : TERMINE_URL;

        // Default time for opera: 19:30 (this info is not in the API response)
        const time = "19:30";

        const uid = `${slugify(cleanProd)}|${date}|${time}`;
        if (seen.has(uid)) continue;
        seen.add(uid);

        events.push({
          source_event_id: uid,
          title: toTitleCase(cleanProd),
          subtitle: null,
          description: null,
          date,
          time,
          detail_url: TERMINE_URL,
          ticket_url: ticketUrl,
          image_url: null,
          price_min: null,
          price_max: null,
          performers: null,
          venue_room: "Hamburger Kammeroper",
          raw_category: null,
          labels: resolveStageLabels({
            title: cleanProd,
            subtitle: null,
            defaultLabel: "stage:opera",
            confidence: 0.85,
          }),
        });
      }

      const totalPages = Number(
        (await Promise.resolve(null as unknown as Response))?.headers.get("X-WP-TotalPages") ?? 1,
      );
      if (posts.length < 100 || page >= totalPages) break;
      page++;
    }
  }

  events.sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? ""));
  return { source_slug: "hamburger-kammeroper", display_name: "Hamburger Kammeroper", events };
}

function toTitleCase(s: string): string {
  return s.toLowerCase().replace(/(?:^|\s|-)\S/g, (c) => c.toUpperCase());
}

function cleanText(raw: string): string {
  return stripHtml(decodeEntities(raw)).replace(/\s+/g, " ").trim();
}
