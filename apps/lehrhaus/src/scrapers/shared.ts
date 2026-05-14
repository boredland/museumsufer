import type { ScrapedEvent } from "../types";

const DISKUSSION_KEYWORDS = [
  "diskussion",
  "gespräch",
  "gesprach",
  "panel",
  "podium",
  "debatte",
  "streit",
  "streitgespräch",
  "stadtgespräch",
  "dialog",
  "forum",
];

export function talkCategory(title: string, description?: string | null): ScrapedEvent["category"] {
  const haystack = `${title} ${description ?? ""}`.toLowerCase();
  return DISKUSSION_KEYWORDS.some((k) => haystack.includes(k)) ? "Diskussion" : "Vortrag";
}
