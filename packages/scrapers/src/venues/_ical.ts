/** Minimal iCalendar (RFC 5545) reader for the WP "Events Manager" `?ical=1`
 *  feeds several Hamburg venues expose. Handles line unfolding, TZID/all-day
 *  DTSTART, and the standard text escapes. Not a general parser — just what the
 *  venue feeds use. */

export interface IcalEvent {
  uid: string | null;
  date: string; // YYYY-MM-DD
  time: string | null; // HH:MM (null for all-day)
  endTime: string | null;
  summary: string;
  description: string | null;
  url: string | null;
  image: string | null;
  categories: string[];
  location: string | null;
}

/** Join RFC 5545 folded lines (continuations start with space or tab). */
function unfold(text: string): string[] {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\n[ \t]/g, "")
    .split("\n");
}

function unescapeText(s: string): string {
  return s.replace(/\\n/gi, " ").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\").trim();
}

/** "20260622T200000" / "20260622" → { date, time }. */
function parseDt(value: string): { date: string; time: string | null } | null {
  const m = value.match(/(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2}))?/);
  if (!m) return null;
  return {
    date: `${m[1]}-${m[2]}-${m[3]}`,
    time: m[4] ? `${m[4]}:${m[5]}` : null,
  };
}

export function parseIcal(text: string): IcalEvent[] {
  const lines = unfold(text);
  const events: IcalEvent[] = [];
  let cur: Partial<IcalEvent> & { _start?: { date: string; time: string | null } } = {};
  let inEvent = false;

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      inEvent = true;
      cur = { categories: [] };
      continue;
    }
    if (line === "END:VEVENT") {
      if (cur._start && cur.summary) {
        events.push({
          uid: cur.uid ?? null,
          date: cur._start.date,
          time: cur._start.time,
          endTime: cur.endTime ?? null,
          summary: cur.summary,
          description: cur.description ?? null,
          url: cur.url ?? null,
          image: cur.image ?? null,
          categories: cur.categories ?? [],
          location: cur.location ?? null,
        });
      }
      inEvent = false;
      continue;
    }
    if (!inEvent) continue;

    const sep = line.indexOf(":");
    if (sep === -1) continue;
    const rawName = line.slice(0, sep);
    const value = line.slice(sep + 1);
    const name = rawName.split(";")[0].toUpperCase();

    switch (name) {
      case "UID":
        cur.uid = value.trim();
        break;
      case "DTSTART":
        cur._start = parseDt(value) ?? undefined;
        break;
      case "DTEND":
        cur.endTime = parseDt(value)?.time ?? null;
        break;
      case "SUMMARY":
        cur.summary = unescapeText(value);
        break;
      case "DESCRIPTION":
        cur.description = unescapeText(value) || null;
        break;
      case "URL":
        cur.url = value.trim() || null;
        break;
      case "LOCATION":
        cur.location = unescapeText(value) || null;
        break;
      case "CATEGORIES":
        cur.categories = unescapeText(value)
          .split(",")
          .map((c) => c.trim())
          .filter(Boolean);
        break;
      case "ATTACH":
        if (/image\//i.test(rawName) || /\.(jpe?g|png|webp)/i.test(value)) cur.image = value.trim();
        break;
    }
  }
  return events;
}
