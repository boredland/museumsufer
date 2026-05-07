/**
 * Cross-vendor "Add to calendar" URL builders. Originally lived in
 * frankfurt-museums/src/shared.ts; lifted to core so the theaters app
 * can reuse them for its calendar popover.
 *
 * `location` is the human-readable venue label (museum name, theater
 * name + room, etc.). The original museums shape called it
 * `museum_name`; renamed here to keep the helper neutral.
 */

export interface CalendarEvent {
  date: string;
  time: string | null;
  end_time: string | null;
  end_date: string | null;
  title: string;
  location?: string;
  description: string | null;
  detail_url: string | null;
}

function endHour(time: string): string {
  const h = (parseInt(time.split(":")[0], 10) + 1) % 24;
  return h.toString().padStart(2, "0");
}

function eventDesc(ev: CalendarEvent): string {
  return (ev.description || "") + (ev.detail_url ? `\n${ev.detail_url}` : "");
}

export function buildGoogleCalendarUrl(ev: CalendarEvent): string {
  const date = ev.date.replace(/-/g, "");
  let startDt: string;
  let endDt: string;
  if (ev.time) {
    startDt = `${date}T${ev.time.replace(":", "")}00`;
    if (ev.end_time) {
      endDt = `${(ev.end_date || ev.date).replace(/-/g, "")}T${ev.end_time.replace(":", "")}00`;
    } else {
      endDt = `${date}T${endHour(ev.time)}${ev.time.split(":")[1]}00`;
    }
  } else {
    startDt = date;
    endDt = date;
  }
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: ev.title,
    dates: `${startDt}/${endDt}`,
    location: ev.location || "",
    details: eventDesc(ev),
  });
  if (ev.time) params.set("ctz", "Europe/Berlin");
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function buildOutlookCalendarUrl(ev: CalendarEvent): string {
  const startIso = ev.time ? `${ev.date}T${ev.time}:00` : ev.date;
  let endIso: string;
  if (ev.time && ev.end_time) {
    endIso = `${ev.end_date || ev.date}T${ev.end_time}:00`;
  } else if (ev.time) {
    endIso = `${ev.date}T${endHour(ev.time)}:${ev.time.split(":")[1]}:00`;
  } else {
    endIso = ev.date;
  }
  const params = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: ev.title,
    startdt: startIso,
    enddt: endIso,
    location: ev.location || "",
    body: eventDesc(ev),
  });
  return `https://outlook.live.com/calendar/0/action/compose?${params.toString()}`;
}

export function buildYahooCalendarUrl(ev: CalendarEvent): string {
  const date = ev.date.replace(/-/g, "");
  let st: string;
  let dur: string;
  if (ev.time) {
    st = `${date}T${ev.time.replace(":", "")}00`;
    if (ev.end_time) {
      const startMin = parseInt(ev.time.split(":")[0], 10) * 60 + parseInt(ev.time.split(":")[1], 10);
      const endMin = parseInt(ev.end_time.split(":")[0], 10) * 60 + parseInt(ev.end_time.split(":")[1], 10);
      const diff = endMin > startMin ? endMin - startMin : 60;
      dur = `${String(Math.floor(diff / 60)).padStart(2, "0")}${String(diff % 60).padStart(2, "0")}`;
    } else {
      dur = "0100";
    }
  } else {
    st = date;
    dur = "allday";
  }
  const params = new URLSearchParams({
    v: "60",
    title: ev.title,
    st,
    dur,
    in_loc: ev.location || "",
    desc: eventDesc(ev),
  });
  return `https://calendar.yahoo.com/?${params.toString()}`;
}
