/**
 * Escape helpers for the three contexts both apps emit:
 *  - HTML attribute / text node    (escapeHtml)
 *  - XML / RSS                     (xmlEsc — also escapes apostrophes)
 *  - RFC 5545 ICS field values     (icsEsc)
 */

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function xmlEsc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** RFC 5545 §3.3.11 — backslash, semicolon, comma, and newline are reserved. */
export function icsEsc(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** UTC stamp formatted for ICS DTSTAMP — `YYYYMMDDTHHMMSSZ`. */
export function utcStamp(): string {
  return `${new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "").slice(0, 15)}Z`;
}
