/**
 * Shared <head> renderer. Standard charset/viewport/title/canonical and
 * OG/Twitter meta + icons + manifest are always emitted; variation (
 * hreflangs, theme-color, alternate feeds, extra scripts, JSON-LD) rides
 * along via props. App-specific stylesheet strategy is handled by either
 * `inlineCss` (inlined as <style>) or `stylesheetHref` (linked).
 */
import { jsonLdSafe } from "./escape";
import { THEME_FOUC_SCRIPT } from "./theme-script";

export interface HtmlHeadIconSet {
  /** Vector favicon — most apps ship one as /favicon.svg. */
  svg?: string;
  /** 192x192 PNG icon (museums uses a coloured raster fallback). */
  png192?: string;
  /** Apple touch icon for iOS home-screen. */
  appleTouch?: string;
}

export interface HtmlHeadThemeColor {
  content: string;
  media?: string;
}

export interface HtmlHeadAlternate {
  rel: string;
  href: string;
  type?: string;
  title?: string;
}

export interface HtmlHeadTwitter {
  title?: string;
  description?: string;
  image?: string;
}

export interface HtmlHeadProps {
  title: string;
  description: string;
  canonical: string;
  ogImage: string;
  /** `de_DE`, `en_GB`, `fr_FR`. Defaults to `de_DE`. */
  ogLocale?: string;
  ogSiteName?: string;
  /** Optional og:image:width / og:image:height. */
  ogImageSize?: { width: number; height: number };
  twitterCard?: "summary_large_image" | "summary";
  /** When provided, mirrors title/description/ogImage onto twitter:* meta. */
  twitter?: HtmlHeadTwitter;
  hreflangs?: Array<{ hreflang: string; href: string }>;
  themeColor?: string | HtmlHeadThemeColor[];
  icons?: HtmlHeadIconSet;
  /** RSS / iCal / API catalog etc. */
  alternates?: HtmlHeadAlternate[];
  /** Embed via <style>. Mutually exclusive with `stylesheetHref` in practice. */
  inlineCss?: string;
  /** External CSS path (e.g. "/styles.css" — landau ships its CSS linked, not inlined). */
  stylesheetHref?: string;
  /** Defer-loaded scripts (typically "/htmx.min.js", optionally "/client.js"). */
  deferScripts?: string[];
  /** JSON-LD blobs. Pass objects or pre-stringified JSON. */
  jsonLd?: Array<Record<string, unknown> | string>;
  /** Self-hosted fonts entrypoint. Defaults to "/fonts.css". */
  fontsHref?: string;
  /** Web manifest path. Defaults to "/manifest.json". */
  manifestHref?: string;
}

function ldString(j: Record<string, unknown> | string): string {
  return typeof j === "string" ? j : jsonLdSafe(j);
}

export function HtmlHead(props: HtmlHeadProps) {
  const {
    title,
    description,
    canonical,
    ogImage,
    ogLocale = "de_DE",
    ogSiteName,
    ogImageSize,
    twitterCard = "summary_large_image",
    twitter,
    hreflangs,
    themeColor,
    icons,
    alternates,
    inlineCss,
    stylesheetHref,
    deferScripts,
    jsonLd,
    fontsHref = "/fonts.css",
    manifestHref = "/manifest.json",
  } = props;

  const themeColors: HtmlHeadThemeColor[] = !themeColor
    ? []
    : typeof themeColor === "string"
      ? [{ content: themeColor }]
      : themeColor;

  return (
    <>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <script dangerouslySetInnerHTML={{ __html: THEME_FOUC_SCRIPT }} />
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonical} />
      {hreflangs?.map((h) => (
        <link key={`hreflang-${h.hreflang}`} rel="alternate" hreflang={h.hreflang} href={h.href} />
      ))}
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content="website" />
      <meta property="og:url" content={canonical} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:locale" content={ogLocale} />
      {ogSiteName ? <meta property="og:site_name" content={ogSiteName} /> : null}
      {ogImageSize ? (
        <>
          <meta property="og:image:width" content={String(ogImageSize.width)} />
          <meta property="og:image:height" content={String(ogImageSize.height)} />
        </>
      ) : null}
      <meta name="twitter:card" content={twitterCard} />
      {twitter?.title ? <meta name="twitter:title" content={twitter.title} /> : null}
      {twitter?.description ? <meta name="twitter:description" content={twitter.description} /> : null}
      {twitter?.image ? <meta name="twitter:image" content={twitter.image} /> : null}
      {themeColors.map((tc, i) => (
        <meta key={`theme-color-${i}`} name="theme-color" content={tc.content} media={tc.media} />
      ))}
      {icons?.svg ? <link rel="icon" href={icons.svg} type="image/svg+xml" /> : null}
      {icons?.png192 ? <link rel="icon" href={icons.png192} type="image/png" sizes="192x192" /> : null}
      {icons?.appleTouch ? <link rel="apple-touch-icon" href={icons.appleTouch} /> : null}
      <link rel="manifest" href={manifestHref} />
      {alternates?.map((a) => (
        <link key={`${a.rel}-${a.href}`} rel={a.rel} href={a.href} type={a.type} title={a.title} />
      ))}
      <link rel="stylesheet" href={fontsHref} />
      {stylesheetHref ? <link rel="stylesheet" href={stylesheetHref} /> : null}
      {inlineCss ? <style dangerouslySetInnerHTML={{ __html: inlineCss }} /> : null}
      {deferScripts?.map((src) => (
        <script key={`script-${src}`} src={src} defer />
      ))}
      {jsonLd?.map((j, i) => (
        <script key={`jsonld-${i}`} type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldString(j) }} />
      ))}
    </>
  );
}
