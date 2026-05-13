/**
 * Vendor assets for frankfurt-museums. Consumed by `scripts/sync-assets.mjs`
 * at the repo root. The Google Fonts URL we previously loaded was:
 *   Fraunces ital,opsz,wght@0,9..144,400..600;1,9..144,400..600
 *   DM Sans  wght@400;500;600;700
 *   DM Mono  wght@400;500
 *
 * We bundle the latin + latin-ext subsets (German + most European text).
 */
export default {
  htmx: true,
  fonts: [
    {
      pkg: "@fontsource-variable/fraunces",
      css: ["standard.css", "standard-italic.css"],
      subsets: ["latin", "latin-ext"],
      familyAlias: ["Fraunces Variable", "Fraunces"],
    },
    {
      pkg: "@fontsource-variable/dm-sans",
      css: ["wght.css", "wght-italic.css"],
      subsets: ["latin", "latin-ext"],
      familyAlias: ["DM Sans Variable", "DM Sans"],
    },
    {
      pkg: "@fontsource/dm-mono",
      css: ["400.css", "500.css"],
      subsets: ["latin", "latin-ext"],
    },
  ],
};
