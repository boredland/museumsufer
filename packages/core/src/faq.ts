export interface FaqItem {
  q: string;
  a: string;
}

/** Build a Schema.org FAQPage JSON-LD object from question/answer pairs.
 *  Use as one of the page's structured-data scripts so search engines
 *  (and AI scrapers like isitagentready.com) can pick up the FAQ. */
export function buildFaqPageSchema(items: FaqItem[]): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };
}
