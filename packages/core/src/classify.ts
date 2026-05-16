/**
 * Compat re-export. The classifiers themselves now live in
 * `@museumsufer/classify`. New code should import from there directly;
 * this barrel exists so app code that still does
 * `import { classifyEvent } from "@museumsufer/core/classify"` keeps working.
 */
export { classifyEvent, detectTalkLanguage } from "@museumsufer/classify";
