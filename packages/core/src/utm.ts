/**
 * Tag outbound URLs with UTM parameters so partner sites can attribute
 * referral traffic. Returns the original URL unchanged if it isn't a valid
 * absolute URL (e.g. a `mailto:` or relative href slipped through).
 */
export function buildUtm(source: string) {
  return (url: string, content: string): string => {
    try {
      const u = new URL(url);
      u.searchParams.set("utm_source", source);
      u.searchParams.set("utm_medium", "referral");
      u.searchParams.set("utm_content", content);
      return u.toString();
    } catch {
      return url;
    }
  };
}
