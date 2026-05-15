/**
 * Vendor assets for konzert-haus. Consumed by `scripts/sync-assets.mjs` at
 * the repo root. The Google Fonts URL we previously loaded was:
 *   Cormorant Garamond  ital,wght@0/1,300;400;500;600
 *   DM Mono             ital,wght@0/1,300;400;500
 */
export default {
  htmx: true,
  fonts: [
    {
      pkg: "@fontsource/cormorant-garamond",
      css: [
        "300.css",
        "400.css",
        "500.css",
        "600.css",
        "300-italic.css",
        "400-italic.css",
        "500-italic.css",
        "600-italic.css",
      ],
      subsets: ["latin", "latin-ext"],
    },
    {
      pkg: "@fontsource/dm-mono",
      css: ["300.css", "400.css", "500.css", "300-italic.css", "400-italic.css", "500-italic.css"],
      subsets: ["latin", "latin-ext"],
    },
  ],
};
