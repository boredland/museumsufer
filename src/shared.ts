export const MUSEUMSUFER_DE = "https://www.museumsufer.de";
export const APP_URL = "https://museumsufer.app";
export const USER_AGENT = "Mozilla/5.0 (compatible; Museumsufer/1.0)";

export const GERMAN_MONTHS_SHORT: Record<string, string> = {
  jan: "01", feb: "02", "mär": "03", mar: "03", apr: "04",
  mai: "05", jun: "06", jul: "07", aug: "08",
  sep: "09", okt: "10", nov: "11", dez: "12",
};

export const GERMAN_MONTHS: Record<string, string> = {
  januar: "01", februar: "02", "märz": "03", april: "04",
  mai: "05", juni: "06", juli: "07", august: "08",
  september: "09", oktober: "10", november: "11", dezember: "12",
};

export function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function stripHtml(text: string): string {
  return text
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#\d+;/g, "")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function truncateHtml(text: string, maxLen = 300): string | null {
  const stripped = stripHtml(text);
  return stripped.length > 0 ? stripped.slice(0, maxLen) : null;
}

export function nullIfMidnight(time: string | null | undefined): string | null {
  if (!time || time === "00:00") return null;
  return time;
}

export function normalizeUrl(url: string | null | undefined, baseUrl: string): string | null {
  if (!url) return null;
  url = url.trim();
  if (url.startsWith("http")) return url;
  if (url.startsWith("//")) return `https:${url}`;
  if (url.startsWith("/")) return `${baseUrl.replace(/\/$/, "")}${url}`;
  return `${baseUrl.replace(/\/$/, "")}/${url}`;
}
