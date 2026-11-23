/**
 * The addresses of the site's own pages, spelt once: the routes, the header,
 * the footer, the search and the account's client read them here, where each
 * wrote its own and a moved page was a hunt. The exhibits' and the course's
 * are with them (`EXHIBITS_PATH` in `exhibits.ts`, `LESSONS` in
 * `course/lessons.ts`).
 */
export const SITE_PATHS = {
  about: "/about",
  imprint: "/impressum",
  privacy: "/privacy",
  /** The kit's sign-in page: where `accountRouteElements` mounts it, and where
   *  `RequireSession` and the accounts client send a reader by default. */
  login: "/login",
} as const;

/** The account's pages, the only ones that need a session: every other page
 *  is open to every visitor, the exhibits above all (`docs/plan.md`, second
 *  stage: the open site first). */
export const ACCOUNT_PATHS = {
  settings: "/settings",
  admin: "/admin",
  feedback: "/feedback",
  myFeedback: "/my-feedback",
  translations: "/translations",
} as const;

export type AccountPage = keyof typeof ACCOUNT_PATHS;

/** The pages a session that ends sends to the sign-in (`accounts.ts`). */
export const PRIVATE_PATHS: readonly string[] = Object.values(ACCOUNT_PATHS);
