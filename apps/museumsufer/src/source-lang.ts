import { cityMeta } from "@museumsufer/core/cities";

/** Language a museum publishes its own texts in. Kept free of the scrape
 *  bundle so both the derive script and the worker can import it. */
export type SourceLang = "de" | "es";

/** Spanish cities publish Spanish; every other city German. */
export function sourceLangForCity(city: string | undefined): SourceLang {
  return cityMeta(city).country === "ES" ? "es" : "de";
}
