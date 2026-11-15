/**
 * Audience-participation and house-business formats that venues list in their
 * calendar but that are not programme in the sense of a concert, screening or
 * stage show: pub quizzes, bingo, karaoke, regulars' tables, advice hours,
 * room rentals, lunch service, closure notices. Labelling them `music:*` /
 * `stage:*` / `film:*` / `museum:*` surfaces them in the concert, theatre,
 * cinema and museum apps.
 *
 * Title-only on purpose: descriptions of real shows mention "Bingo" or "Quiz"
 * in passing. Stems that appear inside German compounds ("Punkerstammtisch",
 * "Beratungstag") are matched without a left word boundary; "Geschlossene
 * Gesellschaft" (a play) does not match `geschlossen` because a letter follows.
 */
const NON_PROGRAMME_RE =
  /stammtisch|sprechstunde|vermietung(?!sfrei)|mittagstisch|jobcenter|mitgliederversammlung|\bberatung\b|quiz(?!show|master|-?show)|\bbingo\b|\bkaraoke\b|\b(?:geschlossen|ruhetag|betriebsferien)(?![\p{L}\p{N}])/iu;

export function looksLikeNonProgramme(title: string): boolean {
  return NON_PROGRAMME_RE.test(title);
}

/** Namespaces that promise a performance/screening/exhibition-side programme item. */
const PROGRAMME_LABEL_RE = /^(?:music|film|stage|dance|museum):/;

/**
 * Removes programme labels from a non-programme title. Other namespaces
 * (`talk:*`, `event:*`, `landau:*`) are kept: a quiz night is still a dated
 * event, it just must not appear as a concert, film or play.
 */
export function dropNonProgrammeLabels<T extends { label: string }>(title: string, labels: readonly T[]): T[] {
  if (!looksLikeNonProgramme(title)) return [...labels];
  return labels.filter((l) => !PROGRAMME_LABEL_RE.test(l.label));
}

/**
 * Participation workshops at concert halls and festivals ("Workshop: Kosmos
 * Gamelan", "Workshop zur Konzertmitwirkung"). Real programme, but not a
 * concert: they must not carry a `music:<genre>` label. A title that merely
 * contains the word ("Konzert und Workshop") is still a concert.
 */
export function isWorkshopTitle(title: string): boolean {
  return /^\s*workshop\b/i.test(title);
}
