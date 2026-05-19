import { createImageProxy } from "@museumsufer/core/image-proxy";
import { USER_AGENT } from "./shared";

const ALLOWED_HOSTS = new Set([
  "www.landau.de",
  "kulturnetz-landau.de",
  "www.suedlicheweinstrasse.de",
  "www.pfalz.de",
  "hambacher-schloss.de",
]);

export const { handleImageProxy, imageProxyUrl } = createImageProxy({
  userAgent: USER_AGENT,
  allowedHosts: ALLOWED_HOSTS,
  passthroughDisallowed: true,
});
