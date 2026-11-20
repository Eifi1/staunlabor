# The basics: the differential-equations course

`/basics` is the course every exhibit's computation stands on: lessons 0–6
and a cheat sheet on differential equations of technical systems, with an
engine (`backend/staunlabor/domain/course/`) that computes every number on
them. It moved in from Kurvenschmiede on 2026-11-20 (Marcel: "Grundlagen
sollte keine Weiterleitung auf Kurvenschmiede haben, sondern nimm alle
relevanten Dinge aus dem Repo und füge sie ins Staunlabor ein. Das wird aus
Kurvenschmiede entfernt."), as `docs/plan.md` ("The third stage") had
decided the day before: the basics move, the test rigs stay. Kurvenschmiede
keeps its lessons 7–10 (the reduction, the worm rig, the vacuum, the valve)
and its explorer, and its own copies of everything they share with these.

Its history before the move, how it was built from the specification "DGL-
Lernapp – Spezifikation 1.0" and what checking its mathematics found, is in
Kurvenschmiede's `docs/dynamics-course.md`; the parts that concern these
lessons are summed up below.

## What moved, and where to

| Lesson | Address | Page |
| --- | --- | --- |
| 0 The recipe (the course's front page) | `/basics` | `features/course/overview-page.tsx` |
| 1 First-order systems | `/basics/first-order` | `lesson-first-order.tsx` |
| 2 Second-order systems | `/basics/second-order` | `lesson-second-order.tsx` |
| 3 Eigenvalues and the pole plane | `/basics/eigenvalues` | `lesson-eigenvalues.tsx` |
| 4 Laplace and Bode | `/basics/laplace` | `lesson-laplace.tsx` |
| 5 Numerical solution | `/basics/numerics` | `lesson-numerics.tsx` |
| 6 The two-mass oscillator | `/basics/two-mass` | `lesson-two-mass.tsx` |
| The cheat sheet (no number) | `/basics/cheat-sheet` | `cheat-sheet.tsx` |

The cheat sheet was lesson 11 there; here it follows lesson 6 without a
number, being a page to look things up on rather than a lesson (the lead's
recommendation, which Marcel took on 2026-11-20). The old addresses (`kurvenschmiede.app/dynamics/…`)
are to redirect here once this site has deployed; Kurvenschmiede does that on
its side, on Marcel's go, and has the map.

* **Front end**: the pages and their helpers in `frontend/src/features/course/`
  (the helpers copied, since Kurvenschmiede's rigs use them too), the types in
  `shared/types/course.ts`, the calls in `shared/api/endpoints.ts`
  (`courseApi`), the words under `course.*` in all seven catalogues (each
  language's own text from Kurvenschmiede's), the reader's progress in the
  browser (`staunlabor.courseProgress`, on the privacy page). Readers' progress
  on kurvenschmiede.app does not carry over: storage belongs to its origin.
* **Engine**: `domain/course/` (linear algebra, the integrators, transfer
  functions, the chain, the first- and second-order systems, eigenvalues,
  frequency responses, numerics, the two-mass oscillator, the exercises of
  lessons 0–6), pure and the standard library only, like the exhibits'.
  No exhibit imports it, so no exhibit's check depends on it.
* **Routes**: under `/api/v1/course/`, wire-compatible with Kurvenschmiede's
  `/dynamics/` ones (`api/course_router.py`). The sixteen that compute spend
  the exhibits' budget (`EXPERIMENT_RUNS`, 90 in ten seconds per address),
  one window for both, so a reader on both kinds of page cannot compute twice
  as much; `/course/defaults` spends none.
* **Two fixes on the way**, which Kurvenschmiede's copy still lacks (told on
  2026-11-20): the compensation test refuses a record over 70'000 samples
  (`two_mass.MAX_SAMPLES`, the lesson's own slider corner, about 130 ms),
  where the schema's bounds let one public request ask for 14 million; and a
  chain's poles are found block by block, so two equal second-order blocks no
  longer make the eigenvalue iteration give up with a 400.
* **Tests**: the engine's reference values and its cross-checks
  (`tests/unit/test_course.py`), the routes (`tests/api/test_course_api.py`),
  the pages (`features/course/course.test.tsx`, `course-controls.test.tsx`)
  against `features/course/test-fixtures.json`, which
  `scripts/write-course-fixtures.py` writes from the engine.

## What was cut on the way

Everything that pointed at what stayed in Kurvenschmiede, so nothing here
links there:

* lesson 0's tile for the explorer, and the explorer's words;
* the cheat sheet's formula blocks for the reduction, the vacuum and the valve
  (lessons 7, 9 and 10 there), each of which linked to its lesson;
* the exercises of lessons 7–10, their words and their worked solutions;
* in `course.recipe.hint`, "vom Tank unten bis zum Ventil in Lektion 10";
* in `course.overview.why`, the first sentence, which pointed at
  Kurvenschmiede's control page; the rest now opens with "Hinter jedem
  Exponat steht eine Differenzialgleichung."

* the cheat sheet's traps "location", "efficiency" and "motor", which summed
  up what lessons 7–8 taught (Marcel took the recommendation to cut them,
  2026-11-20); "inertia" and "filter", which lesson 6 teaches, stay.

## The formula rule, in two steps

`CLAUDE.md` asks every formula on the site to be an `Equation` with a
sentence and a legend of its symbols with units. The lessons came with about
eighty formulas without either (their `Tex` blocks, the cheat sheet's
formulas, the analogy table, the worked solutions). Marcel chose to move them
as they ran first and to give each formula its sentence and its legend
afterwards, lesson by lesson (2026-11-20). Until that second step is done the
course is the one place on the site where the rule does not yet hold.

## What checking its mathematics found (for these lessons)

From Kurvenschmiede's record: every reference value of the specification that
these lessons use reproduces, except two the tests assert differently,
because the physics says so:

* **G10, Euler on the measuring shaft** (lesson 5): the specification printed
  0.98° after one second at h = 1 ms; it is 1.00°. At hω₀ = 2D Euler's
  anti-damping cancels the physical damping exactly, and the shaft rings at its
  starting amplitude for ever. The lesson says so.
* **G12, the absorber point** (lesson 6): 7.63 Hz is the *zero* of the shaft
  torque, √(c₂/J₂)/2π; with the default damping the *minimum* of |M_W| sits at
  7.9 Hz. The preset is the zero, and the lesson says so.

And three claims of the specification that needed a qualifier, which the
lessons carry: the rule of thumb "h ≤ 1/20 of the shortest period" holds for
RK4, not for Euler; on a first-order lag Euler alternates from h > τ and grows
from h > 2τ; "n masses, n natural frequencies" holds for a chain tied to
ground.

## What is still worth doing

1. **The formula rule** (above): a sentence and a legend for every formula.
2. **Settings in the address**, so a lesson's widget can be sent to someone.
3. **Measured data**: a CSV through the kit's `ColumnMapper`, and fits for a
   lag, a second-order step and a decay.
4. **Estimates in the widgets**, not only in the exercises.
