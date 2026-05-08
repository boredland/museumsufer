/**
 * In-memory query layer over SCRAPE_DATA. Daily GitHub Action regenerates
 * `src/scrape-data.ts`; the worker never touches a database.
 *
 * Read-time work is small: filter by date / category, sort, optionally
 * drop already-finished events on today.
 */
import { compareNullsLast } from "@museumsufer/core";
import { isCategorySlug } from "./categories";
import { berlinHourMinute, todayIso } from "./date";
import { SCRAPE_DATA } from "./scrape-data";
import type { Event } from "./types";

const EVENTS_BY_ID = new Map<number, Event>(SCRAPE_DATA.events.map((e) => [e.id, e]));

/** Whether a date `d` falls in the [start, end] inclusive range of an event. */
function eventCoversDate(ev: Event, date: string): boolean {
  if (ev.date === date) return true;
  if (ev.end_date && ev.date <= date && date <= ev.end_date) return true;
  return false;
}

export function getAllEvents(): Event[] {
  return SCRAPE_DATA.events;
}

export function getEventById(id: number): Event | null {
  return EVENTS_BY_ID.get(id) ?? null;
}

export function getEventsForDate(date: string, category?: string): Event[] {
  const cat = category && isCategorySlug(category) ? category : undefined;
  const out: Event[] = [];
  for (const ev of SCRAPE_DATA.events) {
    if (!eventCoversDate(ev, date)) continue;
    if (cat && ev.category !== cat) continue;
    out.push(ev);
  }
  out.sort(eventSort);
  return date === todayIso() ? filterPastEvents(out) : out;
}

export function getEventsForRange(startDate: string, endDate: string, category?: string): Event[] {
  const cat = category && isCategorySlug(category) ? category : undefined;
  const today = todayIso();
  const todayInRange = startDate <= today && today <= endDate;
  const past: Event[] = [];
  const todays: Event[] = [];
  const future: Event[] = [];
  for (const ev of SCRAPE_DATA.events) {
    const start = ev.date;
    const end = ev.end_date ?? ev.date;
    if (end < startDate || start > endDate) continue;
    if (cat && ev.category !== cat) continue;
    if (!todayInRange) future.push(ev);
    else if (end < today) past.push(ev);
    else if (start <= today && today <= end) todays.push(ev);
    else future.push(ev);
  }
  past.sort(eventSort);
  todays.sort(eventSort);
  future.sort(eventSort);
  return todayInRange ? [...past, ...filterPastEvents(todays), ...future] : [...past, ...future];
}

/** Per-day event counts in [start, end]. Drives the date strip's density hint. */
export function getEventCountsByDate(startDate: string, endDate: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const ev of SCRAPE_DATA.events) {
    const start = ev.date;
    const end = ev.end_date ?? ev.date;
    const from = start < startDate ? startDate : start;
    const to = end > endDate ? endDate : end;
    if (from > to) continue;
    for (let d = from; d <= to; d = nextDay(d)) {
      counts.set(d, (counts.get(d) ?? 0) + 1);
    }
  }
  return counts;
}

export function getCategoryCountsForDate(date: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const ev of SCRAPE_DATA.events) {
    if (!eventCoversDate(ev, date)) continue;
    counts.set(ev.category, (counts.get(ev.category) ?? 0) + 1);
  }
  return counts;
}

// ─── helpers ────────────────────────────────────────────────────────

function nextDay(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function eventSort(a: Event, b: Event): number {
  return compareNullsLast(a.time, b.time) || a.title.localeCompare(b.title, "de");
}

/** Drop events whose start/end has already passed in Berlin time. */
function filterPastEvents(events: Event[]): Event[] {
  const { hour, minute } = berlinHourMinute();
  let nowMinutes = hour * 60 + minute;
  if (nowMinutes < 360) nowMinutes += 24 * 60;
  return events.filter((ev) => {
    if (ev.end_date && ev.end_date > todayIso()) return true;
    if (!ev.time) return true;
    if (ev.end_time) {
      const [eh, em] = ev.end_time.split(":").map(Number);
      let endMinutes = eh * 60 + em;
      if (endMinutes < 360) endMinutes += 24 * 60;
      return nowMinutes < endMinutes;
    }
    const [h, m] = ev.time.split(":").map(Number);
    return nowMinutes < h * 60 + m + 180;
  });
}
