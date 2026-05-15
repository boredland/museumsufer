import { todayIso } from "@museumsufer/core/date";
import { stripHtml } from "@museumsufer/core/html";
import type { Category, ScrapedEvent } from "../types";

/**
 * Friedrich-Ebert-Stiftung Landesbüro Hessen. SPD-aligned political-education
 * foundation. The Hessen office filters /landesbuero-hessen/veranstaltungen
 * to its regional events. Server-rendered TYPO3 cards:
 *
 *   <div class="digbib-event-item">
 *     <div class="subheader">Donnerstag, 01.01.26 – online</div>
 *     <h3>Title</h3>
 *     <p>Description excerpt …</p>
 *     <a href=".../veranstaltungsdetail/NNNNNN">Details</a>
 *
 * Date format: "Wochentag, DD.MM.YY – Location". No time on listing cards;
 * we'd need a per-event fetch to get it. Skipped — too many events for that
 * round-trip cost, and most card display the time inline in the title
 * anyway. Online-only Selbstlernkurse are filtered out as not local talks.
 */

const LISTING_URL = "https://www.fes.de/landesbuero-hessen/veranstaltungen";
const UA = "lehrhaus crawler / contact: jonas@bgdlabs.com";
const HEADERS = { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" };

const ITEM_RE = /<div class="row row--no-margin digbib-event-item[^"]*"[^>]*>([\s\S]+?)<hr\s*\/?>/g;
const SUBHEADER_RE = /<div class="subheader">\s*([\s\S]*?)\s*<\/div>/;
const TITLE_RE = /<h3[^>]*>\s*([\s\S]*?)\s*<\/h3>/;
const DESC_RE = /<p[^>]*>\s*([\s\S]*?)\s*<\/p>/;
const DETAIL_RE = /<a[^>]+href="(https?:\/\/www\.fes\.de\/veranstaltungen\/veranstaltungsdetail\/\d+)"[^>]*>\s*Details/;
const DATE_RE = /(\d{2})\.(\d{2})\.(\d{2})/;

export async function scrapeFesHessen(): Promise<ScrapedEvent[]> {
  const html = await fetchHtml(LISTING_URL);
  const today = todayIso();
  const events: ScrapedEvent[] = [];
  const seen = new Set<string>();

  for (const m of html.matchAll(ITEM_RE)) {
    const card = m[1];

    const subheader = cleanText(card.match(SUBHEADER_RE)?.[1] ?? "");
    const dateMatch = subheader.match(DATE_RE);
    if (!dateMatch) continue;
    const [, dd, mm, yy] = dateMatch;
    const date = `20${yy}-${mm}-${dd}`;
    if (date < today) continue;

    // Location is everything after the "– " separator in the subheader.
    const locMatch = subheader.match(/–\s*(.+)$/);
    const location = locMatch ? locMatch[1].trim() : "";
    // Skip purely-online self-paced learning courses — not the public-lecture
    // format lehr.salon is curating. (FES uses "online" for both webinars
    // *and* asynchronous self-study; the listing doesn't disambiguate, so we
    // err on the side of dropping them.)
    if (/^online$/i.test(location)) continue;
    // FES Hessen's calendar covers the whole state (Wiesbaden, Groß-Gerau,
    // Darmstadt, Fulda, …); lehr.salon is Frankfurt-only. Filter to entries
    // that name Frankfurt in the location.
    if (!/frankfurt/i.test(location)) continue;

    const detail = card.match(DETAIL_RE);
    if (!detail) continue;
    const detailUrl = detail[1];
    if (seen.has(detailUrl)) continue;
    seen.add(detailUrl);

    const title = cleanText(card.match(TITLE_RE)?.[1] ?? "");
    if (!title) continue;
    // Self-paced KommunalAkademie courses aren't single-day lectures.
    if (/KommunalAkademie\s+digital\s+Kurs/i.test(title)) continue;

    const description =
      cleanText(card.match(DESC_RE)?.[1] ?? "")
        .replace(/[…...]+\s*$/, "")
        .slice(0, 500) || null;

    events.push({
      title,
      date,
      time: null,
      detail_url: detailUrl,
      description: location ? (description ? `${location} — ${description}` : location) : description,
      category: classify(title, description),
      language: null,
    });
  }

  return events;
}

function classify(title: string, description: string | null): Category {
  const h = `${title} ${description ?? ""}`.toLowerCase();
  if (/diskussion|podium|debatte|streitgespräch|gespräch|dialog/.test(h)) return "Diskussion";
  if (/lesung|buchpräsentation|buchvorstellung/.test(h)) return "Lesung";
  return "Vortrag";
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`fes-hessen fetch failed: ${res.status}`);
  return res.text();
}

function cleanText(s: string): string {
  return stripHtml(s).replace(/\s+/g, " ").trim();
}
