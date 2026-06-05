import { createImageProxy } from "@museumsufer/core/image-proxy";

const ALLOWED_HOSTS = new Set([
  "aktuelles.uni-frankfurt.de",
  "denkbar-ffm.de",
  "frankfurt.deutsch-israelische-gesellschaft.de",
  "fgz-risc.uni-frankfurt.de",
  "hausamdom-frankfurt.de",
  "jg-ffm.de",
  "polytechnische.de",
  "sigmund-freud-institut.de",
  "www.evangelische-akademie.de",
  "www.ifs.uni-frankfurt.de",
  "www.literaturhaus-frankfurt.de",
  "www.openbooks-frankfurt.de",
  "www.romanfabrik.de",
  "wdc2026.org",
]);

export const { handleImageProxy, imageProxyUrl } = createImageProxy({
  userAgent: "lehrhaus/1.0 (+https://frankfurt.lehr.salon)",
  allowedHosts: ALLOWED_HOSTS,
  passthroughDisallowed: true,
});
