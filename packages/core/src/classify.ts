export function classifyEvent(title: string, description?: string | null): string | null {
  const t = title.toLowerCase();
  const d = (description || "").toLowerCase();
  const haystack = `${t} ${d}`;

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
    haystack.includes("diskussion")
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

/** Detect talk language from title/description. Returns ISO 639-1 code, or
 *  null when the event is in German (the default for Frankfurt institutions). */
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
