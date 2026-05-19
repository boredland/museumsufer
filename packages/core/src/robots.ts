/**
 * Worker-side `robots.txt` body. Bot allow/disallow rules and Content-Signal
 * directives are owned by Cloudflare's AI Audit "Managed robots.txt" feature
 * (per-zone toggle), which prepends a `# BEGIN Cloudflare Managed content`
 * block before this body. Duplicating per-bot rules here would contradict
 * that block — so we contribute only sitemap discovery and the llms.txt
 * pointer, which CF doesn't emit.
 */
export interface RobotsTxtOptions {
  siteUrl: string;
  /** Path of the llms.txt file (defaults to `/llms.txt`). Set to null to omit. */
  llmsTxtPath?: string | null;
  /** Path of the sitemap (defaults to `/sitemap.xml`). */
  sitemapPath?: string;
  /** Extra `Disallow:` paths to emit under a wildcard `User-agent: *`
   *  block. The Cloudflare Managed block sits above this body and
   *  only owns the per-AI-bot rules; app-specific Disallows (e.g.
   *  `/api/`) belong here and Googlebot/Bingbot honour them. */
  disallow?: string[];
}

export function buildRobotsTxt(opts: RobotsTxtOptions): string {
  const sitemap = opts.sitemapPath ?? "/sitemap.xml";
  const llmsTxt = opts.llmsTxtPath === undefined ? "/llms.txt" : opts.llmsTxtPath;
  const lines: string[] = [];
  if (opts.disallow && opts.disallow.length > 0) {
    lines.push("User-agent: *");
    for (const path of opts.disallow) lines.push(`Disallow: ${path}`);
    lines.push("");
  }
  lines.push(`Sitemap: ${opts.siteUrl}${sitemap}`);
  if (llmsTxt) lines.push(`# LLMs: ${opts.siteUrl}${llmsTxt}`);
  lines.push("");
  return lines.join("\n");
}
