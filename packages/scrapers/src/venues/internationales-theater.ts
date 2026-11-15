import { classifyDance, classifyMusic } from "@museumsufer/classify";
import { decodeEntities, normalizeUrl, stripHtml, todayIso } from "@museumsufer/core";
import type { CanonicalScrapedEvent, ScrapedLabel, VenueScrapeResult } from "../types";
import { resolveStageLabels } from "./_stage-labels";

const BASE = "https://fit-frankfurt.de";
const SPIELPLAN_URL = `${BASE}/spielplan`;
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

/**
 * Internationales Theater Frankfurt left Joomla/VikEvents (`www.internationales-theater.de`
 * now 302s to `fit-frankfurt.de`) for a React site. `/spielplan?monat=YYYY-MM`
 * lists one month of performances as `<li class="fp-row">`; the month links in
 * the page nav say how far ahead the programme is published. The HTML carries
 * time, ticket status, price and image, but no genre — that only lives in the
 * month's iCal feed (`/spielplan/ical?monat=…`, `CATEGORIES`), joined on the
 * performance URL. The `termin` key (`YYYY-MM-DD-HHMM`, Berlin wall clock) is
 * the stable identity and date source; the `<time dateTime>` attribute is UTC.
 */

const MONTH_LINK_RE = /spielplan\?monat=(\d{4}-\d{2})/g;
const ROW_RE = /<li class="fp-row[^"]*"[\s\S]*?<\/li>/g;
const TITLE_RE = /<h3 class="fp-row__title"><a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/;
const TERMIN_RE = /\/veranstaltung\/([^?"]+)\?termin=(\d{4}-\d{2}-\d{2})-(\d{2})(\d{2})/;

export async function scrapeInternationalesTheater(): Promise<VenueScrapeResult> {
  const months = [...new Set([...(await fetchText(SPIELPLAN_URL)).matchAll(MONTH_LINK_RE)].map((m) => m[1]))].sort();
  if (months.length === 0) throw new Error("internationales-theater: no month links on /spielplan");

  const today = todayIso();
  const events: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();

  for (const month of months) {
    const [html, ical] = await Promise.all([
      fetchText(`${SPIELPLAN_URL}?monat=${month}`),
      fetchText(`${SPIELPLAN_URL}/ical?monat=${month}`),
    ]);
    const categories = icalCategories(ical);

    for (const row of html.match(ROW_RE) ?? []) {
      const title = row.match(TITLE_RE);
      const termin = title?.[1].match(TERMIN_RE);
      if (!title || !termin) continue;
      const [, slug, date, hh, mm] = termin;
      if (date < today) continue;

      const sourceEventId = `${date}-${hh}${mm}/${slug}`;
      if (seen.has(sourceEventId)) continue;
      seen.add(sourceEventId);

      const name = formatTitle(stripHtml(title[2]));
      if (!name) continue;
      const meta = stripHtml(row.match(/<p class="fp-row__meta">([\s\S]*?)<\/p>/)?.[1] ?? "") || null;
      const status = stripHtml(row.match(/<p class="fp-row__status">([\s\S]*?)<\/p>/)?.[1] ?? "");
      const price = Number(
        row
          .match(/<p class="fp-row__price">\s*ab\s*([\d.,]+)/)?.[1]
          ?.replace(/\./g, "")
          .replace(",", "."),
      );
      const image = row.match(/<img src="([^"]+)"/)?.[1];
      const category = categories.get(sourceEventId) ?? null;
      const detailUrl = `${BASE}/spielplan/${sourceEventId}`;

      events.push({
        source_event_id: sourceEventId,
        title: name,
        description: meta,
        date,
        time: `${hh}:${mm}`,
        detail_url: detailUrl,
        ticket_url: detailUrl,
        image_url: image ? normalizeUrl(decodeEntities(image), BASE) : null,
        price_min: Number.isFinite(price) && price > 0 ? price : null,
        raw_category: /abgesagt|entf[äa]llt/i.test(status) ? "cancelled" : category,
        availability: /ausverkauft/i.test(status) ? "sold_out" : null,
        labels: labelsFor(name, meta, category),
      });
    }
  }

  // Months are published, so zero rows means the markup changed — not an empty season.
  if (events.length === 0) throw new Error(`internationales-theater: no performances parsed from ${months.length} months`);

  events.sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? "") || a.title.localeCompare(b.title));
  return { source_slug: "internationales-theater", display_name: "Internationales Theater Frankfurt", events };
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" } });
  if (!res.ok) throw new Error(`internationales-theater fetch failed: ${res.status} ${url}`);
  return res.text();
}

/** `<termin>/<slug>` → the site's own genre tag (Konzert, Tanz, Theater, Flamenco, Kabarett, …). */
function icalCategories(ical: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const block of ical.replace(/\r?\n[ \t]/g, "").split("BEGIN:VEVENT").slice(1)) {
    const key = block.match(/^URL:.*\/spielplan\/(\d{4}-\d{2}-\d{2}-\d{4}\/[^\s]+)$/m)?.[1];
    const category = block.match(/^CATEGORIES:(.+)$/m)?.[1]?.trim();
    if (key && category) out.set(key, category);
  }
  return out;
}

/** The house's own genre tag is the primary signal; keyword probes only pick the sub-genre within it. */
function labelsFor(title: string, meta: string | null, category: string | null): ScrapedLabel[] {
  const label = (l: string): ScrapedLabel[] => [{ label: l, confidence: 0.9, classifier: "upstream-category" }];
  switch (category) {
    case "Theater":
      return label("stage:theater");
    case "Kabarett":
      return label("stage:kabarett");
    case "Stand-up-Comedy":
      return label("stage:comedy");
    case "Klassisches Konzert":
      return label(`music:${classifyMusic(title, meta, null, "classical")}`);
    case "Konzert":
      return label(`music:${classifyMusic(title, meta, null, "world")}`);
    case "Weltmusik":
      return label("music:world");
    case "Jazz & Rock":
      return label(`music:${classifyMusic(title, meta, null, "jazz")}`);
    case "Tanz":
      return label(`dance:${classifyDance(title, meta, null, "contemporary")}`);
    case "Flamenco":
    case "Salsa":
      return label(`dance:${classifyDance(title, meta, null, "world")}`);
    default:
      return resolveStageLabels({ title, subtitle: meta, hint: category, confidence: 0.85 });
  }
}

/** ITF writes some titles in screaming uppercase; title-case them. */
function formatTitle(t: string): string {
  if (!t || t !== t.toUpperCase()) return t;
  return t
    .toLowerCase()
    .split(" ")
    .map((w) => {
      if (/^(?:in|on|of|the|and|or|to|a|an|for|with|by|at|from|de|du|von|und|oder|aus|der|die|das)$/i.test(w)) return w;
      if (/^[ivxlcdm]+$/i.test(w)) return w.toUpperCase();
      if (/^#?\d+$/.test(w)) return w;
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(" ")
    .replace(/^./, (c) => c.toUpperCase());
}
