/**
 * Vendor assets for landau-today. Consumed by `scripts/sync-assets.mjs` at
 * the repo root. The Google Fonts URL we previously loaded was:
 *   Bodoni Moda     ital,opsz,wght@0/1,6..96,400;500;600;800
 *   Bodoni Moda SC  opsz,wght@6..96,400 + occasional 500/600
 *   Newsreader      ital,opsz,wght@0/1,6..72,300;400;500;600
 */
export default {
  htmx: true,
  fonts: [
    {
      pkg: "@fontsource-variable/bodoni-moda",
      css: ["standard.css", "standard-italic.css"],
      subsets: ["latin", "latin-ext"],
      familyAlias: ["Bodoni Moda Variable", "Bodoni Moda"],
    },
    {
      pkg: "@fontsource/bodoni-moda-sc",
      css: ["400.css", "500.css", "600.css"],
      subsets: ["latin", "latin-ext"],
    },
    {
      pkg: "@fontsource-variable/newsreader",
      css: ["standard.css", "standard-italic.css"],
      subsets: ["latin", "latin-ext"],
      familyAlias: ["Newsreader Variable", "Newsreader"],
    },
  ],
};
