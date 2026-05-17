import { classifyMusic } from "@museumsufer/classify";
import {
  dateOffset,
  decodeEntities,
  normalizeUrl,
  nullIfMidnight,
  stripHtml,
  todayIso,
  truncate,
} from "@museumsufer/core";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";

const BASE = "https://www.hfmdk-frankfurt.de";
const GRAPHQL_ENDPOINT = "https://hfmdk-cs.e-fork.net/graphql";
const UA = "museumsufer event-hub crawler / contact: jonas@bgdlabs.com";
const THROTTLE_MS = 200;
const PAGE_SIZE = 50;
const MAX_PAGES = 10;

/**
 * HfMDK runs Drupal 10 + headless React (Apollo). The public events page calls
 * a Drupal GraphQL endpoint at https://hfmdk-cs.e-fork.net/graphql. We page
 * through `entityQuery` against the `NodeVeranstaltung` content type, sorted
 * by `field_datum` ascending, and stop once results pass the 120-day horizon.
 *
 * `fieldDatum` is an ISO local datetime ("YYYY-MM-DDTHH:MM:SS") in Europe/Berlin —
 * no timezone suffix — matching our wire format directly.
 */

interface HfmdkEvent {
  nid: number;
  title: string;
  fieldDatum: { value: string; endValue: string | null } | null;
  fieldEintrittFrei: boolean | null;
  fieldEntfaellt: boolean | null;
  fieldText: string | null;
  path: { alias: string | null } | null;
  fieldKartenreservierung: { uri: { path: string } | null } | null;
  fieldTicketlink: { uri: { path: string } | null } | null;
  fieldOrt: { name: string | null } | null;
  fieldReihe: { name: string | null; label: string | null } | null;
  fieldBild: {
    fieldMediaImage: {
      style: { urlPath: string | null } | null;
    } | null;
  } | null;
}

interface GraphQLResponse {
  data?: { entityQuery?: { total: number; items: HfmdkEvent[] } };
  errors?: Array<{ message: string }>;
}

const EVENTS_QUERY = `
query EventHubHfmdkEvents($from: String!, $offset: Int!, $limit: Int!) {
  entityQuery(
    entityType: NODE
    filter: {
      conditions: [
        { field: "type", value: ["veranstaltung"], operator: IN }
        { field: "status", value: ["1"], operator: IN }
        { field: "field_im_kalender_ausblenden", value: ["0"] }
      ]
      groups: [
        { conjunction: OR, conditions: [
          { field: "field_datum", value: [$from], operator: GREATER_THAN }
        ] }
      ]
    }
    offset: $offset
    limit: $limit
    sort: [{ field: "field_datum", direction: ASC }]
  ) {
    items {
      ... on NodeVeranstaltung {
        nid
        title
        fieldDatum { value endValue }
        fieldEintrittFrei
        fieldEntfaellt
        fieldText
        path { alias }
        fieldKartenreservierung { uri { path } }
        fieldTicketlink { uri { path } }
        fieldOrt { ... on TaxonomyTermOrte { name } }
        fieldReihe { ... on TaxonomyTermReihen { name label } }
        fieldBild {
          ... on MediaBild {
            fieldMediaImage {
              style: derivative(style: STANDARD) { urlPath }
            }
          }
        }
      }
    }
  }
}`.trim();

export async function scrapeHfmdk(): Promise<VenueScrapeResult> {
  const today = todayIso();
  const horizon = dateOffset(120);
  const events: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();

  for (let page = 0; page < MAX_PAGES; page++) {
    const items = await fetchPage(today, page * PAGE_SIZE, PAGE_SIZE);
    if (items.length === 0) break;

    let pastHorizon = false;
    for (const raw of items) {
      const datum = raw.fieldDatum?.value;
      if (!datum) continue;
      const date = datum.slice(0, 10);
      if (date < today) continue;
      if (date > horizon) {
        pastHorizon = true;
        continue;
      }
      if (raw.fieldEntfaellt) continue;

      const event = transform(raw, date, datum);
      if (!event) continue;
      const dedup = `${event.source_event_id}|${event.date}|${event.time ?? ""}`;
      if (seen.has(dedup)) continue;
      seen.add(dedup);
      events.push(event);
    }

    if (pastHorizon || items.length < PAGE_SIZE) break;
    await sleep(THROTTLE_MS);
  }

  return { source_slug: "hfmdk", display_name: "Hochschule für Musik und Darstellende Kunst Frankfurt", events };
}

async function fetchPage(from: string, offset: number, limit: number): Promise<HfmdkEvent[]> {
  const res = await fetch(GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": UA,
      "Accept-Language": "de-DE,de;q=0.9",
    },
    body: JSON.stringify({
      operationName: "EventHubHfmdkEvents",
      variables: { from, offset, limit },
      query: EVENTS_QUERY,
    }),
  });
  if (!res.ok) throw new Error(`hfmdk graphql failed: ${res.status}`);
  const json = (await res.json()) as GraphQLResponse;
  if (json.errors?.length) {
    throw new Error(`hfmdk graphql errors: ${json.errors.map((e) => e.message).join("; ")}`);
  }
  return json.data?.entityQuery?.items ?? [];
}

function transform(raw: HfmdkEvent, date: string, datum: string): CanonicalScrapedEvent | null {
  const title = stripHtml(decodeEntities(raw.title)).trim();
  if (!title) return null;

  const time = nullIfMidnight(datum.slice(11, 16));
  const endTime = nullIfMidnight(raw.fieldDatum?.endValue?.slice(11, 16));

  const alias = raw.path?.alias ?? null;
  const slug = alias ? alias.replace(/^\/+/, "").replace(/^veranstaltung\//, "") : `hfmdk-${raw.nid}`;
  const detailUrl = normalizeUrl(alias, BASE);

  const venueRoom = splitVenueRoom(raw.fieldOrt?.name?.trim() ?? null);

  const { subtitle, performers, description } = extractContent(raw.fieldText, title);

  const ticketUrl = raw.fieldTicketlink?.uri?.path ?? raw.fieldKartenreservierung?.uri?.path ?? null;
  const imageUrl = normalizeUrl(raw.fieldBild?.fieldMediaImage?.style?.urlPath, BASE);

  const priceMin = raw.fieldEintrittFrei ? 0 : null;
  const reihe = raw.fieldReihe?.label?.trim() || raw.fieldReihe?.name?.trim() || null;
  const finalSubtitle = subtitle || reihe;
  const genre = classifyMusic(title, finalSubtitle, description, "classical");

  return {
    source_event_id: slug,
    title,
    subtitle: finalSubtitle,
    description,
    date,
    time,
    end_time: endTime && endTime !== time ? endTime : null,
    detail_url: detailUrl,
    ticket_url: ticketUrl,
    image_url: imageUrl,
    price_min: priceMin,
    price_max: priceMin,
    performers,
    venue_room: venueRoom,
    labels: [{ label: `music:${genre}`, confidence: 0.9, classifier: "scraper-hardcoded" }],
  };
}

/**
 * "HfMDK, Großer Saal" → "Großer Saal". External venues ("Palmengarten",
 * "Mousonturm", …) keep their full name so the room field tells users where
 * to go when the concert isn't on campus.
 */
function splitVenueRoom(ort: string | null): string | null {
  if (!ort) return null;
  const match = ort.match(/^HfMD[Kk]\s*,?\s*(.+)$/);
  if (match) {
    const room = match[1].trim();
    return room || null;
  }
  return ort;
}

/**
 * Most rich-text bodies follow `<p>composer/programme</p>` then
 * `<p>Studierende der Klasse Prof. …</p>`. We surface the first short
 * paragraph as subtitle, a performer-shaped line as performers, and the
 * remainder as description.
 */
function extractContent(
  fieldText: string | null,
  title: string,
): { subtitle: string | null; performers: string | null; description: string | null } {
  if (!fieldText) return { subtitle: null, performers: null, description: null };
  const paragraphs = [...fieldText.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((m) => stripHtml(decodeEntities(m[1])).trim())
    .filter(Boolean);
  if (paragraphs.length === 0) return { subtitle: null, performers: null, description: null };

  let subtitle: string | null = null;
  let performers: string | null = null;
  const descParts: string[] = [];

  for (const para of paragraphs) {
    if (!subtitle && para.length <= 160 && para.toLowerCase() !== title.toLowerCase()) {
      subtitle = para;
      continue;
    }
    if (!performers && looksLikePerformers(para)) {
      performers = para;
      continue;
    }
    descParts.push(para);
  }

  if (subtitle && !performers && looksLikePerformers(subtitle)) {
    performers = subtitle;
    subtitle = null;
  }

  const description = descParts.join(" ").trim();
  return {
    subtitle,
    performers,
    description: description ? truncate(description, 800) : null,
  };
}

function looksLikePerformers(text: string): boolean {
  if (text.length > 240) return false;
  return /\bstudierende\b|\bklasse\b|\bprof\.?\b|\bdirig|\bensemble\b|\borchester\b|\bchor\b/i.test(text);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
