/**
 * Every key the site keeps in the browser, spelt once. The privacy page lists
 * what they hold: the language and look the reader picked, which exhibits they
 * tried, and how far they are through the course. No cookies, no account,
 * nothing sent anywhere.
 *
 * A key is never renamed: a renamed key reads as nothing on every device that
 * has used the site.
 */
export const STORAGE = {
  language: "staunlabor-lang",
  theme: "staunlabor-theme",
  /** Which exhibits were tried on this device (`features/experiments/tried.ts`). */
  experimentsTried: "staunlabor.experimentsTried",
  /** The course's lessons opened, its exercises solved and the estimates made
   *  first, on this device (`features/course/progress.ts`). */
  courseProgress: "staunlabor.courseProgress",
  /** A prefix: a kit table's sort and page size, should a page ever show one. */
  tables: "staunlabor-table:",
  /** A prefix: the account's session, as `@eifi1/ui-kit/accounts` keeps it
   *  (`accountStorageEntries`: `staunlabor.session`), in the tab's storage on a
   *  computer marked shared, else on the device. */
  accounts: "staunlabor.",
} as const;
