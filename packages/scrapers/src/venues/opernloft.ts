import { toBerlinDate, toBerlinTime, todayIso } from "@museumsufer/core/date";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";
import { resolveStageLabels } from "./_stage-labels";

/**
 * Opernloft stages condensed, modern opera productions in the old Altona
 * ferry terminal. It moved ticketing off Reservix to ditix — opernloft.de's
 * "Vorstellungstermine" now redirects to `opernloft.ditix.shop`, whose
 * Reservix subdomain answers 200 with "Derzeit sind leider keine Termine
 * verfügbar."
 *
 * The ditix shop is a Next.js app whose listing renders only the first 9
 * dates, so we talk to its GraphQL projections API instead. Access is a
 * two-step handshake, both public: the shop mints a short-lived SHOP-scoped
 * JWT from its own `/api/auth` (keyed by tenant + organizer subdomain), and
 * that bearer unlocks `getEventList`, which returns every published date in
 * one page.
 */
const SHOP_ORIGIN = "https://opernloft.ditix.shop";
const GRAPHQL_URL = "https://projections.production.ditix-production.services.ditix.app/delivery/graphql/blue";
const IMAGE_BASE = "https://crud.production.ditix-production.services.ditix.app/file/image";
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

const EVENT_LIST_QUERY = `query GetEventList($input: GetEventListInput!) {
  getEventList(input: $input) {
    total
    data {
      code
      name
      state
      timestampStart
      timestampEnd
      coverImage
      location { name }
    }
  }
}`;

interface DitixEvent {
  code: string;
  name: string;
  state: string;
  timestampStart: number | null;
  timestampEnd: number | null;
  coverImage: string | null;
  location: { name: string | null } | null;
}

/** Shop bootstrap data: tenant + organizer ids the auth and list calls need. */
interface ShopProps {
  tenantId: string;
  organizerId: string;
  tenantDomain: string;
  subdomainName: string;
}

export async function scrapeOpernloft(): Promise<VenueScrapeResult> {
  const shop = await fetchShopProps();
  const token = await fetchShopToken(shop);
  const today = todayIso();
  const events: CanonicalScrapedEvent[] = [];

  for (const ev of await fetchEventList(shop, token, today)) {
    if (!ev.timestampStart) continue;
    const date = toBerlinDate(ev.timestampStart);
    if (date < today) continue;

    // Titles carry stray trailing spaces from the shop's editor.
    const title = ev.name.replace(/\s+/g, " ").trim();
    if (!title) continue;

    const url = `${SHOP_ORIGIN}/event/${ev.code}`;
    events.push({
      source_event_id: ev.code,
      title,
      description: null,
      date,
      time: toBerlinTime(ev.timestampStart),
      end_time: ev.timestampEnd ? toBerlinTime(ev.timestampEnd) : null,
      detail_url: url,
      ticket_url: url,
      image_url: ev.coverImage ? `${IMAGE_BASE}/${shop.tenantId}/${ev.coverImage}/g:ce/w:1200.png` : null,
      venue_room: ev.location?.name ?? null,
      labels: resolveStageLabels({ title, defaultLabel: "stage:opera", confidence: 0.85 }),
    });
  }

  // The API orders by nothing in particular; sort so the bundle stays stable.
  events.sort((a, b) =>
    `${a.date}${a.time}${a.source_event_id}`.localeCompare(`${b.date}${b.time}${b.source_event_id}`),
  );

  return { source_slug: "opernloft", display_name: "Opernloft", events };
}

async function fetchShopProps(): Promise<ShopProps> {
  const res = await fetch(`${SHOP_ORIGIN}/`, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`opernloft shop fetch failed: ${res.status}`);
  const html = await res.text();
  const json = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/)?.[1];
  if (!json) throw new Error("opernloft shop: __NEXT_DATA__ missing");
  const { tenantId, organizerId, tenantDomain, subdomainName } = JSON.parse(json).props.pageProps as Partial<ShopProps>;
  if (!tenantId || !organizerId || !tenantDomain || !subdomainName) {
    throw new Error("opernloft shop: incomplete pageProps");
  }
  return { tenantId, organizerId, tenantDomain, subdomainName };
}

async function fetchShopToken(shop: ShopProps): Promise<string> {
  const res = await fetch(`${SHOP_ORIGIN}/api/auth`, {
    headers: {
      "User-Agent": UA,
      "x-tenant-domain": shop.tenantDomain,
      "x-organizer-subdomain": shop.subdomainName,
    },
  });
  if (!res.ok) throw new Error(`opernloft auth failed: ${res.status}`);
  const token = (await res.text()).trim();
  if (!token) throw new Error("opernloft auth returned an empty token");
  return token;
}

async function fetchEventList(shop: ShopProps, token: string, today: string): Promise<DitixEvent[]> {
  const res = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: { "User-Agent": UA, "content-type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      query: EVENT_LIST_QUERY,
      variables: {
        input: {
          filter: {
            isPublished: { equals: true },
            state: { in: ["ACTIVE"] },
            organizer: { equals: shop.organizerId },
            // The API compares epoch millis; an ISO string errors out server-side.
            timestampEnd: { after: Date.parse(`${today}T00:00:00Z`) },
          },
          page: 1,
        },
      },
    }),
  });
  if (!res.ok) throw new Error(`opernloft event list failed: ${res.status}`);
  const body = (await res.json()) as {
    data?: { getEventList?: { data?: DitixEvent[] } };
    errors?: { message: string }[];
  };
  if (body.errors?.length) throw new Error(`opernloft event list: ${body.errors[0].message}`);
  return body.data?.getEventList?.data ?? [];
}
