/**
 * The one figure in the front page's band of figures that the page cannot
 * count as it runs: how many equations the exhibits' pages write out, each an
 * `Equation` with its sentence and its legend. Counting them live would mean
 * loading every page. `facts.test.ts` counts them in the pages' sources and
 * fails while this number is not that count, so a page that gains or loses an
 * equation brings its figure along. The check section's formulas are not
 * counted: they are the cases a calculation is checked against, not the page's.
 *
 * The other figures are counted where the page runs: the exhibits and
 * their topics from `exhibits.ts`, the languages from `languages.ts`, and the
 * checked exhibits from the server's answer.
 */
export const EQUATION_COUNT = 227;
