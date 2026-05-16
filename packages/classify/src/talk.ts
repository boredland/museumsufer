export type TalkCategory = "Vortrag" | "Diskussion" | "Lesung";

export const TALK_CATEGORIES: readonly TalkCategory[] = ["Vortrag", "Diskussion", "Lesung"] as const;

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

const LESUNG_KEYWORDS = [
  "lesung",
  "buchpräsentation",
  "buchpraesentation",
  "buchvorstellung",
  "buchpremiere",
  "neuerscheinung",
  "liest aus",
  "lesen aus",
  "liest und spricht",
  "book launch",
  "book presentation",
  "buchmesse",
  "open books",
];

/**
 * Classifies a talk-like event into Lesung / Diskussion / Vortrag.
 * Lesung wins over Diskussion when both match — a book panel with the
 * author is typically *about* the book, so it belongs with readings.
 */
export function classifyTalk(title: string, description?: string | null): TalkCategory {
  const haystack = `${title} ${description ?? ""}`.toLowerCase();
  if (LESUNG_KEYWORDS.some((k) => haystack.includes(k))) return "Lesung";
  if (DISKUSSION_KEYWORDS.some((k) => haystack.includes(k))) return "Diskussion";
  return "Vortrag";
}
