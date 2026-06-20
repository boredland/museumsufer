import { decodeEntities, normalizeUrl, stripHtml } from "@museumsufer/core";
import type { CanonicalScrapedEvent, VenueScrapeResult } from "../types";
import { classifyChurchEvent } from "./_church-events";

const BASE = "https://www.jacobus.de";
const API_URL = `${BASE}/musik/konzertkalender?type=1574261111`;
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

interface JacobiEvent {
  nr: string;
  title: string;
  subtitle?: string | null;
  shortDescription?: string | null;
  longDescription?: string | null;
  eventStart: string; // "YYYY/MM/DD HH:MM"
  room?: string | null;
  works?: string | null;
  performers?: string | null;
  organ?: string | null;
  ensemble?: string | null;
  choir?: string | null;
  orchestra?: string | null;
  leaders?: string | null;
  eventOrderLink?: string | null;
  ticketLink?: string | null;
}

export async function scrapeHauptkircheStJacobi(): Promise<VenueScrapeResult> {
  const res = await fetch(API_URL, {
    headers: { "User-Agent": UA },
  });
  if (!res.ok) throw new Error(`St. Jacobi fetch failed: ${res.status}`);
  const data = (await res.json()) as { events?: JacobiEvent[] };
  const list = data.events ?? [];

  const events: CanonicalScrapedEvent[] = [];

  for (const ev of list) {
    // Parse Date and Time from "YYYY/MM/DD HH:MM"
    const startParts = ev.eventStart.split(" ");
    if (startParts.length < 2) continue;
    const date = startParts[0].replace(/\//g, "-");
    const time = startParts[1];

    // Build description
    const descParts: string[] = [];
    if (ev.shortDescription) descParts.push(cleanText(ev.shortDescription));
    if (ev.longDescription) descParts.push(cleanText(ev.longDescription));
    if (ev.works) descParts.push(`Werke:\n${cleanText(ev.works)}`);

    const participants: string[] = [];
    if (ev.performers) participants.push(`Mitwirkende: ${cleanText(ev.performers)}`);
    if (ev.organ) participants.push(`Orgel: ${cleanText(ev.organ)}`);
    if (ev.ensemble) participants.push(`Ensemble: ${cleanText(ev.ensemble)}`);
    if (ev.choir) participants.push(`Chor: ${cleanText(ev.choir)}`);
    if (ev.orchestra) participants.push(`Orchester: ${cleanText(ev.orchestra)}`);
    if (ev.leaders) participants.push(`Leitung: ${cleanText(ev.leaders)}`);

    if (participants.length > 0) {
      descParts.push(participants.join("\n"));
    }

    const description = descParts.join("\n\n");

    // Ticket Link
    let ticket_url = ev.ticketLink || ev.eventOrderLink || null;
    if (ticket_url && !ticket_url.startsWith("http")) {
      ticket_url = normalizeUrl(ticket_url, BASE);
    }

    // Detail Link
    const detailUrl = `${BASE}/musik/konzertkalender?tx_pxcalendarjacobi_events%5Baction%5D=show&tx_pxcalendarjacobi_events%5BeventNr%5D=${ev.nr}&tx_pxcalendarjacobi_events%5Bcontroller%5D=Event`;

    const title = cleanText(ev.title);
    // Drop services, devotions and tours — keep only genuine concerts.
    const labels = classifyChurchEvent(title);
    if (!labels) continue;

    events.push({
      source_event_id: `jacobi-${ev.nr}`,
      title,
      subtitle: ev.subtitle ? cleanText(ev.subtitle) : null,
      description: description || null,
      date,
      time,
      detail_url: detailUrl,
      ticket_url: ticket_url || detailUrl,
      image_url: null,
      venue_room: ev.room ? cleanText(ev.room) : null,
      price_min: null,
      price_max: null,
      labels,
    });
  }

  return {
    source_slug: "hauptkirche-st-jacobi",
    display_name: "Hauptkirche St. Jacobi",
    events,
  };
}

function cleanText(raw: string): string {
  return stripHtml(decodeEntities(raw)).trim();
}
