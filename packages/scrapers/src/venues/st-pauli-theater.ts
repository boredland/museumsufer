import { decodeEntities, stripHtml } from "@museumsufer/core";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";
import { resolveStageLabels } from "./_stage-labels";

const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

export async function scrapeStPauliTheater(): Promise<VenueScrapeResult> {
  // 1. Fetch main page to get nonce & shortcode config
  const pageRes = await fetch("https://www.st-pauli-theater.de/spielplan/", {
    headers: { "User-Agent": UA },
  });
  if (!pageRes.ok) throw new Error(`st-pauli main page fetch failed: ${pageRes.status}`);
  const html = await pageRes.text();

  const nonceMatch = html.match(/"postnonce"\s*:\s*"([a-f0-9]+)"/) || html.match(/"n"\s*:\s*"([a-f0-9]+)"/);
  const nonce = nonceMatch?.[1];
  if (!nonce) throw new Error("Could not find St. Pauli AJAX nonce in page HTML");

  const scMatch = html.match(/class='evo_cal_data'\s+data-sc='([^']+)'/);
  if (!scMatch) throw new Error("Could not find St. Pauli shortcode data in page HTML");

  const sc = JSON.parse(scMatch[1]);
  sc.number_of_months = 12;
  sc.event_past_future = "future";
  sc.show_upcoming = 1;
  delete sc.fixed_month;
  delete sc.fixed_year;
  delete sc.fixed_day;

  // 2. Fetch scheduled events via EventON AJAX
  const body = new URLSearchParams();
  body.append("action", "eventon_get_events");
  body.append("nonce", nonce);
  for (const [k, v] of Object.entries(sc)) {
    body.append(`shortcode[${k}]`, String(v));
  }

  const ajaxRes = await fetch("https://www.st-pauli-theater.de/wp-admin/admin-ajax.php", {
    method: "POST",
    headers: {
      "User-Agent": UA,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });
  if (!ajaxRes.ok) throw new Error(`st-pauli ajax fetch failed: ${ajaxRes.status}`);
  const ajaxData = (await ajaxRes.json()) as any;
  const rawEvents = ajaxData.json || [];

  // 3. Fetch WP events details in bulk
  const wpEventsRes = await fetch("https://www.st-pauli-theater.de/wp-json/wp/v2/ajde_events?per_page=100", {
    headers: { "User-Agent": UA },
  });
  const wpEvents = wpEventsRes.ok ? ((await wpEventsRes.json()) as any[]) : [];
  const eventDetailsMap = new Map();
  const mediaIds = new Set<number>();

  for (const ev of wpEvents) {
    eventDetailsMap.set(ev.id, {
      slug: ev.slug,
      link: ev.link,
      featured_media: ev.featured_media,
      description: ev.content?.rendered ? cleanDescription(ev.content.rendered) : null,
    });
    if (ev.featured_media) {
      mediaIds.add(ev.featured_media);
    }
  }

  // 4. Fetch WP media by specific IDs in bulk
  const mediaMap = new Map();
  if (mediaIds.size > 0) {
    const includeIds = Array.from(mediaIds).join(",");
    const wpMediaRes = await fetch(
      `https://www.st-pauli-theater.de/wp-json/wp/v2/media?include=${includeIds}&per_page=100`,
      { headers: { "User-Agent": UA } },
    );
    const wpMedia = wpMediaRes.ok ? ((await wpMediaRes.json()) as any[]) : [];
    for (const m of wpMedia) {
      mediaMap.set(m.id, m.source_url);
    }
  }

  // 5. Combine and construct events
  const events: CanonicalScrapedEvent[] = [];
  const seen = new Set<string>();

  for (const rev of rawEvents) {
    const detail = eventDetailsMap.get(rev.event_id) || {};
    const imageUrl = detail.featured_media ? mediaMap.get(detail.featured_media) : null;

    const startUnix = rev.event_start_unix;
    let dateStr = null;
    let timeStr = null;
    if (startUnix) {
      const d = new Date(startUnix * 1000);
      const formatter = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Europe/Berlin",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
      const timeFormatter = new Intl.DateTimeFormat("de-DE", {
        timeZone: "Europe/Berlin",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
      dateStr = formatter.format(d);
      timeStr = timeFormatter.format(d);
    }

    if (!dateStr) continue;

    const ticketUrl = rev.event_pmv?._evcal_ec_f1a1_cus?.[0] || null;
    const subtitle = rev.event_pmv?.evcal_subtitle?.[0] || null;

    const dedup = `${rev.event_id}|${dateStr}|${timeStr ?? ""}`;
    if (seen.has(dedup)) continue;
    seen.add(dedup);

    const title = decodeEntities(rev.event_title);
    const cleanSub = subtitle ? decodeEntities(subtitle) : null;
    const description = detail.description || cleanSub;

    events.push({
      source_event_id: `${rev.event_id}|${dateStr}|${timeStr ?? ""}`,
      title,
      subtitle: cleanSub,
      description,
      date: dateStr,
      time: timeStr !== "00:00" ? timeStr : null,
      detail_url: detail.link || `https://www.st-pauli-theater.de/programm/${detail.slug || rev.event_id}/`,
      ticket_url: ticketUrl,
      image_url: imageUrl || null,
      price_min: null,
      price_max: null,
      performers: null,
      venue_room: null,
      raw_category: null,
      labels: resolveStageLabels({ title, subtitle: cleanSub, defaultLabel: "stage:theater", confidence: 0.9 }),
    });
  }

  return { source_slug: "st-pauli-theater", display_name: "St. Pauli Theater", events };
}

function cleanDescription(html: string): string {
  let text = html.replace(/\[\/?[a-z0-9_-]+[^\]]*\]/gi, "");
  text = stripHtml(text);
  text = text
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length > 500) {
    text = `${text.slice(0, 500)}...`;
  }
  return decodeEntities(text);
}
