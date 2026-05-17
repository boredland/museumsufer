/**
 * Coarse event-type classifier — Führung / Workshop / Vortrag / Konzert /
 * Vernissage / Familie / Film — driven by title+description keyword match.
 * Returns null if no bucket matches; callers can then fall back to a
 * source-specific signal or `Vortrag` as a last resort.
 */
export type EventType = "Führung" | "Workshop" | "Vortrag" | "Konzert" | "Vernissage" | "Familie" | "Film";

export function classifyEvent(title: string, description?: string | null): EventType | null {
  const haystack = `${title.toLowerCase()} ${(description || "").toLowerCase()}`;

  if (
    haystack.includes("führung") ||
    haystack.includes("fuehrung") ||
    haystack.includes("rundgang") ||
    haystack.includes("spaziergang") ||
    haystack.includes("tour")
  )
    return "Führung";
  if (
    haystack.includes("workshop") ||
    haystack.includes("kurs") ||
    haystack.includes("atelier") ||
    haystack.includes("werkstatt")
  )
    return "Workshop";
  if (
    haystack.includes("vortrag") ||
    haystack.includes("lecture") ||
    haystack.includes("gespräch") ||
    haystack.includes("talk") ||
    haystack.includes("buchpräsentation") ||
    haystack.includes("buchpraesentation") ||
    haystack.includes("buchvorstellung") ||
    haystack.includes("diskussion") ||
    haystack.includes("podium") ||
    haystack.includes("debatte") ||
    haystack.includes("lesung") ||
    haystack.includes("liest aus") ||
    haystack.includes("book launch") ||
    haystack.includes("book presentation")
  )
    return "Vortrag";
  if (haystack.includes("konzert") || haystack.includes("musik")) return "Konzert";
  if (haystack.includes("vernissage") || haystack.includes("eröffnung") || haystack.includes("eröffnungsfeier"))
    return "Vernissage";
  if (
    haystack.includes("familie") ||
    haystack.includes("kinder") ||
    haystack.includes(" für kids") ||
    haystack.includes("baby")
  )
    return "Familie";
  if (haystack.includes("film") || haystack.includes("kino") || haystack.includes("cinema")) return "Film";

  return null;
}

const EVENT_TYPE_LABEL: Record<EventType, string> = {
  Vortrag: "talk:vortrag",
  Konzert: "music:classical",
  Führung: "museum:fuehrung",
  Workshop: "museum:workshop",
  Vernissage: "museum:vernissage",
  Familie: "museum:familie",
  Film: "museum:film",
};

export function eventTypeToLabel(t: EventType | null): string | null {
  return t ? EVENT_TYPE_LABEL[t] : null;
}
