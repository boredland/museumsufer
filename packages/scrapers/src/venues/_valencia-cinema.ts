const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", laquo: "«", raquo: "»", hellip: "…",
  ndash: "–", mdash: "—", lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”", iexcl: "¡", iquest: "¿",
  ntilde: "ñ", Ntilde: "Ñ", ccedil: "ç", Ccedil: "Ç", uuml: "ü", Uuml: "Ü", ouml: "ö", auml: "ä",
  aacute: "á", eacute: "é", iacute: "í", oacute: "ó", uacute: "ú", Aacute: "Á", Eacute: "É", Iacute: "Í", Oacute: "Ó", Uacute: "Ú",
  agrave: "à", egrave: "è", igrave: "ì", ograve: "ò", ugrave: "ù", Agrave: "À", Egrave: "È", Ograve: "Ò",
  acirc: "â", ecirc: "ê", ocirc: "ô", icirc: "î", ucirc: "û", iuml: "ï", euml: "ë",
};

/** Strips tags, decodes entities, collapses whitespace. Tags go first so an encoded `&lt;` survives as text. */
export function decodeHtml(s: string): string {
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(Number.parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n] ?? ENTITIES[n.toLowerCase()] ?? m)
    .replace(/\s+/g, " ")
    .trim();
}

/** Cuts at the last word boundary before `max` so descriptions never end mid-word. */
export function clipDescription(text: string, max = 600): string | null {
  const t = text.trim();
  if (!t) return null;
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const sp = cut.lastIndexOf(" ");
  return `${(sp > max * 0.6 ? cut.slice(0, sp) : cut).replace(/[\s,;:.-]+$/, "")}…`;
}

export const FILM_CINEMA_LABEL = { label: "film:cinema", confidence: 0.95, classifier: "scraper-hardcoded" } as const;
