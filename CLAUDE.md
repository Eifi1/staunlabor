# CLAUDE.md

Guidance for Claude Code in this repository. Read the document a change
touches before making it:

* [`docs/experiments.md`](docs/experiments.md) — each exhibit: what it is, how
  it is modelled, what checking the models found, the overview and the daily
  pick;
* [`docs/translations.md`](docs/translations.md) — the seven languages, who
  wrote which, what a reviewer should look at;
* [`docs/plan.md`](docs/plan.md) — the decisions this site was set up on;
* [`deploy/README.md`](deploy/README.md) — Cloud Run, the accounts, the domain.

Keep this file short: a rule here is a line or two, and its reasons go in the
document it points to.

## What this is

**Staunlabor** (staunlabor.app): hands-on exhibits, computed. Eight exhibits,
each a page in one shape (at the exhibit, try it, what happens, how it is
computed, the trick), and an overview with the experiment of the day. Free,
open source (code MIT, texts and drawings CC BY 4.0), **no accounts, no
database, no cookies, no tracking**. A FastAPI backend holds the exhibits'
engine behind a few public routes; a React SPA on `@eifi1/ui-kit` draws them.
It began as the "Experiments" area of Kurvenschmiede (`../kurvenschmiede`),
whose differential-equations course the pages still link to at
`https://kurvenschmiede.app/dynamics/...`.

**The museum is the model, never the source.** The exhibits are *inspired by*
exhibits at the Swiss Science Center Technorama; the site says so in one line
("inspired by"), never "from the Technorama" or "aus dem Technorama", uses no
logo, photo or text of theirs, and every drawing is its own.
`catalogues.test.ts` holds the German credit to it.

## Commands

From the repo root.

| Command | What it does |
| --- | --- |
| `npm install` | The workspace, `@eifi1/ui-kit` included |
| `npm run dev` | The API (`:8002`) and the site (`:5176`) |
| `npm run check` | Everything CI runs, all blocking (the pre-push hook runs it): the five below, in order |
| `npm run check:versioning` | The versions agree across the release's files; the branch's commits are Conventional Commits |
| `npm run check:security` | server-kit's dependency audit + `npm audit --audit-level=high` |
| `npm run check:deadcode` | vulture and ts-prune against their baselines (empty, and to stay so) |
| `npm run check:frontend` | prettier + eslint + tsc + vitest with coverage + build |
| `npm run check:backend` | `scripts/check-backend.sh`: ruff check + ruff format + pytest with coverage |
| `npm run format` | Prettier rewrites the frontend (120 columns) |

```bash
cd backend && uv run pytest tests/unit/test_experiments.py -q
cd frontend && npx vitest run src/features/experiments/daily.test.ts
cd backend && uv run python ../scripts/write-experiments-cases.py         # after an engine change
```

Coverage floors: `test.coverage.thresholds` in `frontend/vite.config.ts` and
`fail_under` in `backend/pyproject.toml`; quote them from the config.

## Architecture

```
backend/staunlabor/
  domain/experiments/   the engine: pure functions over floats, the standard
                        library only; raises ValueError, which main.py makes a 400
  domain/schemas/       pydantic wire shapes with the per-field bounds
  api/                  the routes: shapes in, schemas out, no physics
  security.py           the one request budget, per address
frontend/src/
  app/                  routes (every page but the overview lazy), router link
  features/experiments/ the pages, the views, the overview, the daily pick,
                        simulate/ (the time loops, ported from the engine)
  features/site/        the footer, the about page, the imprint, the privacy policy
  shared/               api, i18n, state, charts, ui, lib (storage-keys.ts)
```

## Rules

* **The engine stays pure** and is the authority. A number on a page is the
  engine's: the time loops that must answer a hand at 60 frames a second are
  ported to `simulate/` and **held to the engine** by
  `scripts/write-experiments-cases.py` → `engine-cases.json`, checked from
  both sides (`tests/unit/test_experiments_browser.py`, `simulate.test.ts`).
  Change both sides and rewrite the cases in one commit.
* **The prose states only what a test asserts**: a figure in a catalogue
  sentence is one `tests/unit/test_experiments.py` checks.
* **No formula stands alone**: every one is an `Equation` with a sentence and
  a legend of its symbols with units.
* **Every route is public**, so every route's cost is a stranger's: new
  routes go under the budget in `security.py`.
* **Seven languages** (`de-CH` formal, Swiss spelling, the fallback; `en`,
  `es`, `fr`, `it`, `hu`, `zh`): every visible string is a key in all seven;
  a new wording gets a line in `docs/translations.md`.
* **Every key the browser stores** is spelt once in
  `shared/lib/storage-keys.ts` and listed on the privacy page.
* **Reuse the kits before writing anything**: `@eifi1/ui-kit` (npm) for every
  component, the legal pages and the language menu; `eifi1-server-kit` (a wheel
  pinned by URL and sha256 in `uv.lock`) for the limiter and the error
  handlers. What the kit lacks is an ask upstream.
* **It works on a phone**: a grid says `grid-cols-1` before its breakpoint;
  check a page at 390 px and 360 px. One appearance, light and dark.
* **Conventional Commits**, headers of at most 100 characters; a release is
  cut by `release.yml` on main, a deploy is `deploy.yml`, by hand.

## Style

Comments explain **why** and name the failure the code prevents; a module's
docstring says what it is for and what it deliberately does not do. Tests are
named as sentences about behaviour. The frontend is formatted by Prettier and
linted by eslint (the React Compiler's lint rules on, the compiler off); the
backend by ruff.
