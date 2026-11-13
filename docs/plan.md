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
2. **The skeleton:**
   - backend and frontend workspaces, the kits, lint, format and types;
   - the test runners, the check script, the hook, CI and the release workflow;
   - CLAUDE.md and `docs/`.
3. **The exhibits:**
   - the engine and its tests;
   - the browser ports and their reference cases;
   - the eight pages and the overview, the daily pick;
   - the seven catalogues and the docs on each exhibit.
4. **The frame:**
   - a header with the language and theme;
   - the overview as the front page;
   - the about page with the credit, the imprint and the privacy policy;
   - the 404 page, SEO and the icons.
5. **The deploy:**
   - the Artifact Registry repository and the service accounts;
   - Workload Identity Federation for GitHub;
   - Cloud Build;
   - the domain mapped through Cloudflare.
6. **The old address:** the engineering app's experiments area redirects to
   `staunlabor.app` and is then removed there.
