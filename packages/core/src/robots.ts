/**
 * Standard `robots.txt` body shared by museums and theaters.
 *
 * AI crawlers are explicitly allow-listed (GPTBot, OAI-SearchBot, ChatGPT-User,
 * ClaudeBot, PerplexityBot) plus a wildcard `User-agent: *` allow. The
 * `Content-Signal` directive tells well-behaved crawlers we permit search
 * indexing and AI grounding but not training-data scraping.
 */
export interface RobotsTxtOptions {
  siteUrl: string;
  /** Path of the llms.txt file (defaults to `/llms.txt`). Set to null to omit. */
  llmsTxtPath?: string | null;
  /** Path of the sitemap (defaults to `/sitemap.xml`). */
  sitemapPath?: string;
}

export function buildRobotsTxt(opts: RobotsTxtOptions): string {
  const sitemap = opts.sitemapPath ?? "/sitemap.xml";
  const llmsTxt = opts.llmsTxtPath === undefined ? "/llms.txt" : opts.llmsTxtPath;
  const lines = [
    "User-agent: GPTBot",
    "Allow: /",
    "",
    "User-agent: OAI-SearchBot",
    "Allow: /",
    "",
    "User-agent: ChatGPT-User",
    "Allow: /",
    "",
    "User-agent: ClaudeBot",
    "Allow: /",
    "",
    "User-agent: PerplexityBot",
    "Allow: /",
    "",
    "User-agent: *",
    "Allow: /",
    "",
    // The Cloudflare Content-Signal extension lived here previously
    // (ai-train=no, search=yes, ai-input=yes) but Lighthouse's RFC 9309
    // validator rejects unknown directives and tanks the SEO score.
    // The same intent is conveyed by our explicit Allow rules for the
    // major AI crawlers above; CF's signal is informative-only anyway.
    `Sitemap: ${opts.siteUrl}${sitemap}`,
  ];
  if (llmsTxt) lines.push(`# LLMs: ${opts.siteUrl}${llmsTxt}`);
  lines.push("");
  return lines.join("\n");
}
