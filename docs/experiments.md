# The exhibits

Staunlabor is a site of hands-on exhibits, computed: each page lets the reader
play the visitor in a simulation of the exhibit, then shows the computation
behind what they felt, every number from the engine, `domain/experiments/`,
and asserted in `tests/unit/test_experiments.py`. Each exhibit is inspired
by one at the Swiss Science Center Technorama in Winterthur, but for the slow
LC circuit, a classroom classic Marcel asked for (2026-11-15) and its page says
so. The first eight,
which Marcel played with there, were first built from 2026-11-07 as the
"Experiments" area of an engineering app, Kurvenschmiede, and moved here on
2026-11-13 (`docs/plan.md`). The overview credits the museum in one line
("most exhibits are inspired by exhibits at the Swiss Science Center
Technorama, Winterthur"; "most" since the LC circuit, Marcel's word of
2026-11-15), with no logo and no photo: every drawing and text is the site's
own.

This document says what each exhibit is, how it is modelled, what checking the
models found before the engine was written, and what is left to build.

## The page

Every exhibit gets one page in one shape:

1. **At the exhibit** — a drawing of the setup and what the visitor does: its
   first paragraph, and the rest behind "More about the exhibit" (2026-11-19,
   the review of the coil's page: two long paragraphs pushed the twin below
   the fold).
2. **Try it** — the exhibit's twin, played with a mouse or a finger.
3. **What happens** — the derivation step by step, KaTeX, the engine's numbers.
4. **The sweet spot** — the one insight that explains the trick, as a chart.
5. **Change the exhibit** — sliders for its size, mass, voltage and so on.
6. **Further** — the lessons it stands on, in the differential-equations
   course under `/basics` (`docs/course.md`; at kurvenschmiede.app until
   2026-11-20); at the foot, back to every exhibit and on to the next one in
   the list's order.

The prose reads at 75 characters a line at most (a paragraph across a wide
screen ran to some 250); the figures, charts and equations keep the page's
full width. The frame (`exhibit-frame.tsx`) owns all of this, so every page
has it.

On a wide screen (`2xl`, 1536 px and up) the controls stand in a column
beside the views, and the two are capped as one group at the views' own width
and centred (`SIDE.cap` in `stage.ts`, 2026-11-19). Before that, the views
stood centred in all the width the column left them, with the column at the far
edge: at 1920 px the sliders stood 400 to 620 px from the drawing on twenty
pages. `stage.test.ts` holds every page's cap to its views' width. No drawing
is taller than 60 % of the screen (`STAGE`), and only `stage.ts` spells that
share: eight drawings had written `max-h-[60dvh]` themselves and would have
kept it when the share changed, so they take `STAGE.wide` and `stage.test.ts`
fails on a `60dvh` anywhere else (2026-11-22). The frame they stand in is
`VIEW_FRAME`, one string for the 35 drawings that repeated it. The gravity well and the water
parabola, whose views fill the row, are capped the way the sphere's are.

**How it is computed** (Marcel, 2026-11-07: "are these differential
equations?"). Each exhibit that moves has a section between what happens and
the trick that writes its whole model as one system and says how it is solved:
the coil's three coupled equations (position, speed, current — `k(x)` in both
the mechanics and the circuit) and the sphere's six (the ball centre's position
and velocity), stepped by classical Runge–Kutta every 0.2 and 1 ms, the same
steps in the browser; the platform's one, `dL/dt = −τ_f`, solved exactly. Each
links to the course's lessons it stands on (first and second order,
numerics), under `/basics`.

**No formula stands alone** (Marcel, 2026-11-07: "if there are equations
involved, are they also explained?"). Every one is an `Equation` block
(`features/experiments/equation.tsx`): the formula, one sentence saying what it
means in words, and a legend of every symbol in it with its meaning and unit.

## The overview

The front page, `/`, is the overview. It was a grid of eight cards until
2026-11-12, when Marcel asked for it to be redone now that there were "schon
einige Experimente". Since 2026-11-19 the first screen is the experiment of
the day's alone (Marcel: "Das erste was ein neuer Nutzer auf staunlabor.app
sieht soll das Experiment des Tages sein und nicht überladen werden"); since
2026-11-20 it is the experiment of the **week** (Marcel: "Stelle auf
Experiment of the week um"), and since the
same day it is the "stage" Marcel chose of three drafts (a design canvas with
an exhibition, a stage and a lab overview, each for a desktop and a phone):
"Das zweite und passe es so an, dass das Experiment der Woche ganz zu sehen
ist". The header stays at the top and holds the name, the three ways in
(**Exponate** `/exhibits`, **Grundlagen** `/basics`, **Über** `/about`), the
kit's `GlobalSearch` over the exhibits (Ctrl K), the language and the theme
(`experiments-layout.tsx`); every page sits in a column of at most 1160 px
(`page-shell.ts`). Top to bottom (`overview-page.tsx`):

* **The headline** across the page, "Erst *spielen*, dann *rechnen*."
  (`experiments.overview.claim`, the two verbs in Fraunces italic), and one
  line under it, what the site is (`experiments.overview.lead`, cut on
  2026-11-20 to "Exponate wie im Science Center – zum Ausprobieren und
  Nachrechnen.": the old one was "zu lang und nicht relevant für das
  Experiment", Marcel). It replaced the week's question as the page's `h1`.
* **The experiment of the week on a stage**, under the headline, as an
  exhibit stands in a museum with its label under it: the drawing, playing, in
  a box at most 52 rem wide whatever the window (Marcel: the picture should
  stop growing with the screen), and under it the week, Monday to Sunday
  ("23.–29. Nov."), the exhibit's name, the question to guess at (Fraunces,
  24 px; the 36 px question in the middle of the screen "sieht schlecht aus"),
  and the two ways on: into the exhibit, and to the page of all exhibits.
  The whole stage fits the first screen (Marcel: "so, dass das Experiment der
  Woche ganz zu sehen ist"): the drawing's height is the window's less what
  stands above it and the caption below it, between 180 and 400 px, and no
  more than half the stage's width (16 : 10 on a phone). Measured on
  2026-11-20 the stage ends at 779 px of 900, 754 of 768, 675 of 844 and
  653 of 667 (1440, 1366, 390 and 375 px wide). On a phone the drawing stands
  above the question (Marcel, 2026-11-20, of three orders shown: "Bild über
  Frage beim Handy"). The summary and the first paragraph at the exhibit,
  which stood beside the drawing before, are the card's and the page's.
* **The site in figures**, a band across the window (Marcel: "Wo ist die
  bottom line mit den key facts zur Seite?"): the built exhibits, their
  topics, the equations the pages write out (`facts.ts`, held to a count of
  the pages' sources by `facts.test.ts`), the exhibits an admin has checked
  (the server's answer; it replaced the sentence "n of 35 are checked"), and
  the languages, in the kit's `StatTile`s; under them "0 Cookies · 0 Tracking
  · kein Konto nötig · frei und quelloffen".
* **Exponate**, a part of its own (Marcel: "nicht alle Exponate gleich sofort
  … sondern nur eine Auswahl"): six drawn at random, new on every visit and
  kept while the page is open (`sampled` in `exhibits.ts`; Marcel,
  2026-11-22: "random sechs Exponate", after the six "newest" had been the
  list's six oldest), the same cards as the list,
  and the way to all of them.
* **Grundlagen**, likewise, under them (Marcel: "Genauso wie die Grundlagen
  unten drunter"): the three lessons the most exhibits build on, and the way
  to the course, which moved in from Kurvenschmiede (`docs/course.md`).

**The page of every exhibit**, `/exhibits` (`exhibits-page.tsx`; Marcel:
"es soll doch weiterhin eine separate Seite mit allen Exponaten geben"):
filtered by topic chips (`TOPICS` in `exhibits.ts`: an exhibit is about one or
two — momentum, angular momentum, energy, oscillation, equilibrium, flow,
induction, light, perception), the filter in the address (`?topic=flow`), with
"n of 35 tried on this device" and a "Forget" once one was tried (before,
"0 of 35" read as homework). Each card (`exhibit-cards.tsx`), the whole of
which opens the exhibit (its title is the link, stretched over it), shows its
drawing, its summary, its topics, a tick once tried, "This week" on the
week's, and "Builds on:" with links to the course's lessons, small and grey,
for the technically minded. The drawing is the live preview, held still and
playing while the card is pointed at or has the focus, fitted to one height
(`fitted-preview.tsx`); not the link-preview picture, since it draws in the
reader's language and appearance and its code is about 5 kB a page against
20–80 kB a picture.

The list grows as the reader scrolls (Marcel: "beim Scrollen mit Transition
unten anheften, auch eine Art von Virtualisierung, die wichtig ist, wenn es
mehr werden"): nine cards, then nine more each time its end comes within
480 px, each new card rising into place. A card off screen is skipped by the
browser's layout and paint (`content-visibility: auto`), and its drawing is
not mounted until it comes within 200 px (`exhibit-preview.tsx`), so the
page costs what is on the screen. How far a list grew is remembered per
filter for the tab, so the way back from an exhibit lands where it was.

**Back where one clicked.** Every way in is a page (Marcel: back with the
mouse's side button should return to where one was before the click), and
`app/scroll-memory.ts` does what the browser's own memory cannot for a
single-page site: it keeps each history entry's position and, on the way
back, scrolls there once the page is tall enough again (trying for a
second), and starts every new page at its top. Measured on 2026-11-20 in
Chromium: clicked at 800 px, back at 800 px; at 1100, back at 1100. A new
page fades in (`page-in`), a reader whose system asks for less motion sees
no fade, no rising card, no smooth scroll and no playing preview: on
2026-11-20 that was the reason Marcel saw no transition at all, his
Windows' animation effects being off. A link to the list's old place,
`/#all-exhibits`, goes on to `/exhibits`.

**The pick: random, with a memory** (`weekly.ts`; Marcel chose it over a fixed
rotation and over an admin's choice). Since 2026-11-20 it is **one exhibit a
week**, Monday to Sunday (Marcel: "Stelle auf Experiment of the week um");
from 2026-11-12 it was one a day, drawn by the same rule. The weeks from the
epoch on (`WEEKLY_EPOCH`, 2026-11-23, fixed once it ships, since moving it
would change the week's exhibit under the readers) are cut into rounds of one week per
exhibit, so every exhibit has its turn before any has a second. A round is
drawn week by week, by a generator seeded with the round's number (moving the
epoch moves only the dates), from the exhibits whose last turn is at least
half a round back: a shuffle alone guards only its own round, and the first
week drawn that way, still a day each, showed the chair on a Friday and again
on the Sunday. Among those, Marcel's **bonus and malus** ("dass es
unwahrscheinlicher wird, dass gleiche Experimente aufeinander folgen") lean
the draw (`WEEKLY_WEIGHTS`): a quarter more weight per week waited beyond the
spacing, half the weight for an exhibit about a topic last week's was about, a
quarter for one that came right after last week's in the round before. Those
are the halved maluses (Marcel, 2026-11-15: "Tagesminus sollte weniger
zählen"); the first eight were drawn with a quarter and a tenth. Measured over
400 rounds of all 35 (a plain shuffle in brackets): repeated pairs 0.45 a
round (1.20), repeated triples 0.013 (0.023), neighbours sharing a topic 17.4
weeks in a hundred (24.7), a wait of more than a round and two weeks 35.7 % of
turns (36.6 %). With eleven exhibits about energy, ten about oscillation and
eight about angular momentum, the stronger maluses held a topic back on most
turns. With the first eight, over 2000 rounds against a plain shuffle, the
first maluses cut pairs of the round before repeated in order from 0.9 a round
to 0.27, triples from 0.12 to 0.01, neighbours about one topic from 14.5 in a
hundred to 7.9. A stricter first version — six apart, a full point of bonus
each — turned out a rotation in disguise, repeating triples five times as
often as a shuffle, and was dropped the same evening. They are weights, so
"rarer" is not "never": the first two days, the smoke ring and then the
elephant, were a 3 % draw that came up. The bonus weighs less with every
exhibit: with eight it cut the turns that come after more than a round and two
more by a quarter, with fifteen by an eighth, with sixteen by a tenth, with 26
by a twentieth, with 35 by a thirty-sixth (14966 against 15376 over 1200
rounds); `weekly.test.ts` holds it only to a fiftieth. Its weight a turn is
fixed while a round grows longer, and stays so: Marcel weakened the maluses
instead (2026-11-15). The week is Zurich's, so one week has one exhibit
whoever asks; the pick needs no server, no table and no admin, and the past
weeks are the rule run backwards (the tests walk them; no page lists them). A new exhibit joins at the first round that starts
on or after its `since` day, never mid-round, which would redraw weeks already
shown; so `since` is the day it **ships** — a past date puts it into a round
already under way on the live site. A round of 35 weeks is most of a year, so
a new exhibit is first shown in the list of all of them and among the front
page's six drawn at random, not by this pick (Marcel agreed, 2026-11-20; the
front page's "newest" became random on 2026-11-22).

**The previews are the pages' own auto modes** (`preview-mode.tsx`): each
page's play component takes `preview` and `paused`, and in a preview it starts
in its auto mode, draws its views only — no buttons, sliders or figures — and
runs while `paused` is false. The motion on the overview is the motion on the
page, from the same browser port, so it cannot drift from what it advertises.
The chair, whose turning lived in its page with a `ChairPreview` of its own
beside it, has a `ChairPlay` like the others since 2026-11-22. One table,
`exhibit-modules.ts`, names each exhibit's page module, its `<X>Page`, its
`<X>Preview` and its card's icon; the routes, the previews and the cards all
read it, so a new exhibit is one line there. `exhibit-preview.tsx` takes each
preview lazily from its page's module — the chunk a click would load
anyway — mounts it once it comes near the screen, stops it off screen, and
shows the first frame as a still under `prefers-reduced-motion` or where that
cannot be read. The coil's keyboard (its two buttons on `+`/`−` and the
arrows) is off in a preview: the keys belong to the page it stands on.

**One clock, one set of buttons** (2026-11-22). Every twin's frame loop is
`useFrameLoop` in `play.ts`: it owns the `requestAnimationFrame`, clamps a
frame's step to [0, 0.05] s and always calls the page's latest step, so a new
speed or build does not restart it. Thirty-three pages had written the loop
out by hand, and seven had lost the zero guard, so a frame stamped before the
loop began could step their time backwards. `useRunning` holds who runs the
clock (the page's Run/Pause, or the overview's `paused`). The header's
Run/Pause and Restart, the sound switch and the speed choice are
`play-controls.tsx`, on the shared `experiments.play.*` words, where each
exhibit had kept its own and they had drifted ("Anhalten" and "Pause"; a
quarter speed as "Zeitlupe (¼)", "¼" and "4× langsamer"). A speed is named
by its factor; Foucault's time-lapse ("1 min pro s") keeps its own labels.
A check case's "Set it up" reaches the page through `useTakeCheckRequest`
in `check-setting.ts`, which remembers the request it took.

**Tried, not opened** (`tried.ts`, `STORAGE.experimentsTried`, a line of the
privacy page in all seven languages): an exhibit counts once the reader does
something in its "Try it" — a pointer or a key in that section, caught by
`ExhibitFrame` — and a page only opened and scrolled past does not. The
exhibits hold nothing of anybody's, so the browser is the whole record and
nothing is sent anywhere.

## The ball in the hanging sphere (`experiments.sphere`)

**The exhibit.** A clear sphere hangs between a rope to the ceiling and one to
the floor, with a ball inside. The visitor pushes the sphere left and right,
forward and back, or round in circles; done right, the ball climbs the inner
wall until it runs round the equator, in that plane only.

**The model.** The ball rolls without slipping on a shell that the hand moves
but does not turn. Its centre then moves exactly like a spherical pendulum of
length ρ = R − r under **5/7 of gravity** (3/5 for a hollow ball); the other
2/7 spin the ball up. The hand's push enters the same way, as a second gravity
`−A`. The ropes, top and bottom, are there to keep the sphere moving in the
horizontal plane (Marcel, 2026-11-07): for a push of a few centimetres on ropes
much longer than that, the sphere rises by only `x²/2L` and hardly tilts, so it
translates in the plane without turning — which is what the model takes. What
the ropes' tension pushes back with is the hand's to overcome, not the ball's
to feel: the hand moves the sphere where it likes.

**What it shows.**

* A circle at rate Ω rides **g'/Ω² below the equator, whatever the sphere's
  size** — 4.4 cm at 2 Hz, 2.0 cm at 3 Hz. Below Ω₀ = √(g'/ρ) (0.99 Hz for the
  default Ø 40 cm sphere and 4 cm ball) there is no circle; the equator itself
  would take an infinite rate.
* So **the resonance moves while you pump**: to take the ball higher the hand
  has to circle faster, *with* the ball. A slow sweep from 0.7 to 2.5 Hz over
  30 s on a 2 cm circle carries it to 81°, the 2.5 Hz orbit; jumping straight
  to 2.5 Hz leaves it below 20°. This is what the visitor feels as "finding the
  sweet spot and moving faster" — autoresonance.
* A push does the most work a quarter turn ahead of the ball. Once the ball is
  up, holding it needs a circle of under a millimetre against rolling
  resistance; a bigger one lets it ride nearly in step.
* A tilted orbit — the ball above the equator on one side, below it on the
  other — bobs at Ω·√(1 + 3cos²θ), near the equator once a revolution: the
  visitor's "not in the plane yet".
* Back and forth is the opposite: a pendulum swings *slower* the wider it
  swings (0.84 Hz at ±90° against 0.99 Hz small). The chart ends there: past
  90° the wall's push turns negative before the turning point and the ball
  falls off the wall, so no such swing exists (`SWING_TO_DEG`; it once ran to
  175°). Rolling at the turning point asks a grip of `(2/7)·tan θ₀`, 0.49 at
  60°.
* Rolling needs at most 0.16 of friction anywhere on the default sweep.

## The magnet car and the coil (`experiments.coil`)

**The exhibit.** A track of two ramps, left and right — circular arcs curving
up from the flat, not straight slopes (Marcel) — with a coil round the flat
between them and a car carrying a magnet. A digital meter, ±100 mA, shows what
the car induces as it rolls through, and nothing while a button is held: the
page takes a button to switch the coil from the meter to the battery. On a
keyboard, + or ← and − or → work as the two buttons, for a desktop where a
mouse cannot jump between them in fifty milliseconds. Beside the exhibit's meter
the page has a second one the exhibit lacks (Marcel, 2026-11-08: "one what the
car induces and the other one what is done by pushing the buttons"): the
current a held button drives, on a ±1 A scale, and nothing while the car
coasts — so the two never read at once. Two buttons switch the coil on, one each way;
pressed at the right moments the car goes higher with every pass, until it
reaches the top of each ramp.

**The model.** One curve does both jobs: `Ψ(x)`, the magnet's flux through the
coil's turns with the car at `x`, and its slope `k = dΨ/dx`. The car induces
`e = k·v` rolling through (the meter's two opposite swings), and feels
`F = k·i` when a current flows. `k` changes sign in the middle, so the current
that pulls the car in pulls it back once it is past: **plus coming in, minus
going out**, whichever way the car goes. The circuit is `L·di/dt = u − R·i − k·v`,
the car `m·dv/dt = k·i − m·g·slope − rolling`; a run carries its energy
account, which closes to a part in a million.

**The default build is assumed**, since the exhibit's dimensions are not
published, and fitted to what Marcel remembers of the meter: digital, −100 to
+100 mA, and reading as the car coasts through with no button pressed — so the
coil stays closed through the meter (`Idle.CLOSED`). A Ø 20 × 10 mm NdFeB magnet
(B_r 1.3 T); a 1600-turn coil of 0.26 mm wire, 60 mm mean diameter and 50 mm
long (94 Ω, 118 mH); a 9 V block; a 150 g car; ramps 30 cm along an arc of 0.9 m radius, 49.5 mm high and 19° steep at the top,
either side of a 20 cm flat. With a button held the coil draws 96 mA (the meter,
switched out, reads nothing); coasting through, the meter reads about 9 mA from
halfway up a ramp and 19 mA from the top (the first version said 14), and the car needs a handful of good passes to reach the top (the auto mode: six, from halfway up the left ramp). More
turns of the same wire lower the current without lowering what a pass gains,
because `Ψ` grows with the turns as fast as `1/R` falls (of thinner wire, as
the first version said, `R` grows faster and a pass gains less); a first guess of 400
turns at 3 V drew 455 mA, off the meter's scale. All of it is a slider.

**The aim on the track** (the review of the coil's page, 2026-11-19: the
start was unclear and "reached the top 0" in the figures too abstract). Over
the track one line says the aim, "get the car up to both flags", and says it
is done once it is. A flag lights when the car has reached it, and a dot marks
on its ramp how high the car came at its last turn, so a better pass shows
where the eye already is. A reader who asked for less motion finds the car
standing still with "Let the car go" on the track itself, not only "Run" in
the header. The track, the buttons and the meters stand in one column at most
64rem wide: across a wide screen the buttons stood over 1000 px apart. The
auto mode says only "let the rule press, and watch when it does"; how it
presses is the trick's to show.

**What it shows.**

* **The coil is fast and the hand is slow.** At the exhibit each button has its
  own hand, left and right (Marcel), so the two presses can follow each other
  as closely as the car asks — down to no gap at all. `L/R` is 1.3 ms; at the speed
  that reaches the top the car takes 53 ms from one peak of `k` to the other.
  The sweet spot is about ±20 ms wide: switching 20 ms late still gives two
  thirds of the best pass, 30 ms late never reaches the top, 60 ms late brakes.
* **Wrong way round traps the car** at the coil within a pass.
* **The meter's swing is a brake**: with the coil closed through the meter the
  coasting car stops sooner than with it open (Lenz).
* **There is a top speed however well you press**, `U·Ψ(0)/∫k² dx`: the car's
  own current brakes it, the harder the faster it goes, and past that speed the
  brake takes more from a pass than the battery can give, even with plus the
  whole way in and minus the whole way out. 7.2 m/s for the default build; the
  formula leaves the inductance out, and stepped with it the zero lies about
  7 % higher. `U/k_max`, 4.8 m/s, given here before the mathematics check, is
  only where the car's voltage first beats the battery's, at the peaks of `k`:
  the flanks still push, and a pass there still gains 40 % of what it gains at
  1 m/s.
* A perfect pass at full current gains `2·I·Ψ(0)`, 16 mJ (11 mm of height);
  rolling resistance and the induced voltage take some of it.

## The chair (`experiments.perspective`)

**The exhibit.** One long box on a table with three peepholes side by side
(Marcel, 2026-11-07: "only one chamber with all three side by side"): behind
them a chair, a skewed chair, and rods that touch nowhere. Through each hole it
is the same chair. The magic, as Marcel put it, comes when one sees the boxes
from outside — how the rods really lie in space: the picture is always a chair,
the thing is far from one. Plato's cave in a box: the hole shows the shadow,
the side view shows the thing.

**So the page shows the three side by side, each in perspective from one
viewpoint that the reader turns a full 360° and tilts** — the same for all
three — round a point inside the chamber. At no turn and no tilt that
viewpoint is the hole, and the three pictures become one chair; anywhere else
they come apart (`chair-views.tsx`: the hole's own projection, from a turned
viewpoint). The lines of sight from the hole through every corner are drawn in,
the one thing the three objects share (`perspective.sight_lines`). A first
version had the holes and a box view apart, with a slider moving the eye off
the hole; the effect of that slider was not recognisable, so it went. Each box is its own size and its
object stands on its floor (`perspective.box`): 49, 72 and 76 cm deep. The
chair is turned 30° and stands low enough that the eye looks down onto its
seat: square-on and edge-on, as the first drawing had it, a chair is a few
rectangles, and the picture has to read as a chair for the trick to work.

**The model.** An eye at a hole sees directions, not distances; every point
can slide along its line of sight, `P' = E + λ·(P − E)`. The skewed chair is
one projective map that keeps every line through the eye
(`P' − E = (P − E)/(1 + w·(P − E))`), so its rods stay straight and its joints
joined; the scattered rods each slide by their own `λ`. The three are one
picture to 10⁻¹² of the image.

**What it shows.** Two points that line up at distances `d₁` and `d₂` come
apart by `δ·|1/d₁ − 1/d₂|` when the eye moves δ. For the default box a joint
of the scattered rods opens to one minute of arc — what the eye resolves —
after **0.16 mm**, less than the hole or the pupil, and the second eye 65 mm
away sees the gaps 6.6° wide. The skewed chair never opens; moving the eye
only changes its shape. That the scattered rods still read as a chair through
a hole a few millimetres wide is the brain's part, which the page tells in
words: a pupil blurs each point, and a blurred gap at the wrong depth is read
as a chair.

## The spinning platform (`experiments.platform`)

**The exhibit** (added by Marcel on 2026-11-07). A round platform turns on a
bearing at floor level, a handlebar fixed across its middle; a visitor stands
on it, both hands on the bar, and gets a push. The feet stay put; only the body
leans back or stands upright (Marcel: "you have to hold your arms at the
handle bar"). Leaning out, they turn slowly; upright, fast — "conservation of
angular momentum".

**The model.** Only the bearing turns the visitor from outside, so between
pushes `L = I·ω` changes only by its friction (`dL/dt = −τ_f`), and the rate is
`L/I`. `I` is summed from lumps, each by its shape's formula: the platform a
disc `½·M·R²`; the legs at the axis about their own axis (the feet do not
move); the trunk with the head about its own axis and shifted out by the lean
(`+ m·d²`); each arm a rod from the hand on the bar, `s` to the side of the
axis, to its shoulder, out by the lean: `m·(s² + d²/3)`. The visitor (70 kg,
segment shares of the usual tables) and the platform (15 kg, 60 cm, 0.2 N·m of
friction) are assumed. (A first version let the arms swing out and the hands
hold weights; at the exhibit the hands stay on the bar.)

**What it shows.** Leaning out 30 cm the default visitor turns at 0.5 rev/s;
upright, 1.6 — 3.2 times as fast, `I` falling from 5.3 to 1.7 kg·m². And the
**energy** `E = L²/2I` rises: the 58 J are the work the arms do pulling the
body upright against what holds it out, `m·ω²·x` per piece, which the test
checks by adding that pull up along the way in. Leaning out, the hands pull
inwards with 124 N on the bar, what keeps the body on its circle; upright,
nothing. Holding the leaning body up against its own weight comes on top and
does not grow with the turn; the page called the 124 N the pull on the bar,
which is more (the mathematics check, 2026-11-17). The bearing stops a spin after about 84 s.
The auto mode leans out, stands up, holds and leans out again.

**Sentences with fixed numbers** (Marcel, 2026-11-07): where the prose quotes a
number that the sliders change — the coil's "20 ms late still gives two
thirds, 30 ms never reaches the top", the sphere's "81° after a slow sweep" —
it says that it holds for the default build; everything else on the pages is
the engine's answer for the build on screen.

## The race of the curves (`experiments.race`)

**The exhibit** (Marcel, 2026-11-07: "three balls on different ramps … let
loose at the very same moment", and the curve "where the ball always needs the
same amount of time, no matter where it was first started"). Six tracks run
from one start to one finish, a ball on each, let go together; on 2026-11-08
he chose the six: the **line**, the **cycloid**, a **circular arc** level at
the finish, a **parabola** with its vertex there, a **hyperbola** that drops
steeply first, and a **hump** that rises on the way. Below them a **cycloid
valley**, four balls let go together from different heights, beside a
**circular bowl** with the same curvature at the bottom.

**The model.** Nothing drives the balls but gravity and the track only steers,
so a ball `h` below the start has `v = √(2·g'·h)` whatever the track did on the
way, and a track's time is `T = ∫ ds/v` — no time stepping at all. A rolling
ball feels `g' = g/(1 + k)` (the sphere's 5/7 for a solid one), which stretches
every time by `√(1 + k)` and changes no ranking. The integral is singular at the
start, where `v = 0`; the substitution `p = u²` removes that, and the trapezoid
rule over 1440 intervals, kept as it goes, is both the time and each track's
time table of 241 points, which the page looks the running time up in
(`race-views.positionAt`, linear between two points) — so the browser needs no
port: the table is the whole motion.

**What it shows**, for the default build (drop 50 cm, run 120 cm, a solid
ball): the cycloid 0.747 s, the hyperbola 0.756, the circle 0.803 (Galileo's
guess of 1638, close), the parabola 0.823, the line 0.982 (the shortest track,
and slow) and the hump 1.371. The cycloid dips 5.2 cm below the finish and
climbs the last part, as it does whenever the run is more than π/2 times the
drop. On the valley (radius 30 cm) every ball reaches the bottom after
`π·√(r/g')` = 0.650 s, from 59, 46, 18 or 2 cm; on the bowl, from the same
heights, 0.697, 0.685, 0.663 and 0.651 s — the wider swing is the slower one.
The page plays the race in real time, a quarter or a tenth; the auto mode runs
it again a moment after the last ball arrives, and the valley swings on, the
balls mirrored up the far side (`swingAt`, a period of four times the table).

**Past the flag, a ball pit** (Marcel, 2026-11-08: a ball that froze at the
flag at full speed "just ends with no deceleration"; then "It shall be
according to physics. Maybe create a ball pit where they realistically end
up", and "Make it look nice. Maybe jump into a ball pit where the other balls
also shall end up"). Each track ends at the finish, and its ball flies on with
the velocity it left with, under `g` alone, into a padded pit: a funnel, its
sides sloping at 30° to a rounded bottom, a wall up from each rim. There the
balls bounce, roll and knock into each other until all six lie together at
the bottom (`domain/experiments/pit.py`). They are discs in the race's plane —
the pit is a trough one ball wide that every lane runs into — and above the
rim still in their own lanes, so they meet only once they are down in it (all
leave the same finish; a ball close behind another would otherwise start
inside it). A contact is a stiff spring with a damper that keeps a share of the
speed of approach (0.3 off the lining, 0.6 ball on ball), friction up to 0.4
times the push, which turns the ball, and a rolling resistance of 0.08 on the
lining, without which a ball in a bowl never stops; semi-implicit Euler every
0.1 ms. The 30° sides are steeper than friction can hold even the block that
slides (tan 30° = 0.58): a first bowl, shallow enough to catch a long throw,
left balls lying apart wherever they had slowed down. The default race's balls
lie still 2.74 s after the start, heaped in the bottom.

It is a time loop, some thirty thousand steps, so the page runs it, ported
line for line (`features/experiments/simulate/pit.ts`), once per build, and the
API sends only the pit's shape; `engine-cases.json` holds the port to the
engine on three races (the default, hollow balls on the shortest run, blocks
that slide on the longest) — exactly, not within a margin: balls knocking into
balls is chaotic, and a last bit rounded the other way would part the two runs
within a second. So the engine uses only what rounds the same in Python and in
a browser: `+ − × ÷`, `sqrt` (not `hypot`), and `sin`, `cos`, `log` of inputs
that were checked to agree to the bit. The engine's tests: the throw, energy
only ever leaving, and every ball at rest in the pit, below the rim, touching
another, for all three kinds at both ends of the run.

Which way the cycloid's ball leaves is the build's: upwards only where it dips
below the finish and climbs back to it, run/drop > π/2 — a side check caught a
sentence that said "upwards" for every build, so the trick now has two
(`sweet.throw_up`, `throw_down`), as the dip has.

Before this the page ran the balls onto a flat with a brake and lined them up
against a buffer, which made a later ball brake harder and the winner the
softest; then into a sand pit that stopped each where it fell, leaving balls
hidden behind each other. Two side checks and Marcel's word replaced both.

**Velocity and acceleration as arrows** (Marcel, 2026-11-08: "printed as arrows
in a coordinate system and as values beside … also the absolute amount", so
that it would show which balls brake harder; by physics, none does). Two coordinate systems under the race,
every ball's velocity in one and its acceleration in the other, drawn from one
point in the ball's colour (`race-motion.tsx`), and a table of the numbers by
rank — time, `|v|`, `vₓ`, `v_y`, `|a|`, `aₓ`, `a_y` — which took the ranking
list's place. On a track they are the engine's (`Track.motion`, at each sample):
the velocity `v·T` along the tangent, the acceleration `g'·(−T_y)·T + v²·κ·N`,
gravity's share along the track and the turn it forces, `κ` exact from each
shape's second derivatives (`race._bend`). Tests hold them to the time table's
own slopes and, for a block that slides, to a push square to the track. In the
air every ball's acceleration is the same `g` straight down. The scale is the
build's for the whole race — the fastest any ball goes and the hardest any is
pushed on its track or by `g` — so an arrow growing is the ball, not the axes;
in the pit a knock is a jolt far off it (the pit's samples give the mean over
5 ms, since a contact lasts about 3), drawn to the edge and dashed, its size in
the table.

**The track holds the ball** — the model assumes it, so the race allows only
runs where it is true. A side check on 2026-11-08 asked where the track's push
on the ball, `g·cos α + v²·κ`, turns negative (it depends on run/drop alone):
below a run equal to the drop the circular arc, level at the finish, curls back
over its own start, and below 1.04 times the drop a sliding block comes over
the hump's crest too fast for gravity to bend its path and flies off (a solid
ball below 0.77). The default build, at 2.4, holds every ball with half its
weight to spare at the crest. The race was allowed down to a fifth of the
drop; it now stops at 1.1 (`race.SHORTEST_RUN`), and a test holds every track
to a positive push at both ends of the range.

**Checked before it was written** with SciPy: each track's time by adaptive
quadrature (`REFERENCE_S` in the test, held to 10⁻⁵; the trapezoid sum is
within 6·10⁻⁸); the line and the cycloid by their closed forms; the bowl by
the pendulum's `√(R/g')·K(sin φ₀/2)`. The hump's first height, 0.4 of the drop,
came within half a millimetre of the start, where `v` is nearly zero and the
ball all but stops; it is 0.35.

## The Bernoulli elephant (`experiments.elephant`)

**The exhibit** (asked for by Marcel on 2026-11-12). An elephant blows a steady
jet of air straight up through its raised trunk; a visitor sets an inflatable
ball on the opening, and it lifts off and floats. Marcel: an opening of about
10 cm, a ball of 10 to 15 cm, floating 30 to 35 cm up; at the exhibit nothing
else can be done, "for the app it would be great if one could set more", the
trunk's tilt included, "also to see when the ball would fall".

**The model** (`domain/experiments/elephant.py`, whose docstring is the long
form). The jet is a round turbulent free jet as Pope has it: a Gaussian profile
`u = u_c·exp(−r²/b²)` whose width grows as `b = D/√2 + k·s`, `k = 1/(√2·B)`
with the decay constant `B = 6`, and whose momentum flux `ρ·U₀²·π·D²/4` is
conserved, which fixes `u_c = U₀·D/(√2·b)`. On the ball:

* the drag of a sphere (`C_d = 0.47`) on the air's speed relative to the ball,
  the air's speed being the root mean square of `u` over the ball's
  cross-section;
* a sideways suction toward the faster air, the first moment of `½·ρ·u²` over
  the cross-section times one coefficient `C_B` (the slider "Sideways suction
  (model)", 1 by default: the order a sphere's surface gives);
* the weight less the buoyancy of the displaced air (a fourteenth of the
  default ball's weight), and half the displaced air as added mass.

The ball sits on the opening's rim until the air lifts it; it has fallen once it
is below the opening and beside it. The integral over the cross-section is a
fixed rule of 288 points (twelve rings of equal area, 24 spokes, each node
summed with the one opposite, so a ball on the axis feels exactly no sideways
pull); the time loop is RK4 at 2 ms, ported to `simulate/elephant.ts` and held to
the engine by `engine-cases.json` like the others.

**What it shows.** At 14.5 m/s out of the 10 cm trunk (410 m³ an hour) the
default ball (15 cm, 30 g) floats with its centre 36 cm above the opening, its
underside 28 cm, where the air reaching it has 7.4 m/s. It lifts off from
12.1 m/s. It floats where the lift crosses its weight because higher up the
jet is wider than the ball and the ball catches less of it: the lift falls with
height, so the ball comes back to that height, bobbing at 0.50 Hz as the air
damps the bob (undamped 0.54, which the page first gave; across, 1.84 Hz for
1.85 — the mathematics check, 2026-11-17). Off the axis the suction pulls it back, strongest about 7 cm
out. Tilted, it hangs lower and to the low side, and from 31.7° it rocks:
the limit is where the motion linearised about the balance (`stable`: its
Jacobian by central differences, the characteristic polynomial by Faddeev and
LeVerrier, Routh–Hurwitz) first lets a disturbance grow, a pair of roots
crossing to growth (a Hopf bifurcation). Held 1.5° below it the ball stays,
1.5° above it it rocks out. The first version asked only that the lift fall
with height and the suction pull back, each alone, which holds to 43.7°; the
mathematics check (2026-11-17) found the ball, held at 34°, falling after
10 s. The rocking takes time to grow: the auto mode's 3° a second, from the
opening, drops the ball only at about 47°.

**What is assumed, and said on the page.** The jet's first diameters: a real
jet keeps `U₀` on its axis for about five of them, and this one's virtual
origin lies `B·D` behind the opening, so its centre speed at the ball is about
a third lower than a real jet's. What the ball feels is the momentum within its
radius, which the jet's width decides, and that grows at the textbook rate.
`C_d` is a smooth sphere's below the drag crisis (the ball's Reynolds number is
about 7·10⁴). `C_B` is a guess of the right order. The exhibit's blower is not
published, so the default air speed is the one that floats the default ball as
high as Marcel saw it.

**Checked by** the tests rather than by SciPy this time:
`tests/unit/test_experiments.py` sums the jet's momentum flux across the whole
plane with a radial rule of its own (it is conserved to 10⁻⁴ at every height),
holds the 288-point rule to the closed form on the axis (0.2 %), and runs the
ball from the rim to the stated height and back from a push, holds it 1.5°
below the stated limit and drops it 1.5° above, and finds the jet alone
holding it to 43.7°.

## The smoke ring (`experiments.smoke`)

**The exhibit** (asked about over 2026-11-11 and 12). A wide flat
drum full of smoke, about 1.9 m across and 30 cm deep, at hip height; its top a
stretched skin with a 30 cm hole, rimmed by a rigid ring the visitor presses
down, at most about 8 cm. Marcel's observations:
- any ring is a success;
- pressing too fast gives none ("too turbulent, the smoke mixes with the air and
  is gone"), and a slow press does nothing;
- about half a second is best;
- air comes back only when the skin is let go, and the smoke flows in slowly
  all the while.

**The model** (`domain/experiments/smoke.py`).
- **The press:** pressing the ring pushes the skin into a stretched membrane's
  log profile, so the drum loses `A_eff ≈ 0.80 m²` per metre of press, 11.3
  times the hole. The hole goes down with the ring, so the air leaves it at that
  ratio plus one times the hand's speed (the ratio in the room).
- **The ring** is the slug model's: circulation `Γ = ½∫(u² − ẋ²)dt`, what
  leaves the hole's moving edge, taken up only
  until the slug is four hole diameters long (the formation number; a full
  press here is 3.3, the moving hole's ratio plus one). Its radius is 0.6 hole
  diameters and its core 0.35 of that; it flies at Kelvin's speed for a thin
  core, `Γ/(4πR)·(ln(8R/a) − ¼)`, and has Reynolds number `Γ/ν`.
- **Too fast, too slow:** both the circulation and the speed grow in
  proportion to the pace of the press. So the two failures are two thresholds on
  one scale: past `Re = 1.9·10⁵` the ring is turbulent and smears; slower than
  the hall's draught, 0.6 m/s, it is carried off before it forms. Neither is a
  textbook number for a ring this size in a museum hall; both are set to
  Marcel's half second and offered as sliders that say so. Either end of the
  window can be open: with a draught of a few cm/s even a 20 s push outruns it
  (`open_slow`), and every full press slower than 0.21 s makes a ring; with a
  threshold high enough even a 10 ms jab stays laminar (`open_fast`). The page
  said then that no press makes a ring at all (the mathematics check,
  2026-11-17).
- **The hand** feels the skin's spring (tension 150 N/m assumed) and the air's
  back pressure `½ρu²` over `A_eff`.
- **The flight:** a laminar ring slows only as its core thickens viscously; a
  turbulent one widens at 1 % of the distance and slows with the cube of its
  size; the draught carries both sideways.

**What it shows.** A full press makes a ring between 0.21 and 1.26 s, best at
0.51 s: Re 77,000, the ring at 1.48 m/s, the air out of the hole at 3.0 m/s. A
jab of 0.1 s gives Re 396,000 and needs 140 N on the hand, where a slow press
needs only the skin's 48 N. The jet is taken relative to the hole, which goes
down with the ring: `u = (r + 1)·ẋ`, and the circulation leaving its moving
edge `½·∫(u² − ẋ²)·dt`, `(r + 2)/r` = 18 % more than the room's frame, in
which the first version took it (Re 67,000 and 1.28 m/s at half a second; the
mathematics check, 2026-11-17). The two thresholds, set to the exhibit's half
second, rose by the same 18 %, from 1.6·10⁵ and 0.5 m/s.

In the page, the reader presses with a button (a
smooth half cosine of the length they set), by dragging the ring down in the
drawing (the page samples the hand and the browser's port makes the ring from
those samples), or with an auto mode of three presses: a jab, the best, and a
slow push.

**Left out, and said:** the skin's own mass and ringing (Marcel saw no air come
back while pressing), the suction when let go, the smoke's buoyancy, and a
turbulent ring's wake, which the page draws as smoke spreading rather than
computing it.

**Checked by** the tests:
- `tests/unit/test_experiments.py` integrates the membrane's volume with a
  radial sum of its own;
- it holds the circulation to the half cosine's closed form `π²d²/8T`, and the
  trailing jet to the formation number;
- the window is held to the half second;
- a turbulent ring keeps its impulse in flight: its speed falls with the cube of
  its size.

## The ball cannon (`experiments.cannon`)

**The exhibit** (2026-11-12), inspired, like the other seven, by one at the
Technorama. Three elastomer balls of
about 10, 7 and 5 cm, threaded on a steel wire, dropped stacked; the small one
on top is catapulted up. Marcel: the wire is only there to keep them in line
and may be left out; the sizes should be adjustable, and two balls as well as
three. Asked the same day whether the balls are modelled with equations of
motion and whether the forces between them are shown, he chose contact forces
as differential equations; and he kept the name, which the page explains (the
textbook's "Galilean cannon": the small ball shot straight up as if out of a
barrel).

**The model** (`domain/experiments/cannon.py`).
- **The balls:** solid elastomer spheres of 1100 kg/m³ (assumed), numbered from
  the bottom, in one line — the wire's job. The exhibit's weigh about
  8 : 3 : 1 (576, 198 and 72 g).
- **Equations of motion**, one per ball, solved together:
  `m_i·ÿ_i = −m_i·g − ½ρC_dA_i·ẏ_i|ẏ_i| + F_i − F_{i+1}`, `F_i` the contact under
  ball `i` (the floor's for the bottom one).
- **A contact is Hertz's**, `F = K·δ^{3/2}`, `K = (4/3)·E*·√R*` with the floor
  rigid and two balls of one elastomer halving `E*`; Young's modulus 3 MPa and
  Poisson's ratio 0.5 (rubber), both assumed. **Damped as Flores et al. (2011)
  give it**, `·(1 + 8(1 − e)/(5e)·δ̇/δ̇₀)`, so a contact gives back about the
  share `e` (0.85, assumed) of the speed it closed at — to 2 % from 0.85 up;
  fitted near 1, it gives back less the lower `e`, 9 % less at 0.5 and a fifth
  less at the slider's 0.3, which the slider's hint says (the mathematics
  check, 2026-11-17). Hertz's law is for small dents, where the exhibit's
  bottom ball squashes by a fifth of its radius; the page says so among what
  is assumed. `δ̇₀` is the
  fastest the contact has been struck in this compression: in a touching stack
  the contacts above close gently in the fall or as the bottom ball slows, and
  are then pressed far faster (the middle one closes at 1.1 m/s and is struck
  at 4.3); pressed again after it began to part, a contact is struck anew.
  - The first version took the gentle closing throughout, which made the
    damping up to four times too strong (the contacts above peaking at 0.56
    and 0.28 kN, the top ball off at 6.6 m/s) and, with a heavy ball settling
    onto a small one in the fall, a hundredfold, where the steps blew up (20, 2
    and 20 cm at 100 MPa; the crash sweep, 2026-11-17).
  - The second took the faster of the gentle closing and the present rate,
    which still held the gentle closing on the way back: the contacts above
    gave back too little (0.69 and 0.37 kN, the top ball off at 7.0 m/s,
    2.4 times the drop), and the big ball on top, its contacts closed in the
    fall, gave back nothing — the balls flew off 19 mm into each other, stuck,
    and the stack "sent nothing up" (found by the cost of it, 2026-11-18).
  - Held at the fastest of the episode instead, a contact pressed again and
    again (the big ball on top, cushioned by the light ones) was damped too
    little from the second time on, and came back as high as it fell.
- **Stepped with RK4**: 0.5 ms while every ball flies free, 10 µs while a
  contact is struck or about to be (fifty small steps for one large, the time
  grid unchanged). A contact that rests — opening or closing slower than
  1 mm/s, its swing (`1.5·K·√δ` on the pair's reduced mass) and its damping
  slow enough that a large step takes at most 0.5 of a radian — is stepped
  large as well: a ball settled onto another in the fall moves at some
  0.02 mm/s and swings a twentieth of a radian a step. In small steps the big
  ball on top from 3 m took 243 000 of them, 11 s of the server (6.4 s in the
  version then live), where the budget allows a couple of hundred
  milliseconds; now 9 300, against the exhibit's 7 800, with the same figures
  to a millionth. The whole stack is run once for its launch and its forces
  (it was run twice, a fifth to a third of the cost). A launch is bounded
  before it begins: its fall and at most 0.5 s after the floor, at worst all
  in small steps, 385 000 steps for the three from 3 m and 180 000 from 5 cm.
  The dearest of the page's own corners come near it. Three 20 cm balls at
  0.5 MPa and a restitution of 0.3, from 5 cm, take 151 000, some 4 s of a
  laptop's core: they do not bounce but sink into each other at 1 to 4 mm/s,
  faster than a resting contact moves, and the top ball never leaves, so the
  whole window is stepped small. A 2 cm ball under two of 20 cm at 200 MPa
  from 3 m takes 140 000, nearly all before the floor: the air brakes the
  small ball harder than the big one on it, which presses on it through the
  fall, and that contact, still to 0.6 µm/s, swings more than half a radian
  a large step. Letting a resting contact's step take a whole radian cuts
  that one to 9 000 and leaves the soft ones as they are; where it moved the
  figures most, a drop a nanometre higher moves them as much. The impact's
  forces, overlaps and positions are recorded every 0.1 ms for 30 ms.
- **The textbook's model** is kept beside it for comparison: instantaneous hits
  one after another (`sequential_launch`), with and without losses, and the
  `(2ⁿ − 1)·v` of each ball far lighter than the one below.

**What it shows.** From a metre the stack meets the floor at 4.42 m/s. The
floor pushes back with 1.24 kN (about 220 times the bottom ball's weight), the
ball squashed by 10 mm for 11 ms; the two contacts above peak at 0.60 and
0.32 kN. Touching, the three contacts overlap — the middle ball presses into the
bottom one 1.7 ms after that one met the floor — and the top ball leaves at
8.9 m/s and climbs 3.9 times the drop, where instantaneous hits one after
another would send it off at 10.9 m/s (5.7 times). A few millimetres apart the
contacts come one after another: 5 mm gives 5.1 times, 2 cm 5.4. The
elastomer's stiffness changes the forces and the durations much and the climb
little (1 MPa 3.8 times, 50 MPa 4.3). Turned over, the stack is no cannon: the
big ball on top climbs back about 0.8 of its fall, the light balls below only
cushioning it — one hit after another would leave it still going down.
In the page the reader drags the stack up in a close-up and lets go, or drops it
with a button; a column beside it holds the whole climb; slow motion plays the
impact a hundred times slower, the balls squashing into each other; a table and
a chart give each contact's force; the auto mode drops one, two and three balls
from the same height.

**Left out, and said:** the wire's friction, the balls' spin, and an
elastomer's real, speed-dependent damping.

**Checked by** `tests/unit/test_experiments.py`:
- one lossless ball against Hertz's closed form — the deepest squash, the peak
  force and the duration `2.94·δ_max/v`, each to 1 %, and the impulse to the
  momentum turned round;
- the damping gives back e to 2 %;
- the exhibit's forces and launch, the overlap of its contacts, and a gap that
  parts them and nearly reaches the sequential model;
- the sequential model's closed form, and the stack turned over;
- a contact struck after it closed parting again within the impact, and a
  resting one stepped large at the cost of a fall, with the figures of small
  steps throughout.

## The pendulum (`experiments.pendulum`), the block the swinging ones stand on

**Why a block** (Marcel, 2026-11-14, choosing the order of the next exhibits:
all six of the plan's first stage, the shared pendulum first). The pendulum
wave, the harmonograph, the coupled pendulums and Galileo's interrupted
pendulum are each a plane pendulum with something added, so the pendulum is
written once (`domain/experiments/pendulum.py`, ported to
`simulate/pendulum.ts`) and answered two ways that check each other:

- **exactly**, undamped and let go from rest: `sin(θ/2) = k·cd(ω₀t | k²)`,
  `k = sin(θ₀/2)`, Jacobi's elliptic functions by the AGM (Abramowitz & Stegun
  16.4), the argument taken modulo the period so a minute in is as exact as a
  second; the period `T = T₀·2K(k²)/π`;
- **stepped**, by classical Runge–Kutta over any system at a fixed step (1 ms),
  for what has no closed form: damping, a peg, a spring between two pendulums.
  The step itself has lived in `numerics.py` since 2026-11-22 (see "Shared
  code out of the pendulum" below).

**Checked by** `tests/unit/test_experiments.py`: Jacobi's identities, its limits
(sin and cos at `m = 0`, tanh and sech at `m = 1`) and its slope; `K(½)` from
A&S's table (a swing to the horizontal takes 18 % longer than a small one) and
the series `1 + θ₀²/16 + 11θ₀⁴/3072` for small swings; the exact pendulum
against the stepped one to 10⁻⁷ degrees over ten seconds, at 5°, 60° and 150°;
a minute in as exact as a second; a damped swing dying away as `e^(−ct/2)`.

## The pendulum wave (`experiments.wave`)

**The exhibit.** A row of pendulums, the longest at one end, each next a little
shorter, let go together from a board: they swing together, pull apart into a
wave, snakes, apparent chaos, two, three, four groups — and after a minute all
swing in step again.

**The model** (`domain/experiments/wave.py`). No pendulum knows of the others;
the pattern is in the lengths. The `n`-th swings `N + n` times in the cycle `Γ`,
so its period is `Γ/(N + n)`; after `Γ` all are back, at `Γ/k` they stand in
`k` groups. The default row is fifteen pendulums, `Γ` a minute, `N = 51`: from
34 cm to 21 cm.

**What the textbook leaves out**, and the page shows: a wider swing takes
longer (1.7 % at 30°), so a row is tuned for one swing. Here the lengths are
the exact ones for `tuned_deg` (15°), and a release wider *or narrower* comes
back skewed — every pendulum off by nearly the same share, which after a cycle
is the most degrees for the short ones. The skew after a cycle (the largest lag
less the smallest, in degrees of a swing) is 22° let go at 0°, nil at 15°, 65°
at 30°; tuned by the small swing's formula, the default row let go at 15° comes
back 22° skewed.

**The page.** The row from above (the waves and snakes) and from its end (the
lengths fanning out), at true scale; a clock in real time, double or fivefold,
and buttons to stop at ½, ⅓, ¼ and the whole cycle — the exact pendulum is
answered for any instant, so a jump costs nothing; the release swing in the
play, the count, cycle, `N` and the tuning in "Change the exhibit"; the skew
over the release swing as the trick's chart. `POST /experiments/wave` answers
the lengths, each pendulum's lag and the skew curve; the browser tunes the row
itself (`simulate/wave.ts`) so a slider moves the drawing at once. The preview
runs at double speed.

**Left out, and said:** air and the pivots' friction, which in a real row damp
the swing over minutes and so slowly change its period too; the bobs' size; a
string that stretches.

**Checked by** `tests/unit/test_experiments.py`: each pendulum swings its whole
number in a cycle; let go at the tuned swing the row is together after `Γ`
(to 10⁻⁶ degrees) and at `Γ/2` stands at ±15°, even and odd; at `Γ/3` three
groups in two angles; the skew curve's numbers above and its two sides; the
short ones fall behind the most.

**Joins the experiment of the week** with its first round, as every exhibit
of the second series does: `SECOND_SERIES` in `exhibits.ts`, the day of the
joint deploy (Marcel, 2026-11-15), is before `WEEKLY_EPOCH`.

## The harmonograph (`experiments.harmonograph`)

**The exhibit.** Two pendulums side by side, a pen on one swinging across, a
drawing board on the other swinging along; both let go, the pen draws what the
two swings make together, a spiral that grows smaller as both die away — a
rosette, a loop or a star depending on their beats.

**The model** (`domain/experiments/harmonograph.py`). Two plane pendulums from
the block, each with its length, swing, phase and linear damping, stepped
together by Runge–Kutta at 1 ms (the full `sin θ`, so no closed form); the pen
at `(L₁·sin θ₁, L₂·sin θ₂)` on the board. A phase starts a pendulum part way
through its *exact* swing, at the rate its energy leaves it, so a phase never
widens the swing (the small swing's `θ' = −ω₀θ₀ sin φ` did, by a little, and
the first closure test caught it: an exact 2:3 missed by 14 µm).

**What it shows.** At a simple ratio, both let go equally wide and undamped,
the figure closes on itself after two of the pen's swings (to 10⁻⁹ m); let go
at 30° and 5° it drifts open, the wider swing being the slower one. Near a
ratio `p:q` it keeps its shape and turns once every `1/|q·f₁ − p·f₂|`: the
default pair, 0.67 % off 2:3, turns once in 90 s; it fades to a tenth in
`2·ln 10/c`, 230 s at `c = 0.02/s`. The beats `f₁, f₂` are the swings' as they
are let go, `1/T(L, θ₀)`: the first version took the small swing's for both,
and a pen at 30° over a board at 5° was said to turn in 90 s where it turns in
26 at first, slowing towards 90 as both die away (the mathematics check,
2026-11-17).

**The page.** A canvas the pen draws on, a few hundred steps a frame, in real
time, fivefold or twentyfold; "Finish the drawing" draws the rest at once (to
300 s); "Save picture" writes a PNG in the browser, nothing sent. The ratio
(1:1, 1:2, 2:3, 3:4) and its detune set the board's length, `L₂ =
L₁·(p/(q·(1+d)))²`; the board's phase, both swings, the friction and the pen's
length are sliders. **No route:** the build comes with `/experiments/defaults`
and everything shown — the path and the figures — is the port's
(`simulate/harmonograph.ts`), held to the engine by `engine-cases.json`;
`write-test-fixtures.py` lists it as `UNROUTED`.

**Left out, and said:** the board's swing in the second direction (a real board
hangs on a gimbal), the pen's friction on the paper, damping that grows with
speed.

**Checked by** `tests/unit/test_experiments.py`: the closure and the drift
above, the fade against `e^(−ct/2)`, the default figures, the nearest simple
ratio in lowest terms; the port draws frame by frame exactly what it draws in
one go (`simulate.test.ts`).

## The double cone (`experiments.cone`)

**The exhibit.** Two straight rails spread apart in a V and rise as they go; a
double cone laid across them at the narrow, low end rolls by itself up to the
wide, high end.

**The model** (`domain/experiments/cone.py`). The cone thins by `tan α` per
metre from its middle (radius `R`); each rail spreads by `tan β` and rises by
`tan γ` per metre along the centre line. Wider apart, the rails hold the cone
on a thinner part, so its axis stands at `z(x) = x·tan γ + c·(R − d(x)·tan α)`,
a straight line of slope `m = tan γ − c·tan α·tan β`: the cone rolls up when
`m < 0`. **The exact contact:** a sloping rail that runs skew to the cone
touches it a little off the point under its axis; where the line just grazes
the solid cone is a quadratic, `c = (√(sec²γ − k²) − k·tan γ)/(1 − k²)`,
`k = tan α·tan β` — held in the tests to a scan of the rail that knows nothing
of the formula (10⁻⁸ m). `c` is 1.002 for the default build and exactly 1 where
`m = 0`, where the contact lies right under the axis: so the textbook's
`tan γ* = tan α·tan β` is the exact boundary, though its heights are not. The
contact lies square to the axis's path, so the cone rolls on it without
slipping (checked in the scratchpad before it was written: `s*/h* = m` to the
last digit). **The roll:** Lagrange's equation for
`½(1 + m²)(1 + (3/10)R²/ρ²)ẋ² + g·m·x`, `ρ` the contact radius, which shrinks
up the rails — so the cone rolls up quickly and slows near the top though it is
still falling; Runge–Kutta at 1 ms, energy kept to 10⁻¹⁰ J/kg; stops hold it at
the ends.

**What it shows** (the default: R 6 cm, α 20°, β 20°, γ 4°, rails 30 cm from
6 cm apart). The rails rise 2.1 cm while the axis falls 1.9 cm; up to 7.5° the
cone rolls up; it reaches the top in 1.5 s at 0.17 m/s, spinning 2.8 times a
second on its thin part. At 10° it rolls down, and is laid at the top. The
contact lies `s*·r₀` along the rails from the axis's place, behind it where the
cone rolls up, so laid at the very end it would touch the rails before they
begin and rest on their ends, which the model does not have: it is laid, and
stopped, where its contact lies on them (`on_rails_m`) — 3 mm up in the
default build, which changes the run by 2 ms, and 84 mm of a 10 cm rail at the
sliders' corner, where the first version had it roll from nowhere (the
mathematics check, 2026-11-17).

**The page.** The cone from the side (the rails one rising line, the middle
disc, the circle it rolls on, a turning spoke, and the dashed path of its axis)
and from the front (the rails spreading as they climb, the rhombus sinking
between them), in real time or a quarter; "Let go" lays it where it can roll
from. The three angles, the radius, the rails' length and their gap at the
bottom are sliders; a build whose rails reach the tips says the cone would fall
through. The trick's chart: the rails' height and the axis's along the rails.
**No route**, as the harmonograph: everything is the port's (`simulate/cone.ts`).

**Left out, and said:** rolling resistance, the rails' thickness, the wobble of
a cone laid on askew.

**Checked by** `tests/unit/test_experiments.py`: the contact against the scan,
the heights and the boundary, the roll's energy, time and end speed, and the
cone laid at the top of steep rails.

## The water parabola (`experiments.parabola`)

**The exhibit.** A round vessel of water on a turntable: as it spins, the water
sinks in the middle and climbs the wall — until the middle runs dry.

**The model** (`domain/experiments/parabola.py`). Water turning with the
vessel as one body has a surface square to gravity and the centrifugal pull
together, the paraboloid `z = z₀ + ω²r²/(2g)`; its volume fixes `z₀ = h −
ω²R²/(4g)`, so the middle sinks as far as the rim rises. Past `2·√(g·h)/R` the
middle is dry inside `r₀² = R² − 2R·√(g·h)/ω`, the rim at `R·ω·√(h/g)`; past
the vessel's top it spills. As a mirror its focus is `g/(2ω²)` above the vertex.
**Spinning up:** the water follows the vessel over Greenspan and Howard's
spin-up time `τ = h/√(νΩ)` (one Ekman layer at the bottom, `Ω` the faster
rate), a relaxation of the water's rate — a model of how long, said as such,
not of the flow meanwhile; the surface is drawn as rigid rotation at the
water's rate.

**What it shows** (the default: 30 cm across, 30 cm high, filled 10 cm deep).
The middle runs dry at 126 turns a minute and the water spills at 189; the
water takes about half a minute to follow (28 s at the dry rate). One turn in
8.5 s puts the mirror's focus 9 m up.

**The page.** The vessel cut through (the surface, the level at rest dashed,
two vertical rays reflected to the focus) and from above, from outside or
turning along with the vessel — then the vessel's marks stand still and specks
in the water show how far it lags; a turntable slider in turns a minute, real
time or tenfold. The page's water turns with the vessel on arrival; the
overview's preview switches the turntable on and off. The trick's chart is the
middle's and the rim's height over the speed. **No route**: the port's
(`simulate/parabola.ts`).

**Left out, and said:** surface tension and the meniscus, the vessel's wobble,
the swirl after a sudden change.

**Checked by** `tests/unit/test_experiments.py`: the volume against a sum over
rings at five rates, wet and dry; the equal sink and rise; the dry rate and the
rim's continuity past it; the mirror's focus; the spill rate both ways; the
spin-up against `1 − e^(−t/τ)`.

## The coupled pendulums (`experiments.coupled`)

**The exhibit.** Two equal pendulums side by side joined by a soft spring; one
pushed, the swing wanders to the other and back, again and again.

**The model** (`domain/experiments/coupled.py`). Two plane pendulums from the
block and a spring of stiffness `k` at the distance `a` below the pivots, taken
horizontal: `θ₁'' = −(g/L₁)·sin θ₁ + κ₁·(sin θ₂ − sin θ₁)·cos θ₁ − c·θ₁'`
and its mirror, `κᵢ = k·a²/(mᵢ·Lᵢ²)`, the full sines stepped by Runge–Kutta at
1 ms, energy kept to 10⁻⁹ of itself. **The modes** for small swings: together
at `√(g/L)`, against each other at `√(g/L + 2κ)` (equal pendulums; the 2 × 2
system's roots in general); a push to one is half of each, and the swing
wanders over and back once in the beat `2π/(ω₂ − ω₁)`. Unequal pendulums hand
over only `4κ₁κ₂/((a₁ − a₂)² + 4κ₁κ₂)`, `aᵢ = g/Lᵢ + κᵢ` (Rabi's formula).

**What it shows** (the default: 50 cm, 200 g, 1 N/m at 25 cm). Over and back
in 23 s, all of it reaching the other; let go together, the spring never
stretches; 50 against 55 cm, 0.56 of it reaches the other, which a two-minute
run confirms to 1.5 %. The shares on the page are of everything put in, the
spring's stretch at the start included — pulled aside alone, the left pendulum
stretches the spring too (6 % of the default push; the first chart had divided
by the pendulum's energy alone and climbed past 100 %). So from 10° the chart
of 50 against 55 cm peaks at 54.5 %, two points under Rabi's 56, which is for
small swings and of the pushed pendulum's own (of that, 58 % reach the other
at 10°); the page says "about" (the mathematics check, 2026-11-17).

**The page.** The pair from the front with the spring, let go one way, both
alike or against each other, real time or threefold; bars of each pendulum's
share as it wanders; the two modes' periods, the beat and the share handed
over. The spring, its height, the right pendulum's length, the mass and the
damping are sliders. The trick's chart is the two shares over two beats. **No
route**: the port's (`simulate/coupled.ts`).

**Left out, and said:** the spring's mass, its sag and slant; air beyond one
linear damping.

**Checked by** `tests/unit/test_experiments.py`: the two modes' rates, the beat,
the full exchange at half a beat, nothing exchanged together, Rabi's share
against a run, the energy kept without damping.

## Galileo's interrupted pendulum (`experiments.peg`)

**The exhibit.** A pendulum whose string, swinging through the vertical, is
caught by a peg below the pivot; the bob goes on round a smaller circle and
still rises to the height it was let go from — or, the peg low enough, swings
right over it or lets the string go slack.

**The model** (`domain/experiments/peg.py`). Three motions, one at a time:
round the pivot (`θ'' = −(g/L)·sin θ`), round the peg (`φ'' = −(g/r)·sin φ`,
`r = L − d`, the speed kept at the catch), free while the string would have to
push (`r·φ'² + g·cos φ < 0`), until the string round the peg is straight again
and jerks taut, taking the speed along it — the one place energy is lost. In
flight the string follows the bob round the peg (its angle round the peg,
unwrapped): a bob that flies over the peg to the other side winds the string
round it for good, one that flies under it takes the string off it, and the
string then jerks taut at `L` from the pivot. The first version took every
taut string as round the peg and unwound, so the page's slack string (a metre,
the peg at 55 cm, from the horizontal) flew over the peg and was then swung as
a 1 m pendulum again, saying the string came off the peg; the mathematics
check (2026-11-17) found it. Each
switch is found within its 1 ms step by bisection on the stepped state (40
halvings) and the step split there; the port does the same, switch for switch.

**What it shows.** Round the peg the bob rises exactly to its starting height
(3·10⁻⁸ m in a run sampled every millisecond). It goes over the peg from
`h ≥ 2.5·r`; between `r` and that, the string goes slack at `(r + 2h)/3`, which
the engine's slack event meets to 10⁻¹²: let go from the horizontal on a metre,
over the top with the peg at 61 cm, slack at 59.

**The page.** The pendulum, the peg — dragged with a finger or set by a
slider — the starting height dashed across both sides and, where it goes slack,
the slack height; a trail of the last 2.5 s; what just happened in words (the
peg catches the string, it goes slack, jerks taut, winds round the peg); the
three cases as buttons in the trick. **No route**: the port's
(`simulate/peg.ts`).

**Left out, and said:** the peg's thickness, a string that stretches, air.

**Checked by** `tests/unit/test_experiments.py`: the same height, energy kept
until the jerk, the threshold both sides, the slack height, the jerk's loss,
and the string wound over the peg in flight (at 55 cm) or taken off it (at
45 cm).

## Maxwell's wheel (`experiments.maxwell`)

**The exhibit.** A heavy wheel on a thin axle hangs from two strings wound round
the axle; let go, it unwinds slowly, turns round at the bottom with a jerk and
winds itself nearly back up — a large yo-yo.

**The model** (`domain/experiments/maxwell.py`), all of it a closed form. The
strings come off without slipping, so `a = g/(1 + k)`, `k = I/(M·r²)` (`I` ½·M·R²
for a disc, M·R² for a ring), the strings pull `M·(g − a)`, and `k/(1 + k)` of
the energy of motion is in the spin. **Losses:** the strings bend round the
axle and rub, a braking torque of `c·T·r` that opposes the spin both ways: the
fall at `g/(1 + k/(1 − c))`, the climb slowed at `g/(1 + k/(1 + c))`, each
climb `a↓/a↑` of the height before. The page's formula first left `c` out,
which gives 3.23 s for the fall the page shows as 3.3 (3.28; the mathematics
check, 2026-11-17). **The turn-round:** a first sketch had the
centre swing round a half-circle about the strings' ends, the textbook picture
— but the strings hang straight down and can pull only up, so nothing pushes
the centre sideways; it was dropped before it was written. Instead, as the plan
asked, the strings' stretch is the model's parameter: a spring of stiffness `s`
(both strings) stops the fall and throws the wheel back up at the same speed,
the spin going on through; it lasts `(2π − 2·atan(v·w/g))/w`, `w = √(s/M)`,
and peaks at `M·g + s·A`. The jerk itself loses nothing in the model.

**What it shows** (the default: a 0.5 kg disc of 6.5 cm on a 5 mm axle, 60 cm
of strings, `c` 3 %, `s` 10 kN/m). 98.8 % of the energy of motion is in the
spin; the fall takes 3.3 s; the jerk 22 ms at 30.7 N, 6.3 times the weight, the
strings stretched 3.1 mm (25 ms, 31.2 N and 6.4 times from slack strings); each climb reaches 94 % of the height before. A ring
of the same size puts 99.4 % into its spin.

**The page.** The wheel from the front on its strings, spokes turning, in real
time, a quarter or a twentieth (where the jerk shows); the strings' pull and
its multiple of the weight; the energy of motion split between falling and
spinning; the shape, axle, wheel, mass, strings' length, rubbing and stiffness
(logarithmic) as controls; the trick's chart, height and pull over two bounces,
sampled 400 times a second so the jerk's spike shows. **No route**: the port's
(`simulate/maxwell.ts`).

**Left out, and said:** the axle's own spin, a wobble, the strings' mass, air,
the strings winding on during the jerk itself.

**Checked by** `tests/unit/test_experiments.py`: the fall's energy, a lossless
climb back to the start, the same share lost each climb, the jerk against a
stepped spring (duration, end speed, peak to 10⁻⁹), and the closed form at its
seams.

## The chaotic pendulum (`experiments.chaos`)

**The exhibit.** A pendulum hung from the end of another; pushed gently both
swing calmly, pushed hard the lower arm flails and never repeats, and whoever
pushes it twice "the same" sees two different dances.

**The model** (`domain/experiments/chaos.py`). Two point masses on light rods,
Lagrange's equations in their usual closed form, stepped by the block's
Runge–Kutta at 1 ms; the energy is the check (in twenty wild seconds it drifts
by less than 10⁻⁷ of (m₁ + m₂)·g·(L₁ + L₂), the scale `run` divides by; against
the wild start's own 2.2 J that is 1.008 · 10⁻⁷, just over a ten-millionth,
which the check case reads). Where a light upper arm under a heavy lower one
whips round, the millisecond is cut into equal parts (`step_for`): as many as
keep each arm's turn in a step within 0.035 rad, by a bound on its rate from the
energy (all of it above the lowest hang as motion, through the inertia matrix's
least eigenvalue). The first version kept 1 ms everywhere, and the mathematics
check (2026-11-17) found the energy off by 28 % to 110 % at the page's corners:
at 50 g over 2 kg on 10 cm rods from 120°, 80 % in 10 s; cut to a seventh,
5·10⁻⁴. The default build keeps its millisecond. For small swings the two modes are
`ω² = (g/L)(2 ∓ √2)` (equal arms and masses; the general quartic's roots), and
a start in the slow mode comes back after its period. **Chaos, measured:** the
page lets go the pendulum and a twin whose upper arm is nudged (1° down to
10⁻⁵°) and draws the gap between them — angles and rates, each rate over
`√(g/L₁)` — on a logarithmic scale. The largest Lyapunov exponent is measured
Benettin's way, a twin a hundred-millionth away whose gap's growth is summed in
logarithms every tenth of a second before it is set back: from 120°/120° over a
minute, 2.82 a second whatever the gap (10⁻⁶ to 10⁻¹⁰); gently (5°/7°), under
0.01. A first version fitted a slope to one pair's gap, which gave 1.9 to 3.8
with the nudge — one stretch of one path says little — and was dropped. The
step matters as the gap does not: over half a minute 2.4 at 1 ms and 3.1 at
0.5 ms, over two minutes 2.7 (and 2.64 to 2.71 over four, at 1, 0.5 and
0.25 ms). The page measures over 30 s, after the sliders settle — four minutes
would hold the main thread for a second, three with a light upper arm — so it
shows one decimal and says it is a few tenths either way; it showed two (the
mathematics check, 2026-11-17); the port is held to the
engine with a twin 10⁻⁴ away, since at 10⁻⁸ the gap's subtraction loses eight
digits that chaos then magnifies.

**The page.** The pendulum and its paler twin with the lower weight's trail;
starts gentle, wild or nearly upside down, both arms' starts and the twin's
nudge as controls; the gap as a power of ten as they part. The trick: the gap
over twenty seconds, a straight line on the logarithmic scale, the measured
exponent and the doubling time `ln 2/λ`. **No route**: the port's
(`simulate/chaos.ts`).

**Left out, and said:** the rods' mass and the bearings' friction (one linear
damping), air; the exhibit's arms are physical pendulums, the same chaos with
other numbers.

**Checked by** `tests/unit/test_experiments.py`: the modes, the slow mode's
return, the energy, the twin's parting wild and not gently, the exponent's
independence of the gap.

## The chaotic waterwheel (`experiments.waterwheel`)

**The exhibit.** Leaking cups round a wheel, water pouring into the top one:
the wheel turns, slows, stalls, turns back, and never repeats.

**The model** (`domain/experiments/waterwheel.py`), Malkus's wheel as Strogatz
writes it (§9.1): the water's spread round the rim by its first harmonic
`A sin θ + B cos θ`, the wheel's rate `Ω`, inflow `q` at the top, leaks `K`
everywhere, the axle's brake `ν`. With `τ = K·t`, `x = Ω/K`, `y = c·A`,
`z = ρ − c·B`, `c = π·g·r/(ν·K)` these are exactly Lorenz's equations with
`σ = ν/(K·I)`, `ρ = π·g·r·q/(ν·K²)` and `b = 1` — the test integrates the
wheel's own equations in seconds and finds the engine's `x`, `y`, `z` in them to
10⁻⁸. Stepped by the block's Runge–Kutta at 0.01 τ, from rest with the water
heaped at the top and a nudge of 10⁻³.

**What it shows** (σ 10, K 0.2/s). Below ρ = 1 the wheel stands; up to
`ρ_H = σ(σ + 4)/(σ − 2)` = 17.5 steady turning at `√(ρ − 1)` (in units of `K`)
is stable, and at ρ 10 the wheel settles to it; above, it wanders — at the
default ρ 28 twenty-odd reversals in 200 s at gaps that range more than
threefold. What the page says the wheel does is read from the 200 s it shows
(`behaviour`, from the run's last third: steady, a pattern whose gaps repeat
some `p ≤ 4` on to 2 %, chaotic, or not yet settled), not from `ρ_H` alone,
which the first version did: the mathematics check (2026-11-17) found the
wheel at ρ 15–17, below `ρ_H`, still wandering after 250 of 300 s, and at
σ 15, ρ 32, above its `ρ_H`, locked into reversals at equal gaps. Above `ρ_H`
most taps stay chaotic (σ 10, ρ 20 to 200).

**The page.** The wheel with eight cups hanging upright, each as full as the
harmonic says at its place, the stream from the tap, beside Lorenz's butterfly
(`x` against `z`) drawn as the wheel runs; the tap (ρ) and the brake (σ), real
time or fourfold, the regime in words and the speed in turns a minute. The
trick's chart is the speed over 200 s and the number of reversals. **No route**:
the port's (`simulate/waterwheel.ts`).

**Left out, and said:** the cups themselves (the water is spread smoothly, only
its first harmonic counts), the wheel's tilt, splashing.

**Checked by** `tests/unit/test_experiments.py`: the wheel's equations against
Lorenz's, the three regimes and the steady rate, the reversals' spread, the
cups full at the top at rest, and what the page says from the run it shows.

## Foucault's pendulum (`experiments.foucault`)

**The exhibit.** A long pendulum swinging for hours whose plane turns against
the floor, knocking over a ring of pins: the floor turns under it with the
Earth.

**The model** (`domain/experiments/foucault.py`). The linear swing on the
turning Earth, `x'' = −ω₀²x + 2Ω_z y'`, `y'' = −ω₀²y − 2Ω_z x'`,
`Ω_z = Ω·sin φ`, `Ω` once a sidereal day; let go from rest it has the closed form
`ζ = A·e^(−iΩ_z t)(cos ω′t + i(Ω_z/ω′) sin ω′t)`, `ω′ = √(ω₀² + Ω_z²)` — held to
the stepped equations to 10⁻⁹ m over a hundred swings, so the page shows any
hour without stepping. **What it shows:** in Winterthur (47.5°N) 11.1° an hour
clockwise, once round in 32.5 hours; at the pole once a sidereal day (23.93 h),
at the equator never, in the south the other way.

**The page.** The pendulum from above (12 m, 50 cm swing), the plane dashed,
the bob's trail, a ring of 24 pins that fall as either end of the plane reaches
them; real time, a minute, ten minutes or an hour a second; Winterthur, the
North Pole, the equator and Sydney, or any latitude; hours gone by, the plane's
turn and the full turn's hours. The trick's chart is the turn an hour against
the latitude, a sine. **No route**: the port's (`simulate/foucault.ts`).

**Left out, and said:** air, which stops a real swing within hours unless it
is kept going; the ellipse of a careless release; Airy's extra turn of a wide
swing.

**Checked by** `tests/unit/test_experiments.py`: the closed form against the
stepped equations, the turn in Winterthur and its direction, the pole, the
equator and the south.

## The Coriolis carousel (`experiments.coriolis`)

**The exhibit.** Two people opposite each other at the edge of a turning
platform roll a ball across; it curves away and misses, though nobody pushes
it. Seen from outside there is no curve to explain.

**The model** (`domain/experiments/coriolis.py`), two things to throw, both in
closed form. A sliding puck keeps its velocity — the throw plus the seat's own
`Ω × r` — and goes straight seen from outside. A rolled ball must keep up with
the turning surface under it; the friction that keeps it rolling turns its
velocity at `(k/(1+k))·Ω`, 2/7 of the platform's rate for a solid ball, so seen
from outside it runs on a circle (checked against the closed form's own
derivative). Turned back by `−Ω·t` either is what a rider sees; the puck's
turned-back path is held to the stepped Coriolis and centrifugal equations to
10⁻⁹ m. **The lead:** where the ball leaves the edge (by bisection on the
distance) against the other seat; the aim that hits it, found by scanning the
aim a degree apart for a true change of the miss's sign — not its jump from
+180° to −180° where the ball leaves past the thrower's own seat, which a
plain bisection had first taken for a hit — then bisecting.

**What it shows** (2 m radius, 6 rpm, a 3 m/s throw). A straight throw misses
the other seat by 86° clockwise as the riders see it; aiming 50° ahead hits
(a rolled ball, 43°). Too fast a platform for too slow a throw: no aim does.

**The page.** The carousel from above riding along or from outside, the seats
and the aim, the path drawn as the throw replays; a puck or a ball; aim, speed
and the platform's turns a minute; the miss, the flight's time, and "Aim
ahead" setting the lead. **No route**: the port's (`simulate/coriolis.ts`).

**Left out, and said:** rolling resistance and slipping (the ball rolls from
the start), the ball's size, air.

**Checked by** `tests/unit/test_experiments.py`: the riders' view against the
stepped equations, the straight puck and the ball's 2/7 turn, the misses and
the leads.

## Newton's cradle (`experiments.cradle`)

**The exhibit.** Five steel balls on strings, just touching. Let one fall and
one flies off at the far end; two in, two out; after a while the middle ones
swing too.

**The model** (`domain/experiments/cradle.py`). Each ball a pendulum along its
arc, neighbours pushing only where they overlap, by Hertz's law
`F = K·δ^{3/2}` with `K = (4/3)·E*·√R*` for two equal steel balls, damped
Hunt and Crossley's way, `(1 + α·δ̇)` with `α = 8(1 − e)/(5e)` per metre a
second (Flores et al.), so a lone pair meeting at 1 m/s parts with `e` of that
speed. Not the ball cannon's damping, which divides by the speed a contact
closed at: the cradle's balls touch at rest, their contacts close at next to
nothing, and that damping glued the row. Stepped by Runge–Kutta, a
millisecond while all swing free; while any two press or are closing on each
other within two milliseconds' travel, a microsecond at a time, and the rest
of the millisecond in one step once none are (the whole millisecond in
microseconds cost four times the work for the same swings to a tenth of a
degree over twenty seconds). **The impact:** swung down free until the first
pair is near, then followed a microsecond at a time until every contact has
stayed open for 200 µs.

**What it shows** (25 mm steel balls, 15 cm strings, `e` = 0.95, one lifted
by 30°). The ball comes in at 0.63 m/s; the contact lasts 0.2 ms at nearly
900 N; 97 % of the energy the collision leaves is in the last ball (89 % of
what came in, 8 % going into the dents) and the first bounces back a little.
With 0.1 mm between the balls they meet one pair at a time: 99.9 % of what is
left, but only 87 % of what came in, every hit taking its share. The page said
"97 % of the energy" without saying of which (the mathematics check,
2026-11-17).
Two lifted leave as a train of two waves, the last at 0.70 m/s and the next at
0.49 m/s, 97 % between them (92 % of what came in) — the solitary waves of a Hertzian chain, which a
heavier striker sends as a train. With `e` < 1 what stays in the row grows
until all swing (the middle ball 2.5° wide in the fourth second); with
`e` = 1 it stays nearly still — the row's coming together is the losses'
doing.

**The page.** The row from the front, the balls in the chart's colours;
how many are lifted, touching or 0.1 mm apart, three speeds, the angle and
`e`; the first collision's far share, length and largest force, and every
ball's speed after it; a chart, second by second, of each ball's widest
swing. The loop spends at most 10 ms a frame stepping: a row pressing on
itself for long stretches is a thousand steps a millisecond, and the clock
slips a moment rather than the page stutter (said under "How it is
computed"). **No route**: the port's (`simulate/cradle.ts`); the engine's
`run` is not ported, the test samples the port's steps the engine's way.

**Left out, and said:** the strings' stretch and the frame's give, the balls
rolling and twisting, air.

**Checked by** `tests/unit/test_experiments.py`: a gapped row against one in,
one out exactly; the touching row's momentum and energy kept at `e` = 1 and
its far share; a lone pair's peak force against Hertz's closed form; the
page's figures — 97 %, 99.9 %, 0.2 ms, under 900 N, 0.70 and 0.49 m/s, 2.5°
against nearly nothing.

## The gravity well (`experiments.well`)

**The exhibit.** A wide funnel, almost flat at the rim and ever steeper
towards the hole; a ball pushed off at the rim circles for a long time, ever
lower and faster, and drops in.

**The model** (`domain/experiments/well.py`). The wall `z = −k/r`; a small
ball rolling without slipping, its spin 2/5 more inertia (`T = (7/10)·m·v²`,
the sphere exhibit's way, every push along the wall moving it at 5/7);
Lagrange's equations in `(r, φ)` on the surface, stepped by Runge–Kutta a
millisecond at a time. Rolling resistance `C·N` against the motion, `N` the
wall's whole push: the weight's share across it and what holds the ball on its
curved path (meridian convex, parallel concave), faded below 1 mm/s as on the
sphere. A lap is counted where φ crosses a whole turn, interpolated within the
step; its radius is the time-mean over the lap. **Why Kepler:** on a circle
`r·φ̇² = (5/7)·g·k/r²`, an inverse square, so `T² = 28π²r³/(5gk)` exactly.
Off the circle the steepness `1 + z′²` and the wall's curvature enter, and
the path is a turning rosette, not an ellipse.

**What it shows** (k = 0.01 m², rim 40 cm, hole 3 cm, `C` = 0.002, started
at 0.9 of the rim). The circle at the start takes 0.44 m/s and 5.1 s a lap;
at the hole 0.12 s, 42 times less for twelve times nearer. From that circle
the ball drops in after 46 s and 75 laps, 42 of them in the last 10 s, every
lap within 3 % of Kepler's period for its mean radius, and its top speed more
than three times the start's: braked, it runs faster (a satellite's drag
paradox). Without resistance, pushed at 0.30 m/s, the nearest point turns 40°
a lap. The defaults were picked from a sweep: at `C` = 0.003 and
k = 0.005 m² the first lap already fell a fifth of the way in, and laps
strayed 10 % from Kepler; the chosen pair spirals for 46 s.

**The page.** The funnel from above (rings 2 cm of height apart, crowding
where it is steep) with the whole track, and cut through from the side;
the push's speed and direction, the rolling resistance, real time or four
times faster; "Circle" pushes off at the circle's speed; laps, the last lap's
time, the distance and speed; a chart of every lap's time against its mean
distance beside Kepler's circle. **No route**: the port's (`simulate/well.ts`);
the engine's `run` is not ported, the test samples the port's steps the
engine's way.

**Left out, and said:** the ball's spin about the wall's normal and every term
of its radius over the wall's curvature, air; a coin, which rolls on its edge
and leans.

**Checked by** `tests/unit/test_experiments.py`: energy and angular momentum
without resistance to 10⁻⁹ over 30 s; the circle held to 1 µm and its period;
the 40° rosette; the spiral's laps against Kepler; its time to the hole
against an independent Simpson count of the circles' energy drained by
`C·N·v` (46.09 s against the engine's 45.90 s); the speed-up ten laps apart.

## The resonant rods (`experiments.resonance`)

**The exhibit.** Steel rods of different lengths clamped upright in a table a
motor shakes a little; at one beat one rod swings wide and the others hardly
stir.

**The model** (`domain/experiments/resonance.py`). Each rod a clamped-free
beam, only its first mode kept: `β₁` found by bisection on
`cosh β·cos β = −1` (1.8751), the shape 1 at the tip, its participation
`Γ = ∫φ/∫φ²` by Simpson (1.566), both held to the textbook; `ω₀ =
β₁²/L²·(d/4)·√(E/ρ)` for a round rod. **Its own weight**: standing upright, a
rod carries it along its length, which softens it — the mode's Rayleigh
quotient loses `ρAg·∫(L − x)·φ'²`, so `ω² = ω₀² − Λ·g/L`,
`Λ = ∫(1 − ξ)·φ'²/∫φ²` = 1.571. Against Rayleigh–Ritz in twelve polynomials
that is the frequency to 0.01 % for the exhibit's rods (by hand, 2026-11-18),
and where `ω²` reaches nothing it puts the buckling load `ρAgL³/(EI)` at
`β₁⁴/Λ` = 7.87, within half a per cent of Greenhill's 7.837; such a rod is
refused. The first version left the weight out, and its rods rang up to 10 %
high (the mathematics check, 2026-11-17). The table `Y·sin θ`, `θ̇ = Ω`; per
rod `q̈ + 2ζω·q̇ + ω²·q = −Γ·ÿ_b`, stepped by Runge–Kutta a millisecond at a
time with the drive held through each step (a sweep moves it between steps;
the neglected `Ω̇` term is a few thousandths at 0.05 Hz/s). The steady swing
in closed form; the live swing `√(q² + (v/ω)²)`.

**What it shows** (six 2 mm steel rods, 1.0 to 0.5 m, ζ = 0.01, the table
1 mm each way). They ring at 1.27, 1.61, 2.09, 2.78, 3.84 and 5.58 Hz, their
weight taking 10 % from the metre rod and 5 % from the 80 cm one. In step with
the 80 cm rod its tip swings 78 mm, the neighbours at most 4; 3 % off, 26 mm.
From rest a swing grows to 1 − 1/e in `1/(ζω)`, 7.6 s at 2.09 Hz. A sweep from
1 Hz at 0.05 Hz/s gives the same rod only 38 mm, half, and at 2.3 Hz. The page measures a rod's swing as `√(q² + (v/Ω)²)`, at the drive's
frequency, which a steady swing keeps exactly; the first version took the
rod's own `ω`, and the mathematics check (2026-11-17) found the dashed record
of a sweep up to 4.6 times above the steady curves for rods driven well above
their tone (and the sweep's widest at 40 mm).

**The page.** The rods on their table (the table's millimetre true to scale,
which is the point), each rod's frequency under it; the table's beat, a sweep
from 1 to 6.5 Hz that records every rod's swing, "Settle", real time or four
times faster, the damping; the widest swing; the steady curves of all rods
with the sweep's record dashed over them and a line at the beat. The chart is
redrawn every half second of the run, not every frame: its points made the
page stutter. **Sound**, muted until switched on (Marcel's call, 2026-11-15):
`shared/lib/use-tones.ts`, one sine per rod at its frequency seven octaves up
(162 to 714 Hz), as loud as it swings; no audio graph exists while off, the
context is closed when switched off, nothing is stored. **No route**: the
port's (`simulate/resonance.ts`); the engine's `run` is not ported, the test
samples the port's steps the engine's way.

**Left out, and said:** the higher modes (the second at 6.27 times the
first), the rod's stiffening at wide swings, the table's give.

**Checked by** `tests/unit/test_experiments.py`: β₁, β₁² and Γ against the
tables; the second mode's ratio found independently; Λ found again from the
shape by differences, its buckling load against Greenhill's, the tenth and the
twentieth the weight takes; the six frequencies; the 78, 4 and 26 mm; the
stepped swings settling on the closed form within 1 %; the build-up to
1 − 1/e in 7.6 s; the sweep's 38 mm at 2.3 Hz, the widest `|q|` itself; a rod
driven at 5.0 times its tone measured as it swings.

## The gyroscope wheel (`experiments.gyroscope`)

**The exhibit.** A heavy wheel hung on a string by one end of its axle: still,
it drops; spun, it stays up and wanders slowly round the string. Beside it a
suitcase hiding such a wheel tips sideways when carried round a corner.

**The model** (`domain/experiments/gyroscope.py`). Lagrange's heavy symmetric
top with the axle's end as the fixed point; the wheel a hoop (`I₃ = m·r²`,
`I₁ = m·r²/2 + m·d²` about the pivot). Euler's angles; `ω₃` and `p_φ` kept,
so `φ̇` follows from `θ`, and only `θ` (with `ψ` beside it for the drawing) is
stepped by Runge–Kutta, a millisecond at a time. The steady turn at a tilt is
the slow root of the quadratic; level, `m·g·d/(I₃·ω₃)`. A run stops where the
axle hangs within 10° of straight down: the equations hold there, the string
would long have swung.

**What it shows** (2 kg hoop of 30 cm on a 15 cm axle, 200 rpm, level). Still,
it hangs nearly straight down after 0.37 s. Spun, it turns once round the
string in 8.1 s, and twice as slowly spun twice as fast; let go from rest it
keeps that pace on average to half a per cent, dipping 3.2° — the turning
point of energy and the two kept momenta, `2I₁mgd·u² − L₃²·u − 2I₁mgd = 0`,
`u = cos θ` — and nodding 4.4 times a second, its track arches with points
at the starting height. The suitcase turned a quarter turn a second: 5.9 N·m
across, 600 g at the end of a metre rule.

**The page.** The wheel on its string seen a little from above, one spoke
coloured so the spin shows; under it the axle's dip against its turn over the
last round; the spin, the tilt at release, released at rest or already
circling, real time or four times slower; the round's time, the nods a
second, the dip, the suitcase's torque. **No route**: the port's
(`simulate/gyroscope.ts`); the engine's `run` and `energy_j` are not ported
(the page shows neither; the energy is held in Python), the test samples the
port's steps the engine's way.

**Left out, and said:** the string's swing and stretch, friction in the
bearing and at the string, air; spokes and hub beside the hoop.

**Checked by** `tests/unit/test_experiments.py`: the drop in 0.37 s; energy
to 10⁻⁸ over 20 s and a steady release keeping its tilt to 10⁻⁶ degrees; the
8.1 s round, its halving, the mean pace; the dip against the kept quantities'
quadratic to 0.02°; the 4.4 nods a second; the 5.9 N·m.

## The chain and the arch (`experiments.arch`)

**The exhibit.** An arch of loose stones, no mortar, that carries itself and a
load once the keystone is in; beside it a chain hanging between two hooks,
whose shape, upside down, is the best shape for an arch.

**The model** (`domain/experiments/arch.py`), Heyman's: masonry takes no
tension, friction holds, the stones do not crush. The centre line
(semicircle, pointed — two arcs of the span's radius — or the upside-down
chain `y = h − a·(cosh(x/a) − 1)` through the springings and as high as the
semicircle) is cut into equal stones by joints across it; a stone's weight is
its quadrilateral's, at its centroid; a load stands on the extrados. Left of
joint `j`, the support's `(H, V)` and its moment `M` about the first joint,
with the weights, give `e_j = −M̄_j/N_j`, all linear in `(H, V, M)`. The arch
stands if some `(H, V, M)` keeps `|e_j| ≤ t/2` everywhere; the least `λ` that
keeps `|e_j| ≤ λ·t/2` is found exactly: for a fixed `V`, a polygon in `(H, M)`
cut from a box by every joint's two half-planes, `λ` bisected 40 times; `V`
is half the load when the load is symmetric and otherwise found by 40 golden
steps (the least `λ` over `V` is quasi-convex, the feasible set convex). The
drawn line crosses the joints at the polygon's centroid's `e_j`; joints within
2 % of the widest reach are marked (amber standing, red breaking), from a
reach of half the thickness up.

**What it shows** (2 m span to the centre line, 25 cm stones, 16 of them).
A semicircle needs `t/R` ≥ 0.1075 (Milankovitch 1907; 0.10746 in 100 stones,
0.107 in 16): at 10 cm on its metre it breaks, where a pointed arch stands.
A catenary arch of sixteen stones over 2 m keeps its line within a hundredth
of half the thickness from 3 cm thick to 50; at the slider's 2 cm it is 0.014,
the straight stones' own bend telling against so thin a line. The reach goes
with the thickness over the span (16 stones: under a hundredth from a
seventieth of the span to about a third) and with the stones' number (eight
stones at 5 cm: 0.018). The page said "however thick" (the mathematics check,
2026-11-17). A load at the quarter point breaks the semicircle at 80 % of
its own weight, the catenary arch at 141 %; at the crown the catenary arch
has no limit in this model (the thrust line fits as two straight struts).

**The page.** The arch from the front with its stones, abutments, the thrust
line, the marked joints and the load's arrow; the shape, the thickness, the
stones, the load (to twice the arch's weight) and where it stands, the
upside-down chain on demand; the safety `1/λ`, the push at the foot as a
share of the weight, the arch's weight. A new topic, "equilibrium", for the
overview's filter. **No route**: the port's (`simulate/arch.ts`), held to the
engine exactly, the bisection and the golden section included.

**Left out, and said:** sliding, crushing, the abutments' give, and what
happens after the hinges form: the page shows where an arch opens, not how it
falls.

**Checked by** `tests/unit/test_experiments.py`: the chain's rise and ends;
the catenary arch's line within 1 % at four thicknesses; Milankovitch's
0.1075 and the 16 stones' 0.107; the semicircle falling and the pointed arch
standing at 10 cm; the quarter-point loads, 80 % and 141 %.

## The Chladni figures (`experiments.chladni`)

**The exhibit.** A square metal plate fixed at its middle on a shaker, sand on
it, the shaker's tone rising slowly; at certain tones the plate rings and the
sand runs into lines, a different pattern each time.

**The model** (`domain/experiments/chladni.py`). Kirchhoff's thin plate with
free edges, ν = 0.3. Ritz's method on products of normalised Legendre
polynomials up to degree 20 on `[−1, 1]²` (a free edge's conditions are the
energy's own, so any complete basis serves); the 1D integrals by
Gauss–Legendre, exact; the stiffness matrix per symmetry kind — even or odd
across each middle line, and for equal parities kept or changed by the swap
of x and y — and its eigenpairs by cyclic Jacobi rotations (the mass matrix
is the identity in this basis). Rigid motions (κ ≈ 0) are dropped by κ > 1,
the lowest true κ being about 11. λ = 4√κ. Each mode is scaled to 1 at its
largest on a 41-point grid and signed positive at the middle. Shaken at its
middle, only the doubly even, swap-kept modes move there and are driven; the
answer is `|Σ φ_k·φ_k(0)/(μ_k·(ω_k² − Ω² + 2iζω_kΩ))|`, ζ = 0.002, with
`μ_k = ∫φ_k² = Σ c²` the mode's mass (the products are orthonormal). The first
version left `μ_k` out, which made the answer hang on each mode's scale: the
mathematics check (2026-11-17) found the middle's swing at the fourth tone,
711 Hz, at 2.0 % of the lowest tone's; it is 4.7 % (test).

**What it shows.** Leissa's free square plate: 13.468, 19.596, 24.270,
34.801, 61.093, 63.686 to the third place. The driven modes of a 24 cm, 1 mm
steel plate ring at 102, 269, 517, 711, 1186, 1266, 1455, 1973, 2346 and
2529 Hz — 2.62 and 5.05 times the lowest, no harmonics. The lowest tone of all
(13.468, the twist) has a still middle and is not driven. Ten driven modes at
degree 20 agree with degree 24 to 0.1 in λ.

**The route.** `GET /experiments/chladni` (under the budget) sends the driven
modes as Legendre coefficients, the same for every plate: its size and steel
only scale the tones, which the page does. Computed once a process (about two
seconds), cached after. `write-test-fixtures.py` calls it with the chair (its
`FETCHED`), and `test_page_fixtures.py` knows that the plate's build comes
with the defaults while its modes come from the route.

**The page.** The plate from above with 2500 grains on a canvas; the tones as
buttons, the shaker's tone on a logarithmic slider, the sand strewn again; a
sound switch (off by default, `use-tones.ts`, one voice at the shaker's tone,
loud at a resonance); the plate's nearest tone and the middle's swing against
its swing at the lowest tone. **The sand is a drawing rule**, said so on the
page: a grain drifts down the swing's slope and is tossed in proportion to the
swing where it lies; the swing is worked out on an 81-point grid and read
between. The preview is a canvas, so the preview test accepts one.

**Left out, and said:** the shaker's hold (its mass and stiffness shift the
tones), the plate's thickness beside its size, and how sand really jumps.

**Checked by** `tests/unit/test_experiments.py`: Leissa's six values; driven
modes moving the middle and every other kind still there; the three tones and
their ratios; the swing on the ring mode's node under 2 % of the middle's.
`tests/api`: the route's modes lowest first, 24.270 at the bottom.

## The floating top (`experiments.levitation`)

**The exhibit.** A small top with a magnet in its disc, spun on a plate over a
base with a ring magnet in it; lifted slowly with the plate, it leaves it and
floats, spinning, a few centimetres up. Only a top of the right weight does:
the toy is tuned with washers on the spindle, and a warm room undoes it.

**The model** (`domain/experiments/levitation.py`; Berry 1996, Simon,
Heflinger and Ridgway 1997). A still magnet over fixed ones flips or slides
(Earnshaw). The spinning top's magnet stays against the field it sits in and
turns slowly with it (the adiabatic approximation), so its energy is
`U = m·g·z + μ·|B|`: it is pushed towards a weaker field, whose minimum free
space allows. The ring's field on its axis is exact, an outer solenoid minus
an inner one, `B = μ₀M/2·[F_r₂ − F_r₁]`, `F_a = f_a(z + t) − f_a(z)`,
`f_a(u) = u/√(u² + a²)`, with its slope and curvature in closed form; off the
axis Laplace's equation gives `|B| = B + r²·(B′²/B − 2B″)/8` to second order.
The balance is `m·g = −μ·B′`; it holds up and down where `B″ > 0` and sideways
where `B′² > 2·B·B″`, both only in a window found on a millimetre grid to
30 cm and bisected 60 times at each edge; the balance is bisected likewise
above the window's foot, where the lift only falls. It bobs at
`√(μB″/m)/2π` and drifts round at `√(μ(B′²/(4B) − B″/2)/m)/2π`. Ferrite loses
0.2 % of its magnetisation a kelvin, the base's and the top's alike, so a
warming scales the lift by `(1 − 0.002·ΔT)²`.

**What it shows** (an illustrative ferrite ring 10 cm across, a 3 cm hole,
1.5 cm high, M = 320 kA/m; the top's magnet 2 cm³ of it, μ = 0.64 A·m²). The
window runs from 4.36 to 4.81 cm and holds a top of 23.11 to 23.81 g, a margin
of 3 %. Its foot is the lift's peak, so a heavier top lands; a lighter one
balances only above the window, held upright but not sideways, and slides
off. The exhibit's top of 23.5 g floats at 4.6 cm, bobs at 1.5 Hz and drifts
round at 0.6 Hz. Two kelvin warmer move the window 0.8 % towards lighter tops
and never its heights; three and a half kelvin warmer the top lands, four and
a half colder it slides off. Turned with the field instead (a still magnet),
no height holds it.

**The page.** The top over the ring, cut through its axis, with the window's
band and the top where it is: floating, lying on the ring, or slid past the
rim; the top's weight in hundredths of a gram and the room's warming; the
floating height, the lightest and the heaviest top, the bobbing and the
drifting; a chart of the lift against the height with the top's weight, the
window's two edges and the balance. Topic "equilibrium". **No route**: the
port's (`simulate/levitation.ts`), held to the engine exactly, the grid and
the bisections included.

**Joins the experiment of the week** on `SECOND_SERIES`, with the second series.

**Left out, and said:** the spin itself (taken fast enough for the magnet to
follow the field and slow enough for the axis to follow its turns; that speed
window is the paper's, not computed), the air, the top's wobble, and any
particular toy's magnets.

**Checked by** `tests/unit/test_experiments.py`: the axis field against a
dipole's far up and its slope and curvature against differences; the window's
heights and masses, the 3 %, the exhibit's height and frequencies; the foot as
the lift's peak; landing and sliding off; the warmings of 3.5 and 4.5 K and the
0.8 % that leaves the heights; and Earnshaw, no height for a magnet turned with
the field.

## The slow LC circuit (`experiments.circuit`)

**The exhibit.** A physics room's classic, built large: a capacitor, a coil on
a closed iron core, a battery, a changeover switch and a meter with its zero in
the middle. On the battery the switch charges the capacitor; thrown over to
the coil, the capacitor discharges through it and the needle swings one way,
back through zero and back again, about once a second, each swing smaller,
for some ten seconds. Marcel asked for it (2026-11-15, "Ich habe Mal etwas von
Schwingkreis gehört"); no Technorama exhibit was found for it, so its page says
it comes from the classroom.

**The model** (`domain/experiments/circuit.py`). Round the loop
`L·di/dt + R·i = q/C` with `i = −dq/dt`: `L·q̈ + R·q̇ + q/C = 0`, the damped
spring's equation with `L` the mass, `1/C` the stiffness and `R` the friction.
Solved exactly from `q₀ = C·U₀` at rest: with `ω₀ = 1/√(LC)` and `γ = R/2L`,
`q = q₀·e^{−γt}·(cos ω_d t + γ·sin(ω_d t)/ω_d)` and
`i = q₀·ω₀²·e^{−γt}·sin(ω_d t)/ω_d` while `γ < ω₀`; `cosh`/`sinh` (with
`β = √(γ² − ω₀²)`) above the critical `R = 2·√(L/C)`, `1` and `t` exactly at
it. Creeping, the growing exponential is taken out first,
`e^{(β−γ)t}·(1 ± e^{−2βt})/2`, so `βt` of 10¹⁰ does not overflow, and `expm1`
keeps `sinh(βt)/β` exact as `β` shrinks to the edge. The swings counted are the
needle's peaks of at least a tenth of the first, each `e^{−γπ/ω_d}` of the one
before.

**What it shows** (an illustrative build: 200 H with 90 Ω of wire on a closed
iron core, 125 µF of film capacitors, 10 V). A period of 0.99 s; 21 swings
before the needle's peaks fall under a tenth, after some 10 s; at most 7.5 mA,
0.24 s after the switch. A swing there and back keeps 64 % of the energy, and
after 10 s 1 % is left. From 2530 Ω it no longer swings (with 300 Ω 7 swings,
with 1000 Ω 2). Four times the capacitance doubles the period; the battery
changes only the size. Its twin: 200 kg on a spring of 8000 N/m with a
friction of 90 N·s/m.

**The page.** The circuit as a diagram — battery, switch, capacitor with its
charge's signs, the coil and its iron core, the resistance, the meter's
needle — over the spring that obeys the same equation, its block out as far as
the capacitor is charged; a throw of the switch, pause and recharge, real time
or a quarter of it; a bar of where the energy is (capacitor, coil, heat) and
the time, current and voltage. Rebuilding (the coil 20–400 H, the capacitor
20–1000 µF, the resistance 10–4000 Ω, the battery 1–20 V) recharges it and
says whether it swings, with the period, the swings, the strongest current,
the quality and the critical resistance, and the needle's current over three
of its slowest decay times. "The trick" has the energy in the capacitor, in
the coil and both together over time. Topics "oscillation" and "induction",
lesson `second_order`. **No route**: the port's (`simulate/circuit.ts`), held
to the engine exactly in all three regimes and a hair either side of the edge.

**Joins the experiment of the week** on `SECOND_SERIES`, with the second series.

**Left out, and said:** the iron core's losses (its magnetisation lags, eddy
currents) and its saturation (a fixed `L`), the capacitors' leakage; the
meter's resistance is counted in `R`.

**Checked by** `tests/unit/test_experiments.py`: the exhibit's period, swings,
current, critical resistance, quality, decay and energy, and its spring twin;
the closed form against the loop's equations stepped (RK4) swinging, at the
edge exactly and creeping back; the three solutions meeting at the edge; the
energy account to 10⁻⁹ (Simpson's heat) and the 64 % and 1 %; four times the
capacitance, twice the battery; fewer swings with more resistance, no turning
back over the edge and no overflow far out.

## The falling plates (`experiments.plates`)

**The exhibit** (2026-11-15, the first of stage 4, local feedback entries
#20–28; inspired by "Fallende Platten" at the Technorama). A tall column of
magnets in two rows, north and south taking turns, a narrow gap between them;
plates of copper, of aluminium and of aluminium cut with slots dropped into
the gap sink through it slowly, though none of them is magnetic; the slotted
one falls much faster.

**The model** (`domain/experiments/plates.py`). The plate thin and slow, its
currents in its plane, their own field left out; the magnets' field
`B₀·cos(k·z)` along the fall and the same across the plate. In a rectangular
piece `W × h` the currents are then exact, all four edges included: the
charge `φ` solves Laplace's equation with no current through the edges, and
with the field over the piece written as a cosine series
`b₀ + Σ b_m·cos(mπy/h)` the mean `b₀` drives nothing and each other term a
loop known in closed form (`cosh`, `sinh` across the width). The brake is the
heat over the speed: `c = σ·d·[W·(∫B² − h·b₀²) − Σ h·b_m²·tanh(q_m·W/2)/q_m]`,
`q_m = mπ/h` — the endless sheet's part exactly, the edges' as a series whose
terms fall as the fifth power of their number; `_edge_terms` takes forty
times as many as reach the field's own wavenumber and the width's, and 400
more, so the rest changes the brake by under 10⁻⁸ anywhere in the bounds
(2.4·10⁻¹⁰ at worst, measured against 20 000 more). A whole plate is one
piece; slots leave teeth, each a piece (the spine is counted as cut). The fall
uses the brake's mean over the poles, `⟨b_m²⟩ = (2B₀/h)²·(C_m² + S_m²)/2` in
closed form, and `m·v̇ = m·g − c̄·v` then has the exact solution; the fall
time is Newton's from past the root, where the fall's convexity brings it
down without overshooting. The page draws the currents from the stream
function, `J = (∂ψ/∂y, −∂ψ/∂x)`, zero on every edge and in the slots.

**What it shows** (an assumed build: magnets 20 mm high, 0.15 T in the gap,
90 cm of fall, plates 10 × 12 cm and 3 mm, the pure metals). Copper through
in 5.9 s at 15 cm/s, aluminium in 12.3 s at 7.3 cm/s — 0.48 of copper's
speed, as copper conducts 1.6 times as well but is 3.3 times as heavy — the
slotted aluminium in 1.8 s at 53 cm/s, plastic freely in 0.43 s. The whole
plates keep 85 % of an endless sheet's brake, the slotted one 12 %: a seventh,
and it falls 7 times as fast. The thickness cancels exactly; a wider plate
falls a little slower (half as wide, faster, by under a fifth). Brass, a
quarter of copper's conductivity at nearly its weight, falls 3.8 times as fast.
Each plate is at its speed within a few hundredths of a second; the copper
turns not quite half a watt (0.49 W) into heat; the currents' own field stays
under 4 % of the magnets'. The brake ripples by 5 % as a whole plate passes
the poles and not at all for the slotted one, whose twelve teeth sit a
quarter period apart.

**The page.** The column from the front, schematic: four gaps with their
magnets in the chart's red and green, the four plates let go at once, a
stopwatch each, real time or a quarter; beside it one plate up close, riding
along with it, the field passing behind it in bands and its eddy currents in
front, coloured by the way they turn (a canvas, the stream function on a
4-pixel grid from twelve loops). Rebuilding (the field 0.05–0.4 T, a magnet
10–50 mm high, a plate of copper, aluminium, brass or plastic 1–10 mm thick,
whole or cut into teeth 2–60 mm high) moves the column for the race too and
times the reader's own plate, with its terminal speed, its share of the
brake, mass, heat and time constant, and a chart of its time through the
column over the height of a tooth, between the whole plate and no magnets at
all (the time, not the terminal speed: fine teeth would reach theirs only far
below the column's end). Where the currents' own field passes a tenth of the
magnets' — fine teeth, fast — the page says so, as the model leaves it out. "The trick" has the four
plates' times over the field. Topic "induction", lesson `first_order`. **No
route**: the port's (`simulate/plates.ts`), held to the engine to 10⁻⁹ over
three columns and eight plates, the currents' stream function included.

**Joins the experiment of the week** on `SECOND_SERIES`, with the second series.

**Left out, and said:** the field's true shape and its fraying at the column's
ends (its strength is an assumption), the currents' own field, the spine of
the slotted plate, the air (the plastic plate falls freely), the guides'
friction.

**Checked by** `tests/unit/test_experiments.py`: the four plates' times and
speeds, the ratios the page states and the heat; the ripple, and the mean
against a sampled period; the brake against the heat the currents make,
summed over the plate on a grid from the stream function (to 2·10⁻³); teeth
as wide as can be against `1 − sinc²(kh/2)`, the endless strip's closed form,
written in the test; the fall against Newton's law stepped (RK4), and with the
rippling brake at every depth the same fall time to a thousandth; the
thickness, the width, finer slots and brass; the currents never crossing a
slot or an edge, and none in plastic; the refusals.

## The bouncing ball (`experiments.bounce`)

**The exhibit** (2026-11-16, the second of stage 4, local feedback entry #22;
inspired by "Hüpfende Stahlkugel" at the Technorama). A steel ball and a
table-tennis ball over a hard plate; dropped, each clicks on it ever faster
until the clicks run together and stop. The steel ball clicks much longer.

**The model** (`domain/experiments/bounce.py`). A strike keeps the share `e`
of the speed (the restitution, constant). Between strikes the ball flies
straight up and down with its weight and the air's quadratic drag, solved
exactly: up `v = v_T·tan(atan(v₀/v_T) − g·t/v_T)` to
`v_T²/(2g)·ln(1 + v₀²/v_T²)`, down `v = −v_T·tanh(g·t/v_T)`, written with
`log1p`, `expm1` and `ln cosh u = log1p(2·sinh²(u/2))` so that the last tiny
hops do not cancel. Flight after flight until one is shorter than 0.1 ms; the
rest of the series, `2u/(g·(1 − e))` for a ball thrown back at `u`, in closed
form, the air long negligible there. At a strike's own moment the state is the
one leaving it.

**What it shows** (from 30 cm: a steel ball of 20 mm, 33 g, `e = 0.95` on
hardened steel, an assumption; a regulation table-tennis ball, 2.7 g, 40 mm,
`e = 0.92`, which with the air rises from 305 mm to 240 mm, at the lower limit
of the 240–265 mm the rules of table tennis demand of today's balls, dropped
onto a standard steel block: ITTF Technical Leaflet T3, *The Ball* (2018), B.7,
240–260 mm for celluloid. The first version said 230–250 mm and its middle;
the mathematics check, 2026-11-17, found it). The steel ball lands after
0.25 s, rises to 27 cm and lies still after 9.6 s, 75 of its bounces longer
than a hundredth of a second; the table-tennis ball rises to 24 cm and is
still after 5.2 s, with 44. The air carries the table-tennis ball whole at
8.6 m/s and the steel one at 60 m/s: the steel ball's second flight over its
first is its restitution, 0.95; the table-tennis ball's is 0.89, not 0.92.

**The page.** The plate with the two balls at true scale (never smaller than
a dot) and, below, a strip with every strike on a time line, lit as it comes;
let go together, real time or a quarter, a count of strikes each. **Sound**,
off until switched on (`shared/lib/use-clicks.ts`, the tones' rules: no audio
graph while off, the context closed when turned off, nothing stored): a
knock at each strike, as loud as the strike was hard, the steel one at
2800 Hz, the hollow one at 1100 Hz; the quickest strikes, many to a frame,
knock once. Rebuilding: one of the two balls with its restitution 0.5–0.98 and
the height 5–100 cm (the height moves the race too), the time until still,
the bounces over 0.01 s, the first rise and flight, the rhythm and the
terminal speed, and the ball's height over time. "The trick" has the time
until still over the restitution for both, and without air
(`√(2h/g)·(1 + e)/(1 − e)`). Topic "momentum". **No route**: the port's
(`simulate/bounce.ts`), held to the engine to 10⁻⁹ over seven balls and
heights, from a dull one with 10 strikes before the closed-form rest to one with
723.

**Joins the experiment of the week** on `SECOND_SERIES`, with the second series.

**Left out, and said:** the restitution's dependence on the speed; the time on
the plate at each strike (under 0.1 ms), which in reality ends the series with
a buzz before its sum; spin; the plate giving way.

**Checked by** `tests/unit/test_experiments.py`: the two balls' times, counts,
rises, terminal speeds and rhythms, and the rules' 240 mm; every flight
against the weight and the air's drag stepped (RK4), the drop and the first
three; a ball the air cannot touch against the geometric series, its flights
each `e` times the last; the turn at each strike keeping `e` of the speed, the
ball never below the plate, and still after the sum; the refusals.
`shared/lib/use-clicks.test.ts`: silent while off, a knock per click at its
pitch and level, the context closed when turned off, and said where there is
no Web Audio.

## The overhang (`experiments.overhang`)

**The exhibit** (2026-11-16, the third of stage 4, local feedback entry #23;
inspired by "Ausladungen – wer kommt am weitesten raus" at the Technorama).
Nine identical wooden blocks and an edge, no glue: how far out can the top one
reach? Most build even steps and stay short of a block's length.

**The model** (`domain/experiments/overhang.py`). Rigid blocks of one length,
one to a layer; a layer holds while the centre of mass of it and all above lies
over its footing (where it overlaps the block below; the table's top, edge at
zero, for the lowest), its ends included. The furthest stack is built from the
top, the `k`-th block from the top `1/(2k)` over the next: `H_n/2`. Even steps
`1/(n + 1)`, the lowest block that far over the edge too, put the whole
stack's centre on the edge first and reach `n/(n + 1)`; with the lowest block
set back to `1/2 − (n − 1)/(2n)`, even steps of `1/n` reach `(2n − 1)/(2n)`,
nine 0.94 — the page said "in even steps only 0.9" without the first condition
(the mathematics check, 2026-11-17). In lengths; the blocks are 20 × 4 cm only to draw and measure.

**What it shows.** Nine blocks reach 1.41 lengths, 28.3 cm; four already more
than one (1.04); even steps 0.9 with nine, 0.94 with the lowest set back,
never a whole length. One length
takes 4 blocks, two 31, three 227, four 1674. The furthest stack stands at
every edge at once: a block pushed a breath further out tips its own layer and
every one below it, so the whole stack goes over the table's edge.

**The page.** The stack from the front over the table, each block dragged
(pointer) or moved with the arrow keys (a millimetre, a centimetre with
Shift; each block a slider for a screen reader, its overhang in cm), 1 to 20
blocks; each layer's centre of mass a dot on its footing, green where it
holds, red where it tips, and the part from the lowest failing layer up drawn
turned 9° about the end of the footing it passed; the overhang in cm; flush,
even steps and furthest at a press. "The trick" has the blocks one, two,
three and four lengths take, and the furthest and the even reach over the
number of blocks. Topic "equilibrium". **No route**: the port's
(`simulate/overhang.ts`), held to the engine over the furthest and even
stacks of 1 to 20, eight stacks that hold or tip, one a block off its footing,
and nine reaches. The preview pushes the nine out to the furthest and back,
every stack on the way holding (each condition is linear along it).

**Joins the experiment of the week** on `SECOND_SERIES`, with the second series.

**Left out, and said:** stacks with several blocks to a layer, some as
counterweights, which reach further (Paterson and Zwick); friction (the blocks
only tip); the wood giving way; a shaking hand.

**Checked by** `tests/unit/test_experiments.py`: the furthest stacks of 1 to
20 against `H_n/2` in exact fractions, nine at 1.41 (28 cm), three short of a
length and four past it; even steps at `n/(n + 1)` and, the lowest set back,
at `(2n − 1)/(2n)`, holding, and tipping a step wider; the blocks for one to four lengths; the furthest stack at every
edge at once and a nudge tipping its layer and all below; a blind search of
20 000 random stacks of three and of four, none holding past the harmonic; the
refusals.

## The Cartesian diver (`experiments.diver`)

**The exhibit** (2026-11-16, the fourth of stage 4, local feedback entry #24;
inspired by "Kartesischer Taucher" at the Technorama). A small glass tube,
open below, with a bubble of air that just keeps it afloat in a bottle of
water. Squeezed, the bottle sinks it; let go, it rises; in between there is a
depth where it would hover, and it never stays there.

**The model** (`domain/experiments/diver.py`). The bubble by Boyle's law,
`V = V₀·p₀/(p₀ + Δp + ρ·g·z)`, `Δp` the hand's squeeze; buoyancy less weight
`ρ·g·(V_g + V) − m·g`; the hover depth where it vanishes,
`z* = (p₀·V₀/(m/ρ − V_g) − p₀ − Δp)/(ρ·g)`, unstable (the lift falls with
depth). The motion with half its volume of water dragged along and a blunt
tube's quadratic drag (`c_d = 1`), Runge–Kutta at 2 ms with the squeeze as it
is at each step; past the surface it floats there, past the bottom it lies.

**What it shows** (an assumed diver: 3 g of glass, 1.2 cm³, 2 cm³ of air,
12 mm across, in 30 cm of water). It floats on 0.19 g of spare buoyancy and
hovers with a bubble of 1.81 cm³; a squeeze of 10.9 kPa sinks it from the top,
and under 7.9 kPa it rises even from the bottom. Each kilopascal of squeeze
lifts the hover depth 10.2 cm (`1/(ρ·g)`). Half a centimetre off the hover
depth, at 9, 10 or 10.5 kPa, it goes all the way, up or down, within 10 s.

**The page.** The bottle with its water and the diver (drawn larger, its
bubble's share of the tube following Boyle), the hand's push as arrows, the
hover depth dashed while it lies in the bottle; a slider for the squeeze
(0–25 kPa, keys for fine steps), the motion running all the time, paused or
sent back to the surface; whether it floats, rises, hovers (for now), sinks
or lies on the bottom, its depth, speed and bubble. Rebuilding (air
1.85–2.5 cm³, water 10–100 cm) restarts it, with the spare buoyancy, the
bubble it hovers with, the squeezes that sink it from the top and lift it from
the bottom, and the hover depth over the squeeze. "The trick" has buoyancy
less weight over depth for 9, 10 and 11 kPa, each crossing zero falling. The
preview's hand squeezes and eases off around 9.4 kPa. Topic "equilibrium",
lesson `second_order`. **No route**: the port's (`simulate/diver.ts`), held to
the engine over six runs of 1500 steps (both ways off the hover depth, from the
surface unsqueezed and squeezed hard, a deep bottle, a heavy wide diver in a
short one), the bubble, the lift, the hover depths and the figures.

**Joins the experiment of the week** on `SECOND_SERIES`, with the second series.

**Left out, and said:** the water that must run into the tube before the
bubble shrinks; the water's and the bottle's give; the air in the neck,
whose pressure is the hand's squeeze here; the diver poking out at the
surface; temperature.

**Checked by** `tests/unit/test_experiments.py`: the spare buoyancy, the
hover bubble, the two squeezes and the 10.2 cm a kilopascal; Boyle's
`p·V` kept; the lift vanishing at the hover depth, lifting above and pulling
below; all the way up or down from half a centimetre off, floating
unsqueezed and lying on the bottom squeezed hard; the steps against the same
equation written in the test and stepped twenty times finer; the refusals.

## The glass-bead rainbow (`experiments.rainbow`)

**The exhibit** (2026-11-16, the fifth of stage 4, local feedback entry #25;
inspired by "Glasperlen-Regenbogen" at the Technorama). A wall coated with
tiny glass beads, lit by a lamp beside one's head: round the shadow of one's
head a coloured ring, red outside and blue inside, brighter within — a
rainbow half the size of the sky's. The first exhibit about light, and with it
the topic "light".

**Colour, for every light exhibit** (`domain/experiments/colour.py`). A
spectrum at 81 wavelengths (380–780 nm, 5 nm) becomes the eye's `X, Y, Z` by
the CIE 1931 observer, the CIE's own table every 5 nm (360–830 nm, CIE
018:2019), straight between its steps. The multi-lobe fit of Wyman, Sloan and
Shirley (2013) was used first and dropped in the mathematics check
(2026-11-17): it halves `x̄` past 680 nm, so a laser at 690–700 nm and the red
end of the rainbow came out orange; with the table every wavelength from
610 nm on is the screen's pure red (test). Then the screen's linear red, green
and blue by the sRGB matrix, relative to the lamp's own white (each channel
divided by the lamp's: the eye takes its lamp as white), a channel below zero
shown as zero, a colour brighter than white dimmed as a whole, and sRGB's
curve. Lamps are Planck's glowing bodies by their temperature. Mixing an
out-of-gamut colour with grey of its own brightness was tried first and
dropped: it keeps the brightness exactly but makes a spectral red a dull
crimson.

**The model** (`domain/experiments/rainbow.py`). A ray meeting a bead of
index `n` at `b` of its radius off centre goes in at `sin i = b`, on at
`sin r = b/n`, is reflected once at the back and leaves `θ = 4r − 2i` from the
straight way back to the lamp (below zero: across that way, to the other
side). The largest `θ`, at `cos² i = (n² − 1)/3`, is the rainbow angle; it
exists for `1 < n < 2` and closes to nothing at `n = 2`. The index by Cauchy,
`n(λ) = n_D + B·(1/λ² − 1/λ_D²)`, `λ_D` the sodium line. The ring as seen: the
bead's face in 2000 rings of equal area, each ring's light (Fresnel's
reflectance `R` for both polarisations, `(1 − R)²·R` each, averaged; inside,
the ray meets the surface at `r`, where it reflects what it does at `i`
outside) spread evenly over the angles between its edges' rays, in bins of
0.1°; blurred by a lamp of 0.25° radius (the sun's), light blurred below zero
folded back; over each bin's solid angle; and per bin the colour of the lamp's
light (3000 K) by every wavelength's profile, exposed so that the ring's
brightest bin is the screen's brightest.

**What it shows** (soda-lime glass, `n_D = 1.52`, `B = 4200 nm²`; water
1.333 and 3140 nm²). The glass ring at 21.1°, from violet at 19.9° to red at
21.4°, 1.5° wide; water's at 42.1°, 1.9° wide: the glass ring is half the
sky's (the ratio 0.50). The rainbow ray meets a glass bead 75 % out; of the
light meeting the bead 5.5 % leaves after one reflection, and 24 % of that
within a degree of the rainbow angle. The angle falls with the index: 42.5° at
1.33, under 0.1° at 1.99; at `n = 2` a ray near the centre comes straight
back, off only by a term in `b³`.

**The page.** One bead, much enlarged, in a dark room (both themes alike):
the lamp's light from the left, a fan of 19 rays through it bunching where
they leave, the rainbow ray dashed, the chosen ray bright or split into seven
colours, and the angle it leaves at from the way back. Beside it the wall as
one sees it, a canvas coloured from the ring's bins round the shadow of one's
head and shoulders, at a fixed 50° to its edge so that the ring visibly
shrinks and grows, its radius written on it. A slider for where the ray meets
the bead (0–99 % of the radius), a button to the rainbow ray, whether the ray
comes back inside the ring, at it, or across the way back; the angles in, on,
out and the rainbow angle. Changing the material (water drop or glass bead,
which set the index and the dispersion; the index 1.30–1.95, keeping the
dispersion) gives the ring's radius, its two edges and width, where the
rainbow ray meets the bead, the light back after one reflection and the share
near the rainbow angle, and the angle out over where the ray meets the bead for
violet and red. The ring is recoloured from 81 wavelengths (about 50 ms) on a
deferred value, so the slider never waits for it. "The trick" has the rainbow
angle over the index from 1.30 to 1.99. The preview sweeps a ray across a
glass bead's face. Topic "light", no lesson (geometry, not a motion). **No
route**: the ports' (`simulate/colour.ts`, `simulate/rainbow.ts`), held to the
engine over the observer, five lamps through three filters, the screen's
mapping, and four beads (glass, water, a dense one at 1.9, one without
dispersion at 1.3): angles, shares, traced paths, profiles, the ring's colours
and the figures.

**Joins the experiment of the week** on `SECOND_SERIES`, with the second series.

**Left out, and said:** the beads' size (in very small beads the waves widen
the ring and add faint rings inside it); light reflected twice or more inside
or not at all; the wall behind the beads; the screen's own deviations from
sRGB, so the colours are close, not exact.

**Checked by** `tests/unit/test_experiments.py`: the observer's peak at 555 nm
and its sum against the CIE's table; equal energy, illuminant A and the
Planckian locus at 6500 K within 0.002; the lamp's own light white and a
spectral red shown red; a negative channel to zero and a bright colour dimmed
whole; the glass and water rings, their edges, widths and the half; the ring
shrinking to nothing at 2; the rainbow angle against a search over the face;
the traced ray against Snell's law and `4r − 2i`; Fresnel's 4 % straight on;
the profile's light against Simpson's rule over the face, dark past the red
edge, brightest at the rainbow angle; the ring red outside, blue inside and
whitish within; the refusals.

## Why the sky is blue (`experiments.sky`)

**The exhibit** (2026-11-16, the sixth of stage 4, local feedback entry #26;
inspired by "Warum ist der Himmel blau" at the Technorama). A long tube of
water made faintly cloudy with particles far smaller than the wavelength, a
white lamp shining in at one end: from the side the tube is bluish by the
lamp and white, yellow and orange further along; seen through the far end the
lamp is orange. The blue sky and the red setting sun for the same reason.

**The model** (`domain/experiments/sky.py`, colours by `colour.py`). Rayleigh
scattering `β(λ) = β₅₅₀·(550 nm/λ)⁴`, the cloudiness given as `β₅₅₀` per
metre; the light going on `S(λ)·e^{−β(λ)·x}` (Beer–Lambert); the side light at
`x` what is scattered there, `(550/λ)⁴·e^{−β(λ)·(x + a)}` relative to `β₅₅₀`,
`a` the tube's half-width it still crosses to the wall; the end light
`e^{−β(λ)·L}`. The lamp a 3000 K glow, each colour relative to its white. The
sky: the air's optical depth straight up 0.097 at 550 nm, scaled as `1/λ⁴`;
the sun at height `h` through Kasten and Young's air mass `m` (37.9 at the
horizon), its light `S·e^{−m·τ}`; the sky straight overhead as sunlight
scattered once at every height on its way down, `(e^{−τ} − e^{−m·τ})/(m − 1)`
for an air whose density falls alike for every wavelength, written with
`expm1` so that it holds at `m = 1` (`τ·e^{−τ}`), and turned into the eye
through `Θ = 90° − h`, which Rayleigh's `1 + cos²Θ` weighs: `(1 + sin²h)/2`
of the sky with the sun overhead, half with it on the horizon. The first
version left it out and drew the evening sky up to twice as bright against
noon's (the mathematics check, 2026-11-17); the colours do not change. The sun a 5778 K glow above
the air, taken as white. **Ozone** (added the same day, Marcel's "Ja" after a
side agent found the sky overhead at sunset nearly white without it): the
layer absorbs rather than scatters, most in the orange (the Chappuis band,
strongest at 600 nm), `T₃ = e^{−m₃·σ(λ)·N}`. `σ` is measured, Serdyuchenko et
al. (Atmos. Meas. Tech. 7, 2014) at 223 K, the layer's cold, from the MPI-Mainz
UV/VIS Spectral Atlas, averaged over each 5 nm around the engine's 81
wavelengths (`OZONE_CROSS_SECTION_E21_CM2`); `N` 300 Dobson units. The layer is
a thin shell 22 km up, `m₃ = 1/√(1 − (R/(R + H))²·cos² h)`; it lies above
nearly all the air, so the sun's light and the sky's, which is that light
scattered further down, both carry `T₃`. A switch on the page takes it out.

**What it shows** (an assumed tube: 1 m long, 6 cm across, `β₅₅₀` 1.5 per
metre). Blue (450 nm) scatters 4.4 times as strongly as red (650 nm); half the
blue is gone after 21 cm, past 54 cm the side light holds more red than blue;
the end lets through 28 % as bright as the lamp, 3.5 % of its blue and 46 % of
its red. The side light fades along the tube; cloudier, the end goes redder
while the side by the lamp stays blue. The sun at the horizon keeps 3 % of its
light (4 % without the ozone), orange; overhead it is near white. The sky
overhead at noon is sky blue, more green in it than red (the sun's spectrum and
the eye's, not violet). Ozone's optical depth straight up is 0.041 at 600 nm;
the sun's light crosses 12 times as much of it at the horizon, where it takes
39 % of the orange: with it the sky overhead at sunset stays blue, without it
it is almost white.

**The page.** The tube in a dark room: the lamp, the side as a gradient from
65 places, each place's colour as bright as the screen allows (the caption
says the tube darkens in reality), the window at the end in the colour that
comes through, and marks where half the blue is gone and where red wins while
they lie in the tube. A slider for the cloudiness (0.1–4 per metre), the
figures beside it. Lengthening the tube (0.2–3 m) with the side light along
it for blue, green and red, crossing where it turns yellowish. "In the sky":
the sun's height (0–90°) with the sky overhead in its colour, as bright as
against the sky with the sun overhead, and the sun's disc in its own; the air
mass and how much of the sun's light, its blue and its red reach the ground,
and a switch for the ozone layer with how much of the orange it takes.
"The trick" has the sun's blue and red at the ground over its height. The
preview's tube clouds over and clears again. Topic "light", lesson
`first_order` (Beer–Lambert is the first-order decay). **No route**: the port's
(`simulate/sky.ts`), held to the engine over three tubes (the exhibit's, a long
cloudy one, a short clear wide one) at four places each, eight heights of the
sun (one where the air mass is within a hair of 1) with the ozone and without,
and the light scattered down at exactly one air and near it.

**Joins the experiment of the week** on `SECOND_SERIES`, with the second series.

**Left out, and said:** light scattered more than once (it whitens a very
cloudy tube and the horizon); larger particles that scatter every colour
alike (milk); the direction of scattering, which changes only the brightness;
for the sky, dust and haze (which redden the sunset further), the sun below the
horizon (the sky overhead then lit only high up, through more ozone still),
and how much ozone there is, which changes with the season and the place.

**Checked by** `tests/unit/test_experiments.py`: the 4.4, the 21 cm and the
54 cm, the light at the end; the side light along the tube and the end light
adding up to all the lamp's, by Simpson's rule, at every tenth wavelength; the
tube blue by the lamp and orange at the end, redder when cloudier, fading
along; the air mass at the horizon, overhead and against `1/sin h` high up;
the sun near white overhead and orange at the horizon with 3 % left, 4 %
without the ozone; the sky overhead against its integral over the heights, at
one air exactly too; sky blue at noon and almost white at sunset without the
ozone; the ozone band strongest at 600 nm, its 0.041 straight up, its shell
once overhead, against `1/sin h` high up and 12 times at the horizon, its 39 %
of the orange there, the sun's and the sky's light both carrying it, and the
sunset sky blue with it; the refusals.

## The double slit (`experiments.slits`)

**The exhibit** (2026-11-16, the seventh of stage 4, local feedback entry #27;
inspired by "Doppelspalt-Experiment" at the Technorama). A laser on a plate
with two narrow slits and a wall behind: a row of bright and dark stripes, not
two bright lines. Cover one slit and the stripes go, a broad patch is left —
bright where the two made it dark.

**The model** (`domain/experiments/slits.py`, colours by `colour.py`).
Fraunhofer, the wall far away: each slit of width `a` sends `sinc(β)`,
`β = π·a·sin θ/λ`, the pair `2·sinc(β)·cos(α)`, `α = π·d·sin θ/λ`; the
intensity the square, relative to the middle of the pair's pattern,
`sinc²(β)·cos²(α)`, and one slit covered `sinc²(β)/4`; a point `y` on the wall
at `L` at `sin θ = y/√(y² + L²)`. Bright stripes at `sin θ = k·λ/d`, dark at
`(k + ½)·λ/d`. The laser's colour is its wavelength's (`colour.matching`), its
brightest channel full, scaled by the intensity; white light is a 3000 K
lamp's spectrum with every wavelength its own pattern, by `colour.seen`, so
the middle is the lamp's white.

**What it shows** (a red laser, 650 nm, slits 0.25 mm apart and 0.05 mm wide,
the wall 2 m behind). Stripes 5.2 mm apart, the first dark 2.6 mm beside the
middle; one slit's middle band 26 mm to its first dark, nine bright stripes
within it, the fifth lying on that dark and missing; at the pair's first dark
stripe one slit alone gives 97 % of its own middle; one slit lights the middle
a quarter as brightly as two. With white light the middle is white and the
red's first dark blue. Fraunhofer holds to a per cent of the middle once the
wall is more than 35 times `a²/λ` away, 13 cm here (0.8 %; at 30 times 1.1 %): summed
strip by strip on each strip's own path, the near field included, the formula
is off by about `10·(a²/λL)²`. The slit's width sets it, not the spacing (the
spacing's own term is the same for both slits and drops out), so the sliders'
corner of 1 mm and 0.5 m is off by only 0.3 %, while 0.2 mm slits at 400 nm
need 3.5 m. Nearer than that the page says so; it had named `d²/λ` and said
nothing (the mathematics check, 2026-11-17).

**The page.** The setup, small, in a dark room (the beam in the laser's
colour, the second slit shown covered when it is), and under it the wall as
one sees it: a canvas strip, a column per place, across one slit's middle
band and a half again at the reddest light (`1.5·λ·L/a` at 700 nm, so a
colour change shows the stripes widen while the frame stays), its scale in
millimetres. Laser or white light, the laser's wavelength 400–700 nm, a
switch to cover one slit; whether stripes show and how far apart, the figures
beside. Changing the slits (spacing 0.1–1 mm, width 0.02–0.2 mm, each slider
stopping short of the other, the wall 0.5–5 m) with the brightness along the
wall for two slits and one. "The trick" has one slit open and two side by
side at the same brightness. The preview's laser runs through the colours.
Topic "light", no lesson (a pattern, not a motion). **No route**: the port's
(`simulate/slits.ts`), held to the engine over four pairs of slits (the
exhibit's, a wide pair near the wall, a far one, one barely wider apart than a
slit) and three lasers: intensities, stripes, colours, both patterns and the
figures.

**Joins the experiment of the week** on `SECOND_SERIES`, with the second series.

**Left out, and said:** the wall's nearness; the laser beam's width and
spread, which make the stripes fade up and down; the slits' edges and
thickness; polarisation.

**Checked by** `tests/unit/test_experiments.py`: the 5.2 and 2.6 mm, the 26 mm
band and its nine stripes, the 97 %, the quarter in the middle and the tenth
of a metre; the pattern against Huygens' waves summed strip by strip (400 to
a slit) for two slits and one; dark stripes dark where one slit lights the
wall with at least 40 % of its middle, bright stripes four times one slit; the
missing stripe; the laser's colour, white light's white middle and blue at
red's dark; the refusals.

## Beats (`experiments.beats`)

**The exhibit** (2026-11-16, the eighth and last of stage 4, local feedback
entry #28; inspired by "Schwebung" at the Technorama). Two tuning forks on
their sounding boxes, alike but for a small rider clamped to one fork's
prongs: struck together they sound as one tone that slowly swells and fades;
slide the rider and the swelling quickens or slows.

**The model** (`domain/experiments/beats.py`). Each fork rings down as
`e^{−t/τ}`, both struck alike, so the sum is `½·e^{−t/τ}·(sin 2πf₁t +
sin 2πf₂t) = e^{−t/τ}·cos(π·(f₁ − f₂)·t)·sin(π·(f₁ + f₂)·t)`, its loudness
`e^{−t/τ}·|cos(π·(f₁ − f₂)·t)|`, peaking `|f₁ − f₂|` times a second. The prong
a clamped beam in its first mode, `1 + cos βL·cosh βL = 0`, `βL = 1.8751`, its
shape `φ` scaled to 1 at the tip, where the prong weighs a quarter of its mass
(`∫φ² = ¼`); a rider `m` on each prong at `s` along it slows the fork by
Rayleigh's estimate with the mode kept, `f₂ = f₁/√(1 + m·φ(s)²/(m_prong/4))`.

**What it shows** (an assumed fork: 440 Hz, prongs of 20 g, ringing down in
6 s; a 1 g rider 30 % up the prongs). The second fork at 439.18 Hz: 0.82
beats a second, one every 1.22 s, 3.2 cents apart, 23 beats while the sound
falls to a hundredth; the same gram at the tip, 38 Hz down. Rayleigh comes
out 0.04 % above the exact frequency of a beam with a mass at its end for 1 g
at the tip, under 0.4 % for 5 g.

**The page.** The two forks (their prongs blurred as wide as they swing, the
rider drawn on the second), their pitches, and under them the sum around now
over 12 ms, a slow motion of a few swings; under that the loudness over ten
seconds since the strike, both together and one alone dashed, now marked. A
button to strike, a switch for the sound (off at first; `useTones` plays the
two forks and the ear makes the beats), whether they wait, ring or have died
away, the two pitches, the beats and the time between them. Moving the rider
(0–2 g, from the stem to the tip) gives the second fork, the beats, the time
between them, the cents and the beats heard, and the loudness over ten
seconds. "The trick" has the beats over the rider's place for 0.5, 1 and 2 g.
The preview strikes again every nine seconds, silent. Topics "oscillation" and
"perception", lesson `second_order` (each fork a damped oscillator). **No
route**: the port's (`simulate/beats.ts`), held to the engine over the mode's
shape, three forks (the exhibit's, a low heavy one ringing long, a high light
one ringing short) with five riders each, and the loudness and the sound over
five seconds.

**Joins the experiment of the week** on `SECOND_SERIES`, with the second series.

**Left out, and said:** the sounding boxes and the room; the rider's own pull
on the mode's shape; the prongs' coupling and the stem; the ear, which hears
fast beats as roughness and then as two tones.

**Checked by** `tests/unit/test_experiments.py`: the 439.18 Hz, 0.82 Hz,
1.22 s, 3.2 cents and 23 beats, and the 38 Hz at the tip; the mode's root and
its quarter by Simpson's rule; Rayleigh against the exact beam with a mass at
its end, solved by bisection in the test; the sum against the mean tone times
the beating envelope, and ten silences in four seconds at 2.5 beats; a rider
at the stem or of no mass in tune, the pitch falling along the prong; the
refusals.

## The link previews

A link to the site or to an exhibit, shared in WhatsApp, Signal, Mastodon or
the like, shows a picture with it (Marcel, 2026-11-16: one per exhibit). Those
readers take the title, the text and the picture from the HTML as it is sent
and run no script, so each exhibit's route has its own copy of the page:

* **The pictures**, `frontend/public/previews/<exhibit>.jpg` and
  `overview.jpg`, 1200 × 630 (Open Graph's large card), JPEG under 300 kB so
  WhatsApp shows them large. Each is a card (`preview-card.tsx`) with the
  exhibit's own preview, the overview's still, beside its title, its question,
  its summary and its address; the overview's card has the site's line beside
  four previews. Since 2026-11-20 (Marcel: "eine feste Grösse für die
  Vorschaubilder … annähernd gleich viel Text pro Exponat … Besser aufgeteilt
  ist besser") the picture is one box of 600 × 534 on every card, the drawing
  fitted into it with its own frames and grounds taken off: before, each
  drawing brought a frame of its own size, a wide track a small strip in an
  empty frame. And the summary joined the question: in German 177 to 325
  characters of text a card (median 245), the column 60 to 88 % full where it
  had been half empty. The still is the page's preview mode, played for a moment and held,
  so the picture cannot drift from the exhibit; a tall one is scaled down to
  fit. `scripts/write-previews.mjs` photographs the cards in a headless
  Chromium (Playwright) from a dev server of its own, and the pictures are
  committed: a deploy never needs a browser. Run it after a new exhibit or a
  changed drawing; `link-pages.test.ts` fails while an exhibit has no picture,
  or one of the wrong size or weight.
* **The pages**, written by the build (`frontend/link-pages.ts`, the plugin in
  `vite.config.ts`): the built `index.html` once per exhibit, `dist/sky.html`
  and so on, with the exhibit's title, summary, address and picture in place
  of the overview's tags and nothing else changed. Caddy serves `/sky` from
  `sky.html` and falls back to `index.html` for every other route
  (`deploy/Caddyfile`).

German only: a link preview's request names no language, and de-CH is the
site's fallback. The pictures cost nothing to serve to speak of: a few
megabytes in the web image, fetched when a link is shared.

**No moving picture in a link's preview.** Marcel asked (2026-11-20) whether
a link shared on LinkedIn could show the exhibit moving. It cannot, as far as
anything published says: LinkedIn shows `og:image` as a still, does not read
`og:video` for a site's own pages, and an animated GIF there stays on its
first frame. A video uploaded into the post plays, with the link in its text.
For that, `scripts/write-clips.mjs` writes `clips/<card>.mp4`: the same card,
moving, ten seconds at 1920 × 1008, MP4 (H.264), the format every guide to
LinkedIn's uploads agrees on. The page runs under Playwright's clock, paused,
one frame's time per photograph, so the clip never stutters; Chromium's
MediaRecorder encodes, so it needs no ffmpeg. The clips are not committed
(`clips/` is ignored): nothing on the site uses them. The first clips ran
about four times too fast (Marcel noticed on his phone): an installed clock
keeps running in real time unless paused, and each screenshot's own time went
into the clip. The script now pauses it and checks that the page's time over
the frames equals the clip's length. A clip keeps its preview's pace, which
for a few exhibits is faster than the exhibit's own: the pendulum wave twice,
the coupled pendulums three times, the waterwheel and the well four times, the
parabola and the harmonograph ten times, Foucault's pendulum 3600 times.

## The check, exhibit by exhibit

From 2026-11-15 the overview and every exhibit's page carried a warning
banner under their heading: the calculations still await their check. Since
2026-11-19 each exhibit says it in one line under its title, "not yet
checked" or the day an admin checked it (`CheckStatus`,
`unchecked-notice.tsx`), and the front page says how many are checked, below
its first screen. The two reviews of that day (Marcel's Claude docs of the
front page and of the coil's page) found that a warning in second place costs
more trust than it earns, and asked for it where the calculation is.

**The cases** (`backend/staunlabor/domain/checks/`, Marcel: "Für die
anstehende Überprüfung und Nachvollziehen sind Edge Cases besonders
geeignet"). Each is a limiting case a reader can work out by hand: what is
set, the formula, its value by hand, the value the page computes (the time
loop at the page's step, or the function the page calls), and the deviation
allowed and why. Every case names its sources, where in them and the words
verbatim, untranslated (Marcel, on a side agent's point that cases written by
the agent who wrote the engine can share its mistakes: "Bitte
Quellenangaben implementieren"); its expected value is computed from that
formula in the case's module, not by the engine's closed forms. Where no
source states the formula exactly as used, the case is marked "derived" and
its words give the one step, so a reader checks the step rather than trust a
citation. The first three exhibits have them: the sphere (eight), the coil
(seven), the chair (four); Newton's cradle followed on 2026-11-20 (five), the
first of the rest (Marcel: "Prüffälle für alle Exponate ergänzen"), drafted by
subagents with every quote fetched and found verbatim and run against the
engine before they went in. `tests/unit/test_checks.py` holds every case to its
tolerance; their runs take seconds, so the pages read them from
`checks.json` (`scripts/write-checks.py`, held current by
`tests/unit/test_checks_file.py`).

**Where the sources are thin**, and the cases say so: the hollow ball's
frequency only through the general formula and the hollow sphere's moment of
inertia; the ball's centre as a spherical pendulum under g/(1 + k) only
through Routh's conserved spin, the reduction itself a step of ours; where
the ball leaves the wall only through an educational site's string tension;
Wheeler's formula as printed lies 0.28 % under the SI form the engine uses,
within his own 1 %; the second eye's small-angle disparity overshoots the
exact angle by 1.7 %.

**The cradle's** five are all derived: no source states the first impact of
a row as the page reads it, so each case puts two together (the pendulum's
fall and the exchange of equal balls, Hertz's force and Patrício's deepest
dent and contact time, arXiv:physics/0402036, whose equations are transcribed
from the PDF's layout). Its energy case allows 4 · 10⁻⁵ over 2 s: the
microsecond step loses up to 7 · 10⁻⁶ of the energy at each impact, where
Hertz's force has no second derivative as a contact closes. Writing them found
that Flores et al.'s damping parts a lone pair with about e, not e (0.947 for
0.95, 0.47 for 0.50), so the restitution's hint says "about" (Marcel chose the
word over an engine change).

**The waterwheel's** five (2026-11-20) hold Lorenz's equations with b = 1 to
Knill's eigenvalue at the origin, the steady turn √(b(ρ − 1)), the threshold
of chaos σ(σ + b + 3)/(σ − b − 1) on the page's tile, the shrinking volume of
states e^(−(σ + 1 + b)Kt), and Illing et al.'s own wheel equations in seconds
(arXiv:1202.5508, which gives b = 1), integrated in the case. A test holds the
case's sentence that any radius and brake with the same σ and ρ give the same
rate. Its `volume` case is about a box of states, not the one wheel: "Set it
up" sets the tap and the brake, and the box is the case's own.

**The pendulum wave's** five (2026-11-20) hold the textbook lengths and the
lengths tuned for 15° (the complete elliptic integral K, from the DLMF), the
row together again after one cycle, the exact swing at a third of the cycle
(Jacobi's sn, found in the case from its integral, in the engine by the
arithmetic-geometric mean), and how far a textbook row comes back skewed.
"Set it up" sets the row and, for the two read at a moment, stops the clock
there.

**The carousel's** four (2026-11-20) hold a throw at rest to its aim, the
straight throw's miss on a turning platform, the Coriolis push 2Ωv at the
throw, and the rolled ball's turn at 2/7 of the platform's rate. "Set it up"
sets the platform's turn, the throw, what is thrown and the view, and throws.

**The sky's** five (2026-11-20) hold the tube to Rayleigh's λ⁻⁴ (blue against
red), the light kept between the side and the end, the air mass of a high sun,
the noon sky without ozone and the ozone's share at the horizon. "Set it up"
sets the tube on the page and the sun on the sun's card, each taking only its
own cases.

**The Chladni plate's** four (2026-11-20) hold its two lowest tones to Leissa's
table (NASA SP-160, Table 4.65, after Iguchi), the sharpness of the lowest, and
the fourth's swing. The engine finds a driven mode at λ = 281.11 (the 1186 Hz
button) that the table leaves out between its 168.49 and 299.93; it stays at
Ritz degrees 16, 20 and 24, and Ritz values are upper bounds, so the table
skipped it, and the cases rest on the two lowest. "Set it up" sets the shaker
to the case's tone, to the hundredth of a hertz.

**The peg's** four (2026-11-20) hold the bob to the same height on both
sides (Galileo, quoted for that alone: in the same passage he puts the loop at
h > 2r, where it needs 2.5r), the caught swing's period, the loop at its very
edge and the slack string just below it. The engine spots a slack string by
its pull changing sign between the ends of a step, so right at the edge it can
miss a dip below zero shorter than a step: a band of about 7 · 10⁻⁷ m in the
peg's depth, which the loop case's tolerance of 2 · 10⁻⁶ covers.

**Foucault's** four (2026-11-20) hold the plane's turn to sin φ times the
Earth's rate against the stars, at Winterthur, at the pole and in the south,
and the full turn's day. The engine's Earth rate lies 2 · 10⁻⁸ off the
stellar day, in its eighth digit. Its drawing is scaled to the swing, so it
has no gesture: pulled out further, everything would grow with it.

**The falling plates'** five (2026-11-20) hold a plastic plate's free fall, a
late start's fall with the engine's own mass and brake (as the coil's rise
uses its L and R), the brake's growth with thickness, copper against aluminium
by their conductivities, and fine teeth against the endless strip. That last
one is the loosest: the engine lies 1.26 % under 1 − sinc²(kh/2), within
1.5 %, the teeth's ends at the plate's edges taking about 0.63·h/W of the
brake; a plate up to 50 cm wide would bring it to 0.25 %. Aluminium's
conductivity is 3.77 · 10⁷ S/m, the value of Wikipedia's resistivity-density
table (26.50 nΩ·m), not of its main table (28.2 nΩ·m).

**The Maxwell wheel's** five (2026-11-20) hold its fall time and the bands'
pull to the rolling fall under g/(1 + I/mr²), the climb back up, the jerk's
duration and its peak at the bottom; "Set it up" builds the wheel and lets it
go. **The arch's** three hold the thinnest semicircle that stands (40 stones
at 0.10743 of the radius against Milankovitch's 0.1075; the case's source
cites his dissertation of 1904, the line above his paper of 1907), the hanging chain's line inside a thin catenary arch, and the
weight; the thinnest arch's 10.75 cm lies between the thickness slider's whole
centimetres, so "Set it up" sets it exactly.

**The resonance rods'** five (2026-11-20) hold a rod's tone to the clamped
beam's first mode lowered towards Greenhill's buckling load (that lowering
along a straight line is a step of ours, marked derived, and kept to the
50 cm rod, where it differs by 5 · 10⁻⁵), the buckling length itself (which
the page has no input for, so the case has no "Set it up"), the swing in step
at a rod's beat, its neighbour's, and the growth from rest. The docs' simple
rule for the growth, 1 − 1/e after 1/(2πζ) cycles, is 0.5 % off the exact
solution the engine follows to 10⁻⁷. **The well's** four hold the circle's lap
to Kepler's third law under g·5/7, equal areas in equal times, the energy, and
the felt's brake. A case without a setting shows no "Set it up" button
(`check-section.tsx`).

**The double slit's** five (2026-11-21) hold the stripes' spacing to λD/d,
one slit's first dark beside the middle to a sin θ = λ, the middle of one slit
at a quarter of two (amplitudes add, not brightnesses), the first bright stripe
at the envelope's sinc²(πa/d) and the fifth order missing where it falls on the
envelope's zero (d = 5a). The page measures the wall with sin θ = y/√(y² + D²),
not the textbook's small angle, so the spacing between the first and second
dark lies 1.1 · 10⁻⁵ over λD/d, inside the case's 3 · 10⁻⁵. "Set it up" sets
the light, the covered slit, the wavelength and the build in one go, on the
light's card.

**The Cartesian diver's** four (2026-11-21) hold its reserve of lift (the
water it displaces, glass and air, less the glass's 3 g: 0.1936 g), the squeeze
that sinks it from the surface (Boyle and Archimedes: 10.884 kPa, so the docs'
10.9 sinks it and 10.85 does not), the squeeze under which it rises even from
the bottom (ρgH less: 7.947 kPa) and how fast it leaves its hover depth. That
last one lets the diver go at rest a micrometre under the hover depth and
reads the growth of cosh(√k·t) over five seconds, with the added mass of half
the glass's water; started further off, the drag bends the curve. The thresholds
are found by bisection on one step of the engine's own loop. "Set it up" sets
the hand and where the diver starts: at the surface, on the bottom, or that
micrometre under the hover depth, which no hand on the slider could find.

**The double cone's** three (2026-11-21) hold the axis's path, the slope
where the cone stops rolling up (7.54628°, found by halving the rails' rise on
the sign of the engine's own fall, not by its closed form) and the speed after
a second's roll, against Gandhi and Efthimiou (Eur. J. Phys. 26 (2005) 681),
who reach the contact by another route: the cone's surface square to the rail.
Their angles lie in the rails' plane; the cases convert them (θ = γ, ψ = α,
tan φ = tan β·cos γ). **The paper has a slip**: after its Eq. (9) it prints the
path's intercept as b = L tan ψ(cos α − tan α sin α), while its own Eqs. (7),
(8) and Z = a cos α give b = L tan ψ/cos α, a plus where the minus stands. With
the printed b the axis lies 2.1 mm lower everywhere and the speed case fails by
5 · 10⁻⁴; with (7) and (8) it agrees to 10⁻¹⁴. The cases quote (7), (8) and
Z = a cos α, not the printed b, so nobody should "fix" the engine to it. "Set
it up" sets the build's six sliders and lets the cone go.

**The beats'** three (2026-11-21) hold the silences to |f₂ − f₁| (read off the
very sum the page draws and plays, at the crests of the mean tone), a gram at
the prong's tip to 440/√1.2 = 401.663 Hz (the prong felt there as a quarter of
its mass, from its clamped mode) and the gram a third up to 439.183 Hz, the
page's 0.82 beats a second. No case holds the docs' "Rayleigh 0.04 % above the
exact beam with a mass at its tip": the one fetchable source for that equation
(Labuda et al., arXiv:1604.00601, App. B) prints the bare beam's equation with a
sign the clamped-free beam does not have, so the comparison stays in
`tests/unit/test_experiments.py`. "Set it up" sets the rider and strikes the
forks; the sound stays as the reader left it.

**The water parabola's** five (2026-11-21) hold the middle's depth at 90 rpm
(the paraboloid's ω²/(2g) and the volume kept), the rate where the middle runs
dry (126 rpm), the rim past it (through the dry patch's radius, another route
than the engine's R·ω·√(h/g)), the focus of a slow dish at 7 rpm and the
spin-up, run in the engine's own loop at the page's 10 ms step, to
1 − e^(−t/τ) with τ = h/√(νΩ). That last one checks the model as the docs state
it: Greenspan and Howard's small-change result applied to a start from rest.
"Set it up" sets the vessel and the turntable; for the spin-up it also stops
the water, with the table already at speed, which the page's own controls
cannot do (they keep the water turning with the table).

**The floating top's** five (2026-11-21) hold the lift at 4.6 cm, the window's
foot (where B″ turns positive) and head (where B′² = 2BB″, Berry and Geim's
horizontal condition), the bob's and the drift's frequencies at the balance.
The hand side builds the ring's field another way than the engine: loop by loop
from its bound surface currents (K = M × n̂) with OpenStax's loop formula, summed
by Simpson's rule, with its own bisections for the edges and the balance; the
two agree to 5 · 10⁻¹³. Berry and Geim's paper (Eur. J. Phys. 18 (1997) 307) is
cited from a copy on a University of Bielefeld course page, not the publisher's
site, so that link may not last. The ring is illustrative: the cases check the
computation, not a real top's numbers. "Set it up" sets the top's mass and the
warming.

**The slow LC circuit's** four (2026-11-21) hold the period to 2π/ω′ with the
damping's share (without it 0.9935 s, not 0.9941), the energy kept over one
period (e^(−RT/L), the docs' 64 %), the account after ten seconds (what is
stored plus the wire's heat R∫i²dt, summed by the case on the page's current,
is the start's 6.25 mJ: the heat bar the page draws as the rest is the Joule
heat) and the strongest current at the edge, R = 2√(L/C) = 2529.822 Ω, against
q₀ω₀/e. In floating point γ lands one ulp above ω₀ there, so the engine takes
its creeping branch (β ≈ 10⁻⁷/s, kept exact by expm1) and the page says
"creeps", not "critical", at the exact edge; the engine's critical branch is
all but unreachable. The resistance slider steps by 10 Ω, so a reader gets
2530 Ω (peak 4.7 · 10⁻⁵ lower); "Set it up" sets the exact value. It sets the
build, which recharges the capacitor, and throws the switch.

**The race's** four (2026-11-21) hold the straight line's time (0.982374 s),
the brachistochrone's through the finish (0.747261 s, its end angle found by
the case's own halving of (φ − sin φ)/(1 − cos φ) = D/H), and in the valley the
cycloid's time from 59 cm to the bottom (0.650151 s, the time table the
animation runs, not the closed form π√(r/g′)) and the circular bowl's from the
same height (0.696484 s, through the pendulum's K). The last two sum smooth
integrands by the trapezoid rule over 1440 intervals: 7 · 10⁻⁸ off at that
count, a quarter of it at twice the count, so the error is the sum's, within
the engine's own claim of a part in 10⁷. The engine imports the pit and the
sphere's inertias, so a change to `pit.py` or `sphere.py` unchecks the race
too. "Set it up" sets the build, which the valley shares; the race waits for
its start, as at the exhibit.

**The chaotic pendulum's** three (2026-11-21) check that the loop the page runs
is the double pendulum's; chaos itself (the Lyapunov exponent, the gap) has no
hand formula, so no case touches it. They hold the slow mode's period at small
swings (let go at 1° and √2°, the mode's shape; 2.5 · 10⁻⁵ off from the
amplitude's own effect), the energy over twenty wild seconds at 120°/120°
(from the weights' positions and speeds, not the engine's `energy`; 1.008 · 10⁻⁷
of itself, RK4's drift) and the damping, c·θ′ off each angular acceleration,
which makes every mode decay at c/2. The start slider steps by whole degrees,
so √2° is not on it: "Set it up" sets 1.414° exactly and the slider shows 1°.
It sets the build and the start and lets go.

**The bouncing ball's** four (2026-11-21) hold the table-tennis ball's first
landing from 30 cm with quadratic drag (0.249 s, 0.7 % later than in a
vacuum), its first apex (23.66 cm), its first flight (0.439 s) and the steel
ball's time until still at half its bounce from 5 cm. The first three solve
each formula in another form than the engine (arcosh where it takes atanh,
ln(1 + …) where it takes `log1p`) and agree to 10⁻¹⁵, which confirms the
engine's rewrites against cancellation. The last is the vacuum's geometric
series, 2u/(g(1 − e)), at a height where the air is nearly nothing
((v/v∞)² = 2.7 · 10⁻⁴): 5.7 · 10⁻⁵ off, within 3 · 10⁻⁴, a bound on the air's
share rather than its first-order effect. No case holds the ITTF's 240–265 mm
from 305 mm (the leaflet was not fetched). "Set it up" sets the build card's
ball, its bounce and the height; the play card's two always race as the
exhibit's presets, from that height.

**The spinning platform's** four (2026-11-21) hold the moment of inertia
leaning out (5.3412 kg·m², the arms summed by the parallel-axis theorem from
the rod's middle where the engine writes m(s² + d²/3)), the rate standing up
against the rate leaning out (the momentum kept, 3.2056 times), the hands'
pull at half a turn a second (124 N) and the bearing's stop after one push
(L/τ = 85 s). All four agree to 10⁻¹³ or better. "Set it up" sets the
bearing's friction and the lean, from rest and without the auto mode; the
push and the standing up are the reader's.

**The coupled pendulums'** four (2026-11-21) hold the period in step and the
period against each other, both timed on the page's own loop at its 10°
against the exact periods at 10° (the lone pendulum's 4K√(L/g), and a
quadrature of the mode's energy; the RK4 step leaves 2.5 · 10⁻¹⁰), the beat
of 22.94913 s to Eyler's formula for equal pendulums, and the energy kept over
30 s to 10⁻¹⁰. The tiles are small-swing figures: at 10° the loop's modes run
0.19 % and 0.26 % slower, and the beat timed on the loop comes to about 23.0 s,
which the page's "about" covers. "Set it up" sets the build and lets the pair
go as the case says.

**The smoke ring's** three (2026-11-21) hold the drum's effective area to a
Simpson sum over the stretched skin's log profile (11.3 holes), the slug's
length for a full half-second press to continuity with the moving hole's plus
one ((A_eff/A_hole + 1)·d/D = 3.2803; the model's line above said 3.0, a figure
from before that fix), and the ring's speed to Kelvin's formula for a thin
core, Γ/(4πR)·(ln(8R/a) − ¼), on the engine's own circulation. The engine's
docstring called that speed Saffman's until 2026-11-21; Saffman's viscous ring
has −0.558, and the number here is Kelvin's. The circulation itself, Γ = ½∫(u² − ẋ²)dt, the
exhibit's central number, has no case: the slug model's sources are behind
paywalls, and no quote was invented. "Set it up" sets the drum and a full
press of half a second; the reader presses.

**The glass-bead rainbow's** four (2026-11-21) hold a water drop's ring at
42.0781° by the source's route (the extremum cos β = 2√(n² − 1)/(√3 n)), not
the engine's, the glass ring's width of 1.4918° to Cauchy's dispersion between
700 and 400 nm, the drawn ray halfway out (16.8196°, the traced vector against
the tiles' angle formula) and the light back after one reflection to Fresnel's
formulas. That last one is the loosest: the engine's midpoint sum over 2000
rings of equal area lies 6.3 · 10⁻⁶ over the integral, within 2 · 10⁻⁵; it is
the ring count, not the formula (20,000 rings bring it to 10⁻⁷). "Set it up"
sets the material and its index and, for the drawn ray, the ray's impact.

**The ball cannon's** four (2026-11-21) hold the stack's speed at the floor
(4.42019 m/s, the fall with quadratic drag) and three numbers of the bottom
ball alone on a lossless floor, where the Flores damping is off and the contact
is Hertz's own: its peak force (1325.2 N, with the weight's work in the dent,
a step of ours marked derived: without it the hand lies 0.64 % low), its
duration to Patrício's τ (the engine counts it in 10 µs steps: 9.5 · 10⁻⁴,
within 2 · 10⁻³) and its impulse, 2mv plus the weight's share. No case holds
the launch itself: the engine meets the textbook's one-after-another model
only with a gap and no losses, and the rest (gravity in the contact, the
contacts overlapping) has no clean bound. "Set it up" sets the stack, its
height and its contacts; the reader drops.

**The harmonograph's** four (2026-11-21) hold the pen's period at 30° to the
exact pendulum's 4√(L/g)·K(sin 15°) (1.017 times the small swing's), an exact
2 : 3 at 12° each closing on itself after two of the pen's periods (to
10⁻¹¹ m; the first version's start widened the swing and missed by 14 µm), the
detuned pair's turn of 25.675 s from the exact periods (the small swings'
frequencies would give 89.7 s, the first version's mistake), and the swing's
fade to a tenth in 2 ln 10/c. The fade is timed at 2°, where the pendulum's
own non-linearity leaves 1.4 · 10⁻⁵, within 5 · 10⁻⁵. "Set it up" sets the
build with the board's length exact, where the detune slider's 0.05 % steps
would miss the page's opening 0.667 %, and the drawing starts over.

**The overhang's** four (2026-11-21) hold nine blocks' furthest reach to half
the harmonic number as an exact fraction (7129/5040 lengths, 28.2897 cm), every
layer of that stack exactly at its limit (to 10⁻¹⁶), nine blocks in even steps
at 9/10 of a length (18 cm), and the 1674 blocks it takes to reach four lengths
(the engine's float sum is safe there: half the harmonic number passes 4 by
2.4 · 10⁻⁴ at 1674 and misses it by 5.6 · 10⁻⁵ at 1673). Only the even stack
has "Set it up": the furthest stack is the page's held answer, shown once the
reader has tipped a stack, so its two cases set nothing, and the count of 1674
is a figure in the trick.

**The elephant's** three (2026-11-21) hold the jet's momentum, summed over the
engine's Gaussian profile where the ball floats, to the trunk's ρU₀²πD²/4
(1.98 N, to 10⁻¹³: the centre speed and the width keep it together), the
lift-off speed from the closed-form mean of u² over the ball at rest on the rim
(12.0664 m/s against the route's 12.0725) and the speed of the air at the
floating ball to drag = weight − buoyancy (7.407 m/s, after 20 s of the
page's loop). The lift-off's 5.1 · 10⁻⁴ is the model's 288-point rule, which
lies 10⁻³ high in ⟨u²⟩ at the rest height, within 10⁻³; the jet's B = 6 and
its Gaussian are the model's choices, not sourced numbers. "Set it up" sets
the build, the trunk upright and the ball back on the rim.

**The gyroscope's** four (2026-11-21) hold the steady turn's time round the
string, level at 200 rpm, to L₃/(m·g·d) (8.0514 s; level, the slow root is
exactly that, so OpenStax's ω_P ≪ ω costs nothing), the axle's dip let go
from rest to the kept quantities (3.1940°), the nod's rate to L₃/I₁ and the
suitcase's torque at a quarter turn a second (5.92 N·m). The moments of
inertia are worked out in the cases from the hoop's and the parallel-axis
theorem, not read from the engine. The nods are counted at 600 rpm, the
slider's top: at 200 rpm the dip of 3.2° is no longer small and quickens the
nod by 0.23 %; at 600 it leaves 2.9 · 10⁻⁵, within 10⁻⁴. "Set it up" sets the
spin and the release and lets the wheel go; the suitcase's sets the spin only.
With the gyroscope every exhibit has its cases; a case with nothing to set
(the overhang's furthest stack, the resonance's buckling rod) shows no button.

**On the page** a section "Check it yourself" (`check-section.tsx`) lists the
cases, each with its formula as an `Equation` (`check-formulas.ts`), both
values to seven digits, the deviation, why the case would catch a mistake,
and the sources linked and quoted. It is public and meant to teach (Marcel,
the same day: "Wenn der Aufwand für Überprüfung getan wird kann der auch
gleich zu Lehrzwecken dienen").

**Set it up** (Marcel, the same day, on a side agent's note that many cases
used values no slider reached: "Regler erweitern"). Every case has a button
that sets the exhibit above to it and scrolls up to it (`check-setting.ts`);
its setting is in the page's own inputs, written into `checks.json` by the
case's module. The page sets the build while it renders, and the twin, built
anew for it, sets how it starts. For that the sliders grew:
- **the sphere** a fourth "who pushes", **No hand**: the ball let go at a
  start angle (0–150°) and rolling sideways (0–8 m/s), and its sphere up to
  1 m across;
- **the coil** where the car is let go (from the coil's middle to the top of
  the ramp), and its mass on a logarithmic slider from 50 g to 20 kg (the
  route takes up to 20). The brake's case is a 15 kg car on the page's own
  track, measured as the height it falls short on the other side, against
  (1/R)·∫k²v dx with v from the drop alone (to 4 · 10⁻⁴);
- **the chair** the eye moved sideways, 0.01 to 70 mm on a logarithmic slider
  with a stop at zero: 0.16 mm is the parallax case, 65 mm the other eye; "one
  picture" holds only below the engine's tolerance.

**The verdict is an admin's** (Marcel chose a button over a commit): signed
in as an admin, an exhibit with cases shows "Confirm as checked" and "Take
the check back" (`PUT`/`DELETE /admin/experiments/checks/{exhibit}`). The
verdict is stored with the fingerprint of the code it was given on
(`staunlabor.domain.checks.fingerprint`: the exhibit's check module and every
module it imports, and so on down, engine modules and the checks' shared
`checks/_hand.py` alike, without docstrings and comments),
and `GET /experiments/checks` counts it only while that is still the
deployed code's. An engine change brings "not yet checked" back by itself.
The public answer gives the day and nothing of who checked (Marcel: only the
date).

**Refactors uncheck** (Marcel, 2026-11-19, on a side agent's note: "Das ist
sinnvoll. Und sollte bei zukünftigen Refactorings berücksichtigt werden").
The fingerprint changes with any code change in the exhibit's engine
modules, a renamed variable or a function split as much as a new constant;
only docstrings and comments are left out. A change to a helper several
engines import unchecks all of them, and so does a change to the cases. So
the refactors of the engine (the audit's) go before an exhibit is checked,
and a change after says which exhibits it unchecks. The browser ports in
`simulate/` are not in the fingerprint: they are held to the engine by
`engine-cases.json`, not by the check.

**Shared code out of the pendulum** (2026-11-22, Marcel's go-ahead while no
exhibit was yet checked, so that every exhibit is unchecked once and for
nothing). `pendulum.py` had held, besides the pendulum's physics, gravity, the
general RK4 step, the sampling and the run bounds, and fifteen engine modules
imported it for those; since the fingerprint follows imports, a change to the
pendulum's AGM would have unchecked all fifteen, though only the pendulum wave
and the harmonograph use it. Now:

- `experiments/constants.py` holds what several exhibits share and none owns:
  `G`, `SOLID_BALL_INERTIA` (2/5), `HOLLOW_BALL_INERTIA` (2/3),
  `RESISTANCE_FADE_M_S`. It is **meant never to change**; everything an exhibit
  might tune stays in its own module. The ten modules that wrote `G` out, and
  sphere, coriolis, race, coil and well for the others, import it; the well no
  longer imports the sphere, the race no longer the sphere (`well.SHARE` is
  `1/(1 + SOLID_BALL_INERTIA)`, the same bits as 5/7).
- `experiments/numerics.py` holds `rk4`, `rk4_second_order` (the two-list
  form of the cannon's and the cradle's contact steps), `sample_every`,
  `check_run` and the pendulums' `STEP_S`, `SAMPLES_PER_S`, `MAX_DURATION_S`.
  The coil, the sphere and the smoke ring now take the shared `rk4`, the cannon
  and the cradle `rk4_second_order`; the funnel, the gyroscope, the elephant,
  the diver, the cannon's free flight and the resonance rack keep their step
  written out, because the generic one cost them 20 % to twice the time
  (measured old against new in one process) under a request's budget.
- `checks/_hand.py` holds the checks' own `G`, `elliptic_k_by_sum` /
  `elliptic_f_by_sum` (the midpoint sum, 20 000 steps) and `bisect`, kept
  apart from the engine on purpose. 24 check modules took `G` from it, seven
  their K sum, twelve their plain halving; the halvings that differ (the
  arch's thickness returning `hi`, Maxwell's early stop, every golden-section
  search) stay as they were.
- The checks' `ENGINE` tuples are gone: the fingerprint walks from the check
  module alone, whose `import … as engine` names the same modules.

Every number stayed to the bit: the four writers' files (`engine-cases.json`,
the two `test-fixtures.json`, `checks.json`) came out unchanged, and the
check results agreed to the last bit. The commit unchecks all 35 exhibits
with checks: arch, beats, bounce, cannon, chair, chaos, chladni, circuit,
coil, cone, coriolis, coupled, cradle, diver, elephant, foucault, gyroscope,
harmonograph, levitation, maxwell, overhang, parabola, peg, plates, platform,
race, rainbow, resonance, sky, slits, smoke, sphere, waterwheel, wave, well.
From now on a change to the pendulum's own physics unchecks only the pendulum
wave and the harmonograph.

## Checking the mathematics

Before the engine was written each model was checked independently with SciPy
(scripts in the session's scratchpad, not kept):

* **The 5/7 rule**: the full rigid body — centre, angular velocity, the contact
  force solved from the rolling constraint each instant — against the reduced
  pendulum, free and driven: equal to 2·10⁻¹¹ m, the spin about the normal
  staying at zero. `test_a_rolling_ball_s_centre_moves_like_a_pendulum_under_five_sevenths_of_gravity`
  repeats it in pure Python with a test-only RK4 (`tests/unit/ode.py`).
* **The orbit depth** `g'/Ω²` and **the wobble** `Ω·√(1 + 3cos²θ)` against
  simulated orbits; **autoresonance** with a sweep and a jump.
* **The dipole flux** against the dipole's field integrated over each turn
  (10⁻⁵); **a finite magnet** (a current sheet, Maxwell's coaxial-loop mutual
  inductance) against the dipole: 1 % in `Ψ(0)` and 3 % in the peak of `k` for
  the default proportions (a ratio of geometry, so the number of turns does
  not change it) — the module says so; **Wheeler's inductance**
  against the current sheet's double integral: 0.3 %.
* **The car** with the full circuit (SciPy's LSODA): the press rule climbing
  both ways, the reversed rule trapping it, the closed coil braking it.

Two things the first engine run found and fixed: a sign in the sphere's wall
force (rolling resistance had been nearly switched off), and a kink where each
ramp met the flat, which a fixed-step integrator crosses with a first-order
error — the energy account closed to 10⁻⁴ J with it. The track now bends over
4 cm, as real ones do, and the account closes to 10⁻⁶ of the battery's energy,
falling with the fourth power of the step. A press rule asked about a car
standing still had flipped the buttons every step; it now presses nothing
below 1 cm/s.

## How it was built

1. **The API**, done 2026-11-07: `GET /experiments/defaults`, `POST
   /experiments/sphere` (the orbits and the swing), `POST /experiments/coil`
   (the figures, Ψ and `k`), `GET /experiments/chair` (the three boxes), all
   public under one budget (`security.EXPERIMENT_RUNS`, 90 per ten seconds then,
   180 since 2026-11-20, a kept answer free;
   the dearest was the chair at about 10 ms, and is now the race, `POST
   /experiments/race`, at about 45 ms with its velocities and accelerations
   written out; its pit runs in the browser). `tests/api/test_experiments_api.py` covers them.
2. **The two loops in the browser.** Done 2026-11-07: `features/experiments/simulate/` (`sphere.ts`, `coil.ts`),
   `scripts/write-experiments-cases.py` writing `engine-cases.json`,
   `tests/unit/test_experiments_browser.py` and `simulate.test.ts`; the port
   agrees with the engine to 1.2·10⁻¹⁴ at worst, the coil's cases bit for bit.
   What follows was the plan: The sphere and the car have to answer a
   hand at 60 frames a second, so their steps are ported to TypeScript and run
   in the page (not a worker: a round trip per frame is the lag the port is for).
   They are held to the engine: a script writes
   `engine-cases.json` (scripted drives and presses, the runs' samples), a
   backend test holds the file to the engine, and a frontend test holds the
   port to the file. The course's notes in Kurvenschmiede suggest generating a
   third port from one description instead of copying again; these two are small (six and
   six states), so they are copied, and that remains the option for the next.
3. **The pages**, chair first (no time loop, so it settles the page frame) —
   done 2026-11-07: the overview and `/chair`, the frame
   (`exhibit-frame.tsx`), the three holes with an eye that moves and the box
   turned round (`chair-views.tsx`) — then the coil, done 2026-11-07:
   `/coil`, the track drawn at true scale with the car and the coil
   lit in the colour of the button held (`coil-track.tsx`), two buttons held by
   pointer or keyboard, the ±100 mA meter, the rule as an autopilot, real time,
   a quarter or a tenth, the build's sliders, every equation explained, Ψ and
   `k` from the server and the timing curve from the port — then the sphere,
   done 2026-11-07: `/sphere`, the sphere from above (where the
   reader pushes) and from the side (how high the ball rides), the ball the
   port's, the hand between finger and ball a critically damped spring at
   6 Hz (`sphere-hand.ts`: a finger gives positions in jumps, the ball needs a
   smooth acceleration), the orbits and the swing on one chart with where the
   reader is.

   **Every page has an auto mode with the timing done right** (Marcel,
   2026-11-07): the coil presses plus over the whole flat and minus from the
   middle, switched exactly at the middle (the engine: 13.0 mJ a pass against
   11.4 for the 6 cm window, the top a pass sooner); the sphere is pushed
   always a quarter turn ahead of the ball, plus the hand's own lag
   `2·atan(f/6 Hz)`, so the tempo rises exactly as the ball climbs —
   past 75° within 15 s, where the slow sweep needs some 40 — up to 4 Hz, as
   fast as an arm goes, where the ball settles at that tempo's orbit, 86°;
   the chair, which has no timing, lets the eye drift off the holes and back
   while the box turns, so the effect plays without a hand on it. Touch first: the sphere is circled
   with a finger, the coil has two big buttons, the eye is dragged. Every
   animation pauses, and starts paused for a reader who asked for reduced motion.
   There, a twin's main action starts its clock: a push, a press, a let-go, a
   tilt, a tone, a new rate, an automatic mode switched on (2026-11-19). The
   reader is asking to see it move, and before this, on eight pages, the action
   did nothing until the Run button in the header. Actions that only reset
   leave the clock as it is. A play card's hint says what to do and what to
   watch, never what will happen: the page's question is the reader's to answer
   (2026-11-19: the hints of the waterwheel, of the smoke ring's and the
   sphere's automatic modes and of the cone gave it away, the sphere's with
   "a quarter turn ahead" and "up to about 4 Hz").

   **The answer waits for a try** (`held.tsx`, 2026-11-19): nine play cards
   showed the answer to their page's question from the first frame. Each now
   holds it back until the exhibit has shown it, and says where it will stand,
   with "Show the answer" for the reader who wants it at once. What "shown"
   means is the page's: Foucault, an hour under the pendulum (the full turn and
   the turn per hour); Coriolis, a throw at an aim of the reader's own (the
   aim that hits, and the button that sets it); the peg, whatever follows the
   catch (the outcome, the height a loop needs, the slack height and its line);
   the cone, a roll to its end (the verdict, the axis's dashed path); the
   elephant, the ball falling (its tilt limit); the overhang, a stack tipped
   (the furthest reach, and its button); the coupled pendulums, half a beat
   (the beat and the share that goes over); the cradle, the first second after
   letting go (the speeds after the knock, the far share); the race, every
   ball arrived in a race the reader started (the table by rank; before, the
   tracks' own order, each place and time shown as its ball arrives). Once out,
   an answer stays out for the visit, across new settings: hiding it again on
   every slider would only be in the way. The cone still lies at the high end
   of rails it will roll down (`start_for`, the engine's, with figures in the
   prose): moving it would change the engine and its catalogue. The
   resonance rods followed on 2026-11-20: their play card's beat started in
   step with the third rod, the rods' frequencies stood under the drawing and
   the chart drew every peak, so "Find the beat" was found before anybody
   looked. The beat now starts at 1 Hz, below every rod (the overview's
   preview stays in step), and the frequencies and the chart wait for a rod
   swinging 2 cm, twenty times the table's millimetre, or a sweep.
   **The goal on the drawing** (2026-11-20): three play cards asked for
   something their drawing did not show. The sphere's side view names the
   dashed equator "Goal: the equator"; the carousel rings the other seat and
   names it "Target"; the overhang draws a line a whole block past the edge,
   "Goal: 1 block length", which nine blocks pass (they reach 1.41) and four
   are the fewest for, so it gives the furthest away no more than the
   trick's own "four blocks for one length".
4. **Seven languages**, the pages since, and the move to this site on
   2026-11-13 (`docs/plan.md`).
