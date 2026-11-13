/**
 * Every key the site keeps in the browser, spelt once. The privacy page lists
 * what they hold: the language and look the reader picked, and which exhibits
 * they tried. No cookies, no account, nothing sent anywhere.
 *
 * A key is never renamed: a renamed key reads as nothing on every device that
 * has used the site.
 */
export const STORAGE = {
  language: "staunlabor-lang",
  theme: "staunlabor-theme",
  /** Which exhibits were tried on this device (`features/experiments/tried.ts`). */
  experimentsTried: "staunlabor.experimentsTried",
  /** A prefix: a kit table's sort and page size, should a page ever show one. */
  tables: "staunlabor-table:",
} as const;
