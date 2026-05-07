/**
 * HTML decoding and stripping with German named-entity support.
 *
 * Lifted from frankfurt-theaters/src/shared.ts where it was developed
 * to handle the &auml;/&ouml;/&shy; escapes the museum scrapers also
 * need but were silently dropping.
 */

const NAMED_ENTITIES: Record<string, string> = {
  nbsp: " ",
  shy: "­",
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  laquo: "«",
  raquo: "»",
  bdquo: "„",
  ldquo: "“",
  rdquo: "”",
  sbquo: "‚",
  lsquo: "‘",
  rsquo: "’",
  euro: "€",
  copy: "©",
  reg: "®",
  trade: "™",
  middot: "·",
  Auml: "Ä",
  auml: "ä",
  Ouml: "Ö",
  ouml: "ö",
  Uuml: "Ü",
  uuml: "ü",
  szlig: "ß",
  Aacute: "Á",
  aacute: "á",
  Eacute: "É",
  eacute: "é",
  Iacute: "Í",
  iacute: "í",
  Oacute: "Ó",
  oacute: "ó",
  Uacute: "Ú",
  uacute: "ú",
  Agrave: "À",
  agrave: "à",
  Egrave: "È",
  egrave: "è",
  Igrave: "Ì",
  igrave: "ì",
  Ograve: "Ò",
  ograve: "ò",
  Ugrave: "Ù",
  ugrave: "ù",
  Acirc: "Â",
  acirc: "â",
  Ecirc: "Ê",
  ecirc: "ê",
  Icirc: "Î",
  icirc: "î",
  Ocirc: "Ô",
  ocirc: "ô",
  Ucirc: "Û",
  ucirc: "û",
  Atilde: "Ã",
  atilde: "ã",
  Ntilde: "Ñ",
  ntilde: "ñ",
  Otilde: "Õ",
  otilde: "õ",
  ccedil: "ç",
  Ccedil: "Ç",
  oslash: "ø",
  Oslash: "Ø",
  aring: "å",
  Aring: "Å",
  aelig: "æ",
  AElig: "Æ",
};

export function decodeEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&([a-zA-Z]+);/g, (m, name) => NAMED_ENTITIES[name] ?? m);
}

export function stripHtml(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

/** Strip HTML, then truncate at the last whitespace before maxLen. Returns null on empty. */
export function truncate(text: string, maxLen: number): string | null {
  const t = stripHtml(text);
  if (!t) return null;
  if (t.length <= maxLen) return t;
  const cut = t.slice(0, maxLen);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > 0 ? lastSpace : maxLen)}…`;
}

export function nullIfMidnight(time: string | null | undefined): string | null {
  if (!time) return null;
  return time === "00:00" ? null : time;
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ß/g, "ss")
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function normalizeUrl(url: string | null | undefined, base: string): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  if (trimmed.startsWith("/")) return `${base.replace(/\/$/, "")}${trimmed}`;
  return `${base.replace(/\/$/, "")}/${trimmed}`;
}

/** Reject Reservix/CDN placeholders and obvious non-image URLs. */
export function sanitizeImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const u = url.trim();
  if (!u) return null;
  if (/^(data:|javascript:|about:)/i.test(u)) return null;
  if (/blank-?image|placeholder|spacer\.gif/i.test(u)) return null;
  return u;
}
