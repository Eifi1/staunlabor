# Staunlabor

**Exponate zum Anfassen, nachgerechnet.** Hands-on exhibits, computed.

Staunlabor takes exhibits of the kind a science centre has — a ball floating
on a jet of air, a smoke ring pressed out of a drum, three balls dropped
stacked so that the small one shoots up — and lets you play the visitor in a
simulation of each, then shows the computation behind what you saw: the
equations of motion, how they are solved, and the one insight that explains
the trick. Every number comes from the site's own engine and is held by its
tests.

It is free, without an account and without ads, in seven languages, at
**https://staunlabor.app**.

## Run it

Node 26 and [uv](https://docs.astral.sh/uv/) (Python 3.14):

```bash
npm install
cd backend && uv sync && cd ..
npm run dev          # the API on :8002, the site on http://localhost:5176
npm run check        # everything CI runs
```

`CLAUDE.md` is the short guide to the code, `docs/experiments.md` the long one
to each exhibit, `deploy/README.md` how it is hosted. The exhibits were first
built as the experiments area of an engineering app and moved here on
2026-11-13 (`docs/plan.md`).

## Feedback

Something wrong, unclear, or an exhibit you would like to see? Open an issue:
https://github.com/Eifi1/staunlabor/issues

## Licence

The code is MIT (`LICENSE`); the texts and drawings are CC BY 4.0
(`LICENSE-CONTENT.md`). Staunlabor is independent and not affiliated with any
museum.
