/**
 * Vendor assets for frankfurt-theaters. Consumed by `scripts/sync-assets.mjs`
 * at the repo root. The Google Fonts URL we previously loaded was:
 *   Fraunces        opsz,wght,SOFT,WONK@9..144,300..900,0..100,0..1
 *   JetBrains Mono  wght@400;500;700
 *
 * Theaters uses Fraunces with the full axis set (incl. SOFT + WONK), so
 * we bundle the `full.css` variant.
 */
export default {
  htmx: true,
  fonts: [
    {
      pkg: "@fontsource-variable/fraunces",
      css: ["full.css", "full-italic.css"],
      subsets: ["latin", "latin-ext"],
      familyAlias: ["Fraunces Variable", "Fraunces"],
    },
    {
      pkg: "@fontsource-variable/jetbrains-mono",
      css: ["wght.css", "wght-italic.css"],
      subsets: ["latin", "latin-ext"],
      familyAlias: ["JetBrains Mono Variable", "JetBrains Mono"],
    },
  ],
};
