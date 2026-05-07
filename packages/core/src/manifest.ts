/**
 * PWA web app manifest builder. Both apps emit a JSON string with the same
 * top-level fields — only the brand strings, palette, and optional
 * screenshots differ.
 */
export interface ManifestIcon {
  src: string;
  sizes: string;
  type: string;
  purpose?: string;
}

export interface ManifestScreenshot {
  src: string;
  sizes: string;
  type: string;
  form_factor?: "wide" | "narrow";
  label?: string;
}

export interface ManifestOptions {
  name: string;
  shortName: string;
  description: string;
  themeColor: string;
  backgroundColor: string;
  /** Override the default `/` start URL. */
  startUrl?: string;
  /** Override the default `standalone` display mode. */
  display?: "standalone" | "fullscreen" | "minimal-ui" | "browser";
  lang?: string;
  /** Defaults to the standard SVG favicon + 192/512 PNG triple. */
  icons?: ManifestIcon[];
  screenshots?: ManifestScreenshot[];
}

const DEFAULT_ICONS: ManifestIcon[] = [
  { src: "/favicon.svg", sizes: "any", type: "image/svg+xml" },
  { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
  { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
];

export function buildManifest(opts: ManifestOptions): string {
  const manifest: Record<string, unknown> = {
    id: opts.startUrl ?? "/",
    name: opts.name,
    short_name: opts.shortName,
    description: opts.description,
    start_url: opts.startUrl ?? "/",
    display: opts.display ?? "standalone",
    background_color: opts.backgroundColor,
    theme_color: opts.themeColor,
    icons: opts.icons ?? DEFAULT_ICONS,
  };
  if (opts.lang) manifest.lang = opts.lang;
  if (opts.screenshots) manifest.screenshots = opts.screenshots;
  return JSON.stringify(manifest);
}
