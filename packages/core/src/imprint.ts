/**
 * German legal-imprint boilerplate (TMG §5 + MStV §18) shared by all
 * four apps. Each app's `/impressum` route varies in wrapper markup
 * (Tailwind vs BEM vs string templates), so we lift only the section
 * *data* — every app iterates this and emits its own JSX/HTML.
 *
 * Translations are the responsibility of each app's i18n.ts. The labels
 * here are the German source-of-truth; downstream renderers can swap
 * them via the `labels` argument if they support EN/FR imprints.
 */

export interface ImprintOperator {
  name: string;
  email: string;
  city: string;
}

export interface ImprintLabels {
  provider: string;
  contact: string;
  responsible: string;
  dataSource: string;
  disclaimer: string;
  source: string;
}

export const GERMAN_IMPRINT_LABELS: ImprintLabels = {
  provider: "Anbieter (TMG §5)",
  contact: "Kontakt",
  responsible: "Inhaltlich Verantwortlicher gemäß §18 Abs. 2 MStV",
  dataSource: "Datenherkunft",
  disclaimer: "Haftungsausschluss",
  source: "Quellcode",
};

/**
 * Standard German liability-disclaimer copy. The same paragraph is on
 * every German "Impressum" page in this monorepo.
 */
export const GERMAN_DISCLAIMER_COPY =
  "Trotz sorgfältiger inhaltlicher Kontrolle übernehmen wir keine Haftung für die Inhalte externer Links. " +
  "Für den Inhalt der verlinkten Seiten sind ausschließlich deren Betreiber verantwortlich.";

export interface ImprintSection {
  /** Section heading (e.g. "Anbieter (TMG §5)"). */
  heading: string;
  /** Section body lines. Renderers join with <br> or newlines as needed. */
  body: string[];
  /** Optional links rendered inside the section (used for mailto + source). */
  links?: Array<{ href: string; label: string; external?: boolean }>;
}

export interface BuildImprintOptions {
  operator: ImprintOperator;
  /** App-specific paragraph describing where data comes from. */
  dataSourceCopy: string;
  /** Override the German liability boilerplate. */
  disclaimerCopy?: string;
  /** GitHub URL pointing at the app's source tree. */
  sourceUrl: string;
  /** Override section headings (e.g. for EN/FR locales). */
  labels?: ImprintLabels;
}

export function buildImprintSections(opts: BuildImprintOptions): ImprintSection[] {
  const labels = opts.labels ?? GERMAN_IMPRINT_LABELS;
  return [
    {
      heading: labels.provider,
      body: [opts.operator.name, opts.operator.city],
    },
    {
      heading: labels.contact,
      body: [],
      links: [{ href: `mailto:${opts.operator.email}`, label: opts.operator.email }],
    },
    {
      heading: labels.responsible,
      body: [`${opts.operator.name}, ${opts.operator.city}`],
    },
    {
      heading: labels.dataSource,
      body: [opts.dataSourceCopy],
    },
    {
      heading: labels.disclaimer,
      body: [opts.disclaimerCopy ?? GERMAN_DISCLAIMER_COPY],
    },
    {
      heading: labels.source,
      body: [],
      links: [{ href: opts.sourceUrl, label: opts.sourceUrl.replace(/^https?:\/\//, ""), external: true }],
    },
  ];
}
