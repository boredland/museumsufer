import { todayIso } from "@museumsufer/core/date";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";

/**
 * Meetup.com — curated list of Frankfurt-area groups that predominantly
 * host talks (vs networking, lean coffee, social mixers).
 *
 * Each group's `/events/` page is a Next.js SPA but the upcoming events
 * land in the embedded __NEXT_DATA__'s __APOLLO_STATE__ Event entries —
 * full schema including dateTime+timezone, eventType, venue, going RSVPs.
 * We parse that, filter to PHYSICAL events whose venue is in or near
 * Frankfurt, and drop events whose title matches a social-shape pattern.
 *
 * Per-group filtering is the easiest signal: a curated list with
 * `kind: 'talk'` means we trust the group to do talks unless title says
 * otherwise. `kind: 'mixed'` means we only emit events with explicit
 * talk-shape keywords in the title.
 */

interface MeetupGroup {
  /** Meetup URL slug (e.g. "claude-meetup-frankfurt"). */
  slug: string;
  /** Display name surfaced to apps. */
  displayName: string;
  /** "talk" — emit all physical events; "mixed" — only emit events
   *  whose title matches a talk-shape pattern. */
  kind: "talk" | "mixed";
}

const GROUPS: MeetupGroup[] = [
  { slug: "claude-meetup-frankfurt", displayName: "Claude Meetup Frankfurt", kind: "talk" },
  { slug: "cloud-native-frankfurt", displayName: "Cloud Native Frankfurt", kind: "talk" },
  { slug: "tech-evenings-frankfurt", displayName: "Tech Evenings Frankfurt", kind: "talk" },
  { slug: "technology-night-rhein-main", displayName: "Technology Night Rhein-Main", kind: "talk" },
  { slug: "analytics-pioneers-frankfurt", displayName: "Analytics Pioneers Frankfurt", kind: "talk" },
  { slug: "artificial-intelligence-meetup-frankfurt", displayName: "AI Meetup Frankfurt", kind: "talk" },
  { slug: "canonical-day-frankfurt", displayName: "Canonical Day Frankfurt", kind: "talk" },
  { slug: "correlaid-rhein-main", displayName: "CorrelAid Rhein-Main", kind: "talk" },
  { slug: "gamedevtreff-rhein-main", displayName: "Gamedev-Treff Rhein-Main", kind: "talk" },
  { slug: "gdgrheinmain", displayName: "GDG Rhein-Main", kind: "talk" },
  { slug: "green-software-development-frankfurt", displayName: "Green Software Development Frankfurt", kind: "talk" },
  { slug: "ibm-developers", displayName: "IBM Developers", kind: "mixed" },
  {
    slug: "isaqb-software-architektur-meetup-gruppe-fur-interessierte",
    displayName: "iSAQB Software-Architektur Meetup",
    kind: "talk",
  },
  { slug: "kong-frankfurt-meetup", displayName: "Kong Frankfurt Meetup", kind: "talk" },
  { slug: "pass-usergroup-rhein-main", displayName: "PASS UserGroup Rhein-Main", kind: "talk" },
  { slug: "producttank-frankfurt", displayName: "ProductTank Frankfurt", kind: "talk" },
  { slug: "pydata-rhein-main", displayName: "PyData Rhein-Main", kind: "talk" },
  { slug: "safe-ai-germany-saige-frankfurt", displayName: "SAIGE Frankfurt", kind: "talk" },
  { slug: "scaling-digital-innovation-frankfurt", displayName: "Scaling Digital Innovation Frankfurt", kind: "talk" },
  { slug: "frankfurt-data-engineering", displayName: "Frankfurt Data Engineering", kind: "talk" },
];

const BASE = "https://www.meetup.com";
const UA = "museumsufer event-hub crawler / contact: jonas@bgdlabs.com";

/** Meetup venues aren't carried with lat/lon in the page state, only
 *  city + address. Meetup groups also rotate venues frequently. We tag
 *  every event with the Frankfurt CBD centroid so the hub's geofence
 *  passes; the per-event venue_room + city carry the actual location. */
const FRANKFURT_LAT = 50.1112;
const FRANKFURT_LON = 8.6749;

/** Frankfurt + nearby city names that we accept on venue.city. The hub's
 *  FRANKFURT_BBOX geofence catches outliers, but matching by city here is
 *  cheaper and gives a more readable per-source count. */
const ALLOWED_CITY_RE = /^(?:frankfurt(?:\s+am\s+main)?|offenbach|bad\s+homburg|hanau|eschborn|wiesbaden|mainz)/i;

/** Title patterns that say "this is not a talk" — applied to both kinds. */
const NON_TALK_RE =
  /\b(?:lean\s+coffee|stammtisch|happy\s+hour|after\s+work|coffee\s+chat|coffee\s+&|networking\s+only|social\s+(?:meetup|event|night)|game\s+night)\b/i;
/** Title patterns that confirm "this is a talk" — required for kind=mixed. */
const TALK_RE =
  /\b(?:talk|vortrag|presentation|präsentation|lecture|lightning|demo|workshop|panel|discussion|diskussion|tutorial|hands[- ]on|tech\s+session)\b/i;

interface ApolloEvent {
  id: string;
  title?: string;
  eventUrl?: string;
  description?: string;
  dateTime?: string;
  endTime?: string;
  eventType?: string;
  isOnline?: boolean;
  status?: string;
  venue?: { __ref?: string };
}
interface ApolloVenue {
  __typename: "Venue";
  id: string;
  name?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
}

export async function scrapeMeetup(): Promise<VenueScrapeResult[]> {
  const today = todayIso();
  const results = await Promise.allSettled(GROUPS.map((g) => scrapeGroup(g, today)));
  return results
    .filter((r): r is PromiseFulfilledResult<VenueScrapeResult> => r.status === "fulfilled")
    .map((r) => r.value);
}

async function scrapeGroup(group: MeetupGroup, today: string): Promise<VenueScrapeResult> {
  const url = `${BASE}/${group.slug}/events/`;
  const sourceSlug = `meetup-${group.slug}`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9" } });
    if (!res.ok) return { source_slug: sourceSlug, display_name: group.displayName, events: [] };
    const html = await res.text();
    const apollo = extractApolloState(html);
    if (!apollo) return { source_slug: sourceSlug, display_name: group.displayName, events: [] };

    const events: CanonicalScrapedEvent[] = [];
    for (const [key, value] of Object.entries(apollo)) {
      if (!key.startsWith("Event:")) continue;
      const ev = value as ApolloEvent;
      const event = toCanonicalEvent(ev, apollo, group, today);
      if (event) events.push(event);
    }
    return { source_slug: sourceSlug, display_name: group.displayName, events };
  } catch (err) {
    console.warn(`meetup ${group.slug}: ${err instanceof Error ? err.message : err}`);
    return { source_slug: sourceSlug, display_name: group.displayName, events: [] };
  }
}

function toCanonicalEvent(
  ev: ApolloEvent,
  apollo: Record<string, unknown>,
  group: MeetupGroup,
  today: string,
): CanonicalScrapedEvent | null {
  if (ev.status !== "ACTIVE") return null;
  if (ev.eventType !== "PHYSICAL" || ev.isOnline) return null;
  if (!ev.dateTime || !ev.title) return null;

  const date = ev.dateTime.slice(0, 10);
  if (date < today) return null;
  const time = ev.dateTime.slice(11, 16);
  const endTime = ev.endTime?.slice(11, 16) ?? null;
  const endDateCandidate = ev.endTime?.slice(0, 10) ?? null;
  const endDate = endDateCandidate && endDateCandidate !== date ? endDateCandidate : null;

  if (NON_TALK_RE.test(ev.title)) return null;
  if (group.kind === "mixed" && !TALK_RE.test(ev.title)) return null;

  const venueRef = ev.venue?.__ref;
  const venue = venueRef ? (apollo[venueRef] as ApolloVenue | undefined) : undefined;
  if (!venue) return null;
  if (!ALLOWED_CITY_RE.test(venue.city ?? "")) return null;

  return {
    source_event_id: ev.id,
    title: ev.title,
    description: ev.description?.slice(0, 800) ?? null,
    date,
    time,
    end_date: endDate,
    end_time: endTime,
    detail_url: ev.eventUrl ?? null,
    ticket_url: ev.eventUrl ?? null,
    image_url: null,
    venue_room: venue.name ?? null,
    city: venue.city ?? null,
    lat: FRANKFURT_LAT,
    lon: FRANKFURT_LON,
    raw_category: null,
    labels: [{ label: "talk:vortrag", confidence: 0.8, classifier: "scraper-hardcoded" }],
  };
}

function extractApolloState(html: string): Record<string, unknown> | null {
  const match = html.match(/__NEXT_DATA__[^>]*>\s*({.+?})\s*<\/script>/);
  if (!match) return null;
  try {
    const data = JSON.parse(match[1]) as { props?: { pageProps?: { __APOLLO_STATE__?: Record<string, unknown> } } };
    return data.props?.pageProps?.__APOLLO_STATE__ ?? null;
  } catch {
    return null;
  }
}

export const MEETUP_GROUP_SLUGS: ReadonlyArray<string> = GROUPS.map((g) => `meetup-${g.slug}`);
