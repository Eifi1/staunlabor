# The exhibits

Staunlabor is a site of hands-on exhibits, computed: each page lets the reader
play the visitor in a simulation of the exhibit, then shows the computation
behind what they felt, every number from the engine, `domain/experiments/`,
and asserted in `tests/unit/test_experiments.py`. Each exhibit is inspired
by one at the Swiss Science Center Technorama in Winterthur. The first eight,
which Marcel played with there, were first built from 2026-11-07 as the
"Experiments" area of an engineering app, Kurvenschmiede, and moved here on
2026-11-13 (`docs/plan.md`). The overview credits the museum in one line
("inspired by exhibits at the Swiss Science Center Technorama, Winterthur"),
with no logo and no photo: every drawing and text is the site's own.

This document says what each exhibit is, how it is modelled, what checking the
models found before the engine was written, and what is left to build.

## The page

Every exhibit gets one page in one shape:

1. **At the exhibit** — a drawing of the setup and what the visitor does.
2. **Try it** — the exhibit's twin, played with a mouse or a finger.
3. **What happens** — the derivation step by step, KaTeX, the engine's numbers.
4. **The sweet spot** — the one insight that explains the trick, as a chart.
5. **Change the exhibit** — sliders for its size, mass, voltage and so on.
6. **Further** — the lessons it stands on, in the differential-equations
   course at kurvenschmiede.app, which stayed there.

**How it is computed** (Marcel, 2026-11-07: "are these differential
equations?"). Each exhibit that moves has a section between what happens and
the trick that writes its whole model as one system and says how it is solved:
the coil's three coupled equations (position, speed, current — `k(x)` in both
the mechanics and the circuit) and the sphere's six (the ball centre's position
and velocity), stepped by classical Runge–Kutta every 0.2 and 1 ms, the same
steps in the browser; the platform's one, `dL/dt = −τ_f`, solved exactly. Each
links to the course's lessons it stands on (first and second order,
numerics), at kurvenschmiede.app.

**No formula stands alone** (Marcel, 2026-11-07: "if there are equations
involved, are they also explained?"). Every one is an `Equation` block
(`features/experiments/equation.tsx`): the formula, one sentence saying what it
means in words, and a legend of every symbol in it with its meaning and unit.

## The overview

The front page, `/`, is the overview. It was a grid of eight cards until
2026-11-12, when Marcel asked for it to be redone now that there were "schon
einige Experimente". Top to bottom (`overview-page.tsx`):

* **The experiment of the day**, playing by itself beside its name, its
  summary and a question to guess at before opening it
  (`experiments.exhibits.<x>.question`), with the button into the exhibit and
  **"Earlier days"**: the last fourteen days in a dialog (`?dialog=history`,
  so a phone's Back closes it), a still of each that plays while it is
  pointed at or focused. Not on the page itself (Marcel, the same evening:
  "Show the history only in a dialog on request. Not right away. That shall
  be reserved for the experiment of the day"): anyplot.ai's plot of the day
  stands alone on its landing, and APOD's or Wikipedia's picture of the day
  keeps its archive a link away.
* **Every exhibit**, filtered by topic chips (`TOPICS` in `exhibits.ts`: an
  exhibit is about one or two — momentum, angular momentum, energy,
  oscillation, flow, induction, perception), with "n of 8 tried on this
  device" and a "Forget", and on each card its topics, a
  tick once tried, "Today" on the day's, and "Builds on:" with links to the
  course's lessons at kurvenschmiede.app — the list the page's "How it is computed" links to, kept
  in `exhibits.ts` beside the topics since both read it.

**The pick: random, with a memory** (`daily.ts`; Marcel chose it over a fixed
rotation and over an admin's choice). From the epoch, 2026-11-12, the days are
cut into rounds of one day per exhibit, so every exhibit has its turn before
any has a second. A round is drawn day by day, by a generator seeded with the
day the round starts, from the exhibits whose last turn is at least half a
round back (four days with eight): a shuffle alone guards only its own round,
and the first week drawn that way showed the chair on a Friday and again on
the Sunday. Among those, Marcel's **bonus and malus** ("dass es
unwahrscheinlicher wird, dass gleiche Experimente aufeinander folgen") lean
the draw (`DAILY_WEIGHTS`): a quarter more weight per day waited beyond the
spacing, a quarter of the weight for an exhibit about a topic yesterday's was
about, a tenth for one that came right after yesterday's in the round before.
They were measured over 2000 rounds against a plain shuffle (`daily.ts` has
the numbers): pairs of the round before repeated in order fall from 0.9 a round
to 0.27, triples from 0.12 to 0.01, neighbours about one topic from 14.5 days in
a hundred to 7.9. A stricter first version — six days apart, a full point of
bonus a day — turned out a rotation in disguise, repeating triples five times
as often as a shuffle, and was dropped the same evening. They are weights, so
"rarer" is not "never": the first two days, the smoke ring and then the
elephant, are a 3 % draw that came up. The day is Zurich's, so one day has one
exhibit whoever asks; the pick needs no server, no table and no admin, and the
history is the rule run backwards. A new exhibit joins at the first round that starts on or after its
`since` day, never mid-round, which would redraw days already shown; so
`since` is the day it **ships** — a past date puts it into a round already
under way on the live site.

**The previews are the pages' own auto modes** (`preview-mode.tsx`): each
page's play component takes `preview` and `paused`, and in a preview it starts
in its auto mode, draws its views only — no buttons, sliders or figures — and
runs while `paused` is false. The motion on the overview is the motion on the
page, from the same browser port, so it cannot drift from what it advertises.
The chair, whose turning lives in its page rather than a play component, has
a `ChairPreview` of its own over the same `autoView`. `exhibit-preview.tsx`
imports each lazily from its page's module — the chunk a click would load
anyway — mounts it once it comes near the screen, stops it off screen, and
shows the first frame as a still under `prefers-reduced-motion` or where that
cannot be read. The coil's keyboard (its two buttons on `+`/`−` and the
arrows) is off in a preview: the keys belong to the page it stands on.

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
  swings (0.84 Hz at ±90° against 0.99 Hz small).
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
switched out, reads nothing); coasting through, the meter reads about 14 mA, and the car needs a handful of good passes to reach the top (the auto mode: six, from halfway up the left ramp). More
turns of thinner wire lower the current without lowering what a pass gains,
because `Ψ` grows with the turns as fast as `1/R` falls; a first guess of 400
turns at 3 V drew 455 mA, off the meter's scale. All of it is a slider.

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
* **There is a top speed however well you press**, where `k·v` equals the
  supply: 4.8 m/s for the default build.
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
checks by adding that pull up along the way in. Leaning out, the hands hold
124 N on the bar; upright, nothing. The bearing stops a spin after about 84 s.
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
height, so the ball comes back to that height, bobbing at 0.54 Hz, and the air
damps the bob. Off the axis the suction pulls it back, strongest about 7 cm
out. Tilted, it hangs lower and to the low side, and at 43.7° no balance is
left; tilted slowly in a run, it falls just past that. Tilted from the start,
before it has risen, it falls well before: the rise carries it out sideways.

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
ball from the rim to the stated height, back from a push, and out of a slowly
tilted jet just past the stated limit.

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
  times the hole. The air leaves the hole at that ratio times the hand's speed.
- **The ring** is the slug model's: circulation `Γ = ½∫u²dt`, taken up only
  until the slug is four hole diameters long (the formation number; a full
  press here is 3.0). Its radius is 0.6 hole diameters and its core 0.35 of
  that; it flies at Saffman's speed and has Reynolds number `Γ/ν`.
- **Too fast, too slow:** both the circulation and the speed grow in
  proportion to the pace of the press. So the two failures are two thresholds on
  one scale: past `Re = 1.6·10⁵` the ring is turbulent and smears; slower than
  the hall's draught, 0.5 m/s, it is carried off before it forms. Neither is a
  textbook number for a ring this size in a museum hall; both are set to
  Marcel's half second and offered as sliders that say so.
- **The hand** feels the skin's spring (tension 150 N/m assumed) and the air's
  back pressure `½ρu²` over `A_eff`.
- **The flight:** a laminar ring slows only as its core thickens viscously; a
  turbulent one widens at 1 % of the distance and slows with the cube of its
  size; the draught carries both sideways.

**What it shows.** A full press makes a ring between 0.21 and 1.28 s, best at
0.52 s: Re 67,000, the ring at 1.28 m/s, the air out of the hole at 2.8 m/s. A
jab of 0.1 s gives Re 336,000 and needs 122 N on the hand, where a slow press
needs only the skin's 48 N. In the page, the reader presses with a button (a
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
  share `e` (0.85, assumed) of the speed it closed at — to 2 %.
- **Stepped with RK4**: 0.5 ms while every ball flies free, 10 µs while a
  contact is closed or about to close (fifty small steps for one large, the time
  grid unchanged). The impact's forces, overlaps and positions are recorded
  every 0.1 ms for 30 ms.
- **The textbook's model** is kept beside it for comparison: instantaneous hits
  one after another (`sequential_launch`), with and without losses, and the
  `(2ⁿ − 1)·v` of each ball far lighter than the one below.

**What it shows.** From a metre the stack meets the floor at 4.42 m/s. The
floor pushes back with 1.24 kN (about 220 times the bottom ball's weight), the
ball squashed by 10 mm for 10 ms; the two contacts above peak at 0.56 and
0.28 kN. Touching, the three contacts overlap — the middle ball presses into the
bottom one 1.7 ms after that one met the floor — and the top ball leaves at
6.6 m/s and climbs 2.2 times the drop, where instantaneous hits one after
another would send it off at 10.9 m/s (5.7 times). A few millimetres apart the
contacts come one after another: 5 mm gives 4.6 times, 2 cm 5.4. The
elastomer's stiffness changes the forces and the durations much and the climb
little (1 MPa 1.8 times, 50 MPa 3.4). Turned over, the stack sends nothing up.
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
- the sequential model's closed form, and the stack turned over.

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

**Joins the experiment of the day** on its `since` in `exhibits.ts`, set to
2026-12-01 as a placeholder: the pendulum exhibits ship with the joint deploy
(accounts and the kits), and `since` is set to that day when they go out.

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
`2·ln 10/c`, 230 s at `c = 0.02/s`.

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
second on its thin part. At 10° it rolls down, and is laid at the top.

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
   public under one budget (`security.EXPERIMENT_RUNS`, 90 per ten seconds;
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
4. **Seven languages**, the pages since, and the move to this site on
   2026-11-13 (`docs/plan.md`).
