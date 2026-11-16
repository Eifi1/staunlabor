# The plan: Staunlabor, from the experiments area to a site of its own

Staunlabor's eight exhibits were first built as the public "Experiments" area
of an engineering app (setpoint curves for test rigs, control, a course on
differential equations). They hold nothing of anybody's and need no account,
so they move to a site of their own: free, open source, without accounts,
without a database.

## Decisions (2026-11-13)

- **Scope:** the experiments only, not the course they link to; the course
  lessons a page names become plain explanations or links out.
- **Free, and open:** a public repository. Code under MIT, texts and drawings
  under CC BY 4.0 (`LICENSE`, `LICENSE-CONTENT.md`).
- **Name and address:** Staunlabor, `staunlabor.app`.
- **Not commercial,** and not affiliated with the museum whose exhibits
  inspired it; it names that museum as its model in one line, with no logo and
  no photo.

## The site

- **The front page is the overview:** the experiment of the day, playing by
  itself; the earlier days on request; every exhibit, filtered by topic,
  ticked once tried on this device.
- **Eight exhibits,** each page in the same shape: at the exhibit, try it
  (the exhibit's twin), what happens, how it is computed, the trick.
  - the chair seen through a peephole;
  - the magnet car through a coil;
  - the ball pumped round a hanging sphere;
  - the spinning platform;
  - the race of six curves;
  - the Bernoulli elephant;
  - the smoke ring;
  - the ball cannon.
- **Seven languages:** de-CH (the fallback), en, es, fr, it, hu, zh.
- **What the browser keeps:** the language, the light or dark theme, and
  which exhibits were tried. No cookies, no account, no tracking.
- **Feedback** through this repository's issues.
- **Legal pages:** an imprint and a short privacy policy.

## How it is built

The stack of the apps it comes from, so the same people and tools work on it:

- **Backend:** FastAPI with the exhibits' engine (`domain/experiments/`, pure
  functions over floats, the standard library only), no database. It answers
  the public computations within a request budget.
- **Frontend:** React and Vite on `@eifi1/ui-kit`, with the time loops ported
  to the browser and held to the engine by shared reference cases.
- **The kits:** `@eifi1/ui-kit` (npm) and `eifi1-server-kit` (a wheel pinned
  by sha256). Both are public and MIT, so this repository builds without
  secrets.
- **Checks:** Conventional Commits, a pre-push hook running the whole check,
  CI and releases through `Eifi1/shared-workflows`.
- **Hosting:** Google Cloud Run in the project `staunlabor`, scaled to zero.
  It is deployed from `main` by a GitHub workflow that signs in without a key
  (Workload Identity Federation, limited to this repository's `main`). The
  build runs as an account with only the rights a deploy needs; the web
  service runs as one with none.

## Steps

1. **The repository:** licences, README, this plan. *(done)*
2. **The skeleton:** *(done)*
   - backend and frontend workspaces, the kits, lint, format and types;
   - the test runners, the check script, the hook, CI and the release workflow;
   - CLAUDE.md and `docs/`.
3. **The exhibits:** *(done)*
   - the engine and its tests;
   - the browser ports and their reference cases;
   - the eight pages and the overview, the daily pick;
   - the seven catalogues and the docs on each exhibit.
4. **The frame:** *(done)*
   - a header with the language and theme;
   - the overview as the front page;
   - the about page with the credit, the imprint and the privacy policy;
   - the 404 page, SEO and the icons.
5. **The deploy:** *(done 2026-11-13: v0.1.3 on https://staunlabor.app)*
   - the Artifact Registry repository and the service accounts;
   - Workload Identity Federation for GitHub;
   - Cloud Build;
   - the domain mapped through Cloudflare.
6. **The old address:** *(done 2026-11-13: Kurvenschmiede v0.4.0)* the engineering app's experiments area redirects to
   `staunlabor.app` and is then removed there.

## The second stage: accounts, feedback and the translation review (decided 2026-11-13)

Native readers should review the five machine-translated languages on the same
page the sibling apps use, and visitors should be able to give feedback the
same way. Both need to know who someone is, so the site gets accounts and a
database. Until it ships, the live site stays without both, and the pages that
say so stay as they are.

- **The database:** a database of its own, `staunlabor`, on the shared Cloud
  SQL instance `keksdose:europe-west4:keksdose-db`, the way Kastlan does it:
  an owner role for the migrations, a DML-only app role for the service, the
  URLs in Secret Manager, migrations as a Cloud Run job. The instance is a
  db-f1-micro of about 22 usable connections shared by every app on it, and
  every app gets the same cap: one connection and one more per instance, a
  request waiting at most 10 s for one (the owner, 2026-11-13; it was 2 + 2).
- **Accounts as in Keksdose, Kastlan and Kurvenschmiede,** on the same kit
  parts. Visitors still need none to use the exhibits.
- **The scope of Kurvenschmiede:** public feedback (comments, votes, the public
  list), passkeys, the data export and account deletion, the mail switches, the
  reviewer role and `/translations`. No teams (Marcel confirmed it again on
  2026-11-15), no billing, no demo.
- **Two-factor sign-in as an option (Marcel, 2026-11-15):** every account may
  switch it on in its settings, none has to; server-kit 0.32's authenticator
  codes, ten backup codes, and an admin's reset for a lost authenticator. Its
  secrets are sealed under a key of the deployment's own
  (`STAUNLABOR_TOTP_KEYS`).
- **What comes first (Marcel, 2026-11-14):** the site stays open to every
  visitor, exhibits and all, with no account; that matters most. Accounts stay
  invitation-only, so a visitor gives no feedback unless invited; an open
  sign-up or an anonymous form would need its own spam protection and is not
  planned. Feedback is not a priority now: the reviewer's `/translations` comes
  before it.
- **Mail through Resend,** in the account the sibling apps send from: its plan
  verifies three domains, and Kastlan, taken offline on 2026-11-13 for the
  time being, gave its place to `staunlabor.app` (region Ireland, sending
  access for this domain only). Until the domain is verified the console
  backend stands in: the admin page shows an invitation's or a reset's link
  once, to be handed on in person.
- **The kit first:** feedback and the translation review mount the
  server-kit's routers (Layer 2). Accounts and user administration are asked of
  the kit as a Layer 2 of their own before anything is written here, so the
  site does not become a fourth copy of the same sign-in code; Staunlabor is
  its first user.
- **The request budget's proof:** the edge token Keksdose uses, once the
  server-kit carries it (0.28); the internal ingress stays only if a cold start
  keeps its first `/api` request.

Steps, each its own commits:

1. The database's ground: the engine, Alembic, a Postgres database per test
   worker, `npm run db:setup`, CI's Postgres. *(on `feat/accounts`: the engine
   and the request's unit of work, the kit's `[sql]` tables, migration 0001 and
   its check against the models, a database per test worker, `npm run
   db:migrate`, a Postgres service in CI's backend job, not yet run on GitHub)*
2. Accounts and user administration on the kit's Layer 2. *(on
   `feat/accounts`: server-kit 0.30's `auth_router`,
   `invitations_admin_router` and `user_admin_router` behind one admin guard,
   with the kit's signer and hasher; invitation-only with the first admin
   through the allow-list, an invitation naming a MEMBER or a REVIEWER and an
   admin made by a role change in the roster; the reviewer's seven languages
   and the areas `experiments` and `legal`; an operator's erasure of an
   account that asked; passkeys; the console transport, the whole mail on a
   laptop and its kind alone on a deployment; every route under the address
   budget; the kit's contract checks on PostgreSQL. On server-kit 0.31: the
   kit's daily call, `POST /api/v1/ops/accounts/daily` behind the jobs token,
   deleting ended sessions, expired links and invitations 30 days after, not
   yet scheduled. On server-kit 0.32: two-factor sign-in, offered and never
   required, on the account's row, migration 0004.)*
3. Feedback and the translation review on the kit's routers. *(feedback on
   `feat/accounts`: server-kit 0.31's `feedback_router` on `feedback.sql`'s
   tables, migration 0002, the kit's contract suites on PostgreSQL; files in a
   local directory until a bucket; the planned exhibits filed as ideas. The
   review too: `translation_review_router` on `translation_review.sql`'s table,
   migration 0003, an admin every language, a reviewer what an admin granted.)*
4. The pages: sign-in, settings, admin, feedback, `/translations`.
5. The texts: the privacy policy, the terms, the about page, in all seven.
   The privacy policy names the 30 days an ended session keeps its address
   (server-kit's `ACCOUNT_ROWS_RETENTION`). *(the privacy policy and the about
   page rewritten on 2026-11-15: the exhibits without an account, what an
   account keeps, the sealed second factor, Resend, the 30 days, and what an
   erasure anonymises and deletes — the person's feedback files too, which an
   erasure now removes from the store. Marcel, the same day: the erasure runs
   by itself, 30 days after the request, in the daily call; no terms page, but
   one sentence under the translation review and the feedback pages that a
   contribution is sent under CC BY 4.0.)*
6. The deploy: the database and its roles on keksdose-db, the secrets, the
   migrate job, the bucket for feedback files, the daily call's scheduler job
   and its token (`deploy/README.md` §6).
