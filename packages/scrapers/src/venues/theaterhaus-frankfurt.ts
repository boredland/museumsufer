import { decodeEntities, normalizeUrl, nullIfMidnight, slugify, stripHtml, todayIso } from "@museumsufer/core";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";
import { resolveStageLabels } from "./_stage-labels";

const BASE = "https://www.theaterhaus-frankfurt.de";
const SPIELPLAN_URL = `${BASE}/spielplan/`;
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

/**
 * Theaterhaus Frankfurt (TYPO3 + calendarize) renders /spielplan/ as a
 * grid of `<div id="index-<id>">` blocks per performance. Theaterhaus
 * hosts ensembles (TheaterGrueneSosse, Figurentheater Eigentlich, …) —
 * the group name lives in `<h4 class="headline-theatergruppen">` and
 * stays as subtitle. Sold-out / cancelled / few-left statuses are
 * carried via `raw_category` since the canonical event shape has no
 * dedicated status field.
 */

const ITEM_RE =
  /<div\s+id="index-\d+"\s+class="row[^"]*"[^>]*>([\s\S]*?)(?=<div\s+id="index-\d+"|<\/main\b|<footer\b)/g;

export async function scrapeTheaterhausFrankfurt(): Promise<VenueScrapeResult> {
  const res = await fetch(SPIELPLAN_URL, {
    headers: { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" },
  });
  if (!res.ok) throw new Error(`theaterhaus-frankfurt fetch failed: ${res.status}`);
  return parse(await res.text());
}

function parse(html: string): VenueScrapeResult {
  const today = todayIso();
  const events: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();

  for (const m of html.matchAll(ITEM_RE)) {
    const block = m[1];
    const datePlain = stripHtml(block.match(/<div\s+class="[^"]*\bdate_time\b[^"]*">([\s\S]*?)<\/div>/i)?.[1] ?? "");
    const dateMatch = datePlain.match(/(\d{1,2})\.(\d{1,2})\.(\d{4}),\s*(\d{1,2}):(\d{2})/);
    if (!dateMatch) continue;
    const date = `${dateMatch[3]}-${dateMatch[2].padStart(2, "0")}-${dateMatch[1].padStart(2, "0")}`;
    if (date < today) continue;
    const time = nullIfMidnight(`${dateMatch[4].padStart(2, "0")}:${dateMatch[5]}`);

    const titleAnchor = block.match(
      /<h3[^>]*class="title[^"]*"[^>]*>\s*<a\s+title="([^"]+)"\s+href="([^"]+)"[^>]*>\s*([\s\S]*?)\s*<\/a>/i,
    );
    if (!titleAnchor) continue;
    const title = stripHtml(titleAnchor[3]) || decodeEntities(titleAnchor[1]);
    const detailHref = decodeEntities(titleAnchor[2]);
    if (!title) continue;

    const groupName =
      stripHtml(
        block.match(/<h4[^>]*class="headline-theatergruppen[^"]*"[^>]*>\s*<a[^>]*>([\s\S]*?)<\/a>/i)?.[1] ?? "",
      ) || null;

    const venueRoom =
      stripHtml(block.match(/<a\s+class="news-list-category[^"]*"[^>]*>([\s\S]*?)<\/a>/i)?.[1] ?? "") || null;

    const ageBadge =
      stripHtml(block.match(/<a\s+class="badge[^"]*\baltersgruppen[^"]*"[^>]*>([\s\S]*?)<\/a>/i)?.[1] ?? "") || null;

    const imgSrc = block.match(/<img[^>]+src="((?:https?:\/\/[^"]+)?\/fileadmin\/[^"]+)"/i)?.[1];

    const statusText = stripHtml(block.match(/<div\s+class="status">\s*([\s\S]*?)\s*<\/div>/i)?.[1] ?? "");
    const status = mapStatus(statusText);

    const slug = `${slugify(groupName ?? "")}-${slugify(title)}`.replace(/^-+|-+$/g, "") || slugify(title);
    const dedup = `${slug}|${date}|${time ?? ""}|${venueRoom ?? ""}`;
    if (seen.has(dedup)) continue;
    seen.add(dedup);

    events.push({
      source_event_id: dedup,
      title,
      subtitle: groupName,
      description: groupName ? `${groupName}${ageBadge ? ` · ${ageBadge}` : ""}` : ageBadge,
      date,
      time,
      detail_url: normalizeUrl(detailHref, BASE),
      ticket_url: normalizeUrl(detailHref, BASE),
      image_url: imgSrc ? normalizeUrl(imgSrc, BASE) : null,
      venue_room: venueRoom,
      raw_category: status ?? null,
      labels: resolveStageLabels({ title, subtitle: groupName, hint: ageBadge, confidence: 0.85 }),
    });
  }

  return { source_slug: "theaterhaus-frankfurt", events };
}

function mapStatus(text: string): string | null {
  const t = text.trim().toLowerCase();
  if (!t) return null;
  if (t.includes("ausverkauft")) return "sold_out";
  if (t.includes("entfäll") || t.includes("abgesagt")) return "cancelled";
  if (t.includes("restkarten") || t.includes("wenige")) return "few_left";
  return null;
}
