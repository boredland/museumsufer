/** Detect talk language from title/description. Returns ISO 639-1 code,
 *  or null when the event is in German (the Frankfurt default). */
export function detectTalkLanguage(title: string, description?: string | null): string | null {
  const haystack = `${title} ${description || ""}`.toLowerCase();
  if (
    haystack.includes("in english") ||
    haystack.includes("auf englisch") ||
    haystack.includes("english-language") ||
    haystack.includes("english language") ||
    haystack.includes("held in english")
  )
    return "en";
  if (haystack.includes("auf französisch") || haystack.includes("in french") || haystack.includes("en français"))
    return "fr";
  if (haystack.includes("auf spanisch") || haystack.includes("in spanish") || haystack.includes("en español"))
    return "es";
  if (haystack.includes("auf arabisch") || haystack.includes("in arabic") || haystack.includes("باللغة العربية"))
    return "ar";
  if (haystack.includes("auf italienisch") || haystack.includes("in italian") || haystack.includes("in italiano"))
    return "it";
  if (haystack.includes("auf hebräisch") || haystack.includes("in hebrew") || haystack.includes("בעברית")) return "he";
  return null;
}
