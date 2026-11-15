"""The bouncing ball: a ball dropped on a hard plate bounces ever lower and ever faster, and is still after a finite time.

The exhibit sets a table-tennis ball and a steel ball side by side over a hard
plate. Dropped, each clicks on the plate, each click quicker than the one
before, faster and faster until the clicking runs together into a buzz and
stops. The steel ball clicks for much longer.

**Why it stops.** Each bounce gives back a fixed share of the speed it came
in with, the ball's restitution ``e``: it rises to ``e²`` of the height before
and is in the air ``e`` times as long. The flights shrink like a geometric
series, ``t₁·(1 + e + e² + …) = t₁/(1 − e)``: infinitely many bounces, and a
finite time. The steel ball keeps more of its speed (``e`` nearer 1), so its
series takes longer to add up.

**The model.** Between bounces the ball flies straight up and down with its
weight and the air's drag, ``½·ρ·c_d·A·v²`` against the motion, which has an
exact solution: up, ``v = v_T·tan(atan(v₀/v_T) − g·t/v_T)`` to the top at
``v_T²/(2g)·ln(1 + v₀²/v_T²)``; down, ``v = −v_T·tanh(g·t/v_T)``, with ``v_T``
the terminal speed. A bounce turns the speed round and keeps ``e`` of it. When
the flights are shorter than a tenth of a millisecond the rest of the series
is summed in closed form, the drag there long negligible.

**What it leaves out.** The restitution's dependence on the speed (a constant
here, as measured for the slow bounces that count); the contact's own time,
some tens of microseconds, which in reality ends the series with a buzz before
its sum (the ball rests on the plate a little early); spin; the plate's
recoil. The values: a steel ball 20 mm across (33 g) with ``e = 0.95`` on a
hardened steel plate, an assumption; a regulation table-tennis ball (2.7 g,
40 mm), whose ``e = 0.92`` makes it rise from 305 mm to 240 mm with the air's
drag, the middle of what the rules of table tennis demand (230 to 250 mm).
"""

from __future__ import annotations

import bisect
import math
from dataclasses import dataclass

G = 9.80665
#: Air at 20 °C, in kg/m³, and a smooth sphere's drag coefficient.
AIR_DENSITY = 1.204
DRAG_COEFFICIENT = 0.47
#: Flights shorter than this are summed in closed form, without the air.
SHORTEST_FLIGHT_S = 1e-4
#: A bounce counts while its flight lasts at least this long.
COUNTED_FLIGHT_S = 0.01


@dataclass(frozen=True)
class BouncingBall:
    mass_kg: float = 0.0329
    diameter_m: float = 0.020
    #: The share of its speed a bounce gives back.
    restitution: float = 0.95

    def __post_init__(self) -> None:
        if not 0 < self.mass_kg <= 10:
            raise ValueError("a ball weighs more than nothing and at most 10 kg")
        if not 0.005 <= self.diameter_m <= 0.3:
            raise ValueError("a ball is 5 mm to 30 cm across")
        if not 0.1 <= self.restitution <= 0.99:
            raise ValueError("a bounce gives back 10 % to 99 % of the speed")


#: The exhibit's two: a steel ball on a hardened steel plate, and a regulation
#: table-tennis ball; both let go 30 cm over the plate.
STEEL = BouncingBall()
TABLE_TENNIS = BouncingBall(mass_kg=0.0027, diameter_m=0.040, restitution=0.92)
EXHIBIT_HEIGHT_M = 0.30


def terminal_speed(ball: BouncingBall) -> float:
    """``v_T = √(2·m·g/(ρ·c_d·A))``, in m/s: where the air's drag is the weight."""
    area = math.pi * ball.diameter_m**2 / 4
    return math.sqrt(2 * ball.mass_kg * G / (AIR_DENSITY * DRAG_COEFFICIENT * area))


def _ln_cosh(u: float) -> float:
    """``ln cosh u``, written so as not to cancel near zero."""
    return math.log1p(2 * math.sinh(u / 2) ** 2)


def rise(speed_m_s: float, terminal_m_s: float) -> tuple[float, float]:
    """``(t, h)``: thrown up at ``speed_m_s``, how long to the top and how high."""
    ratio = speed_m_s / terminal_m_s
    return terminal_m_s / G * math.atan(ratio), terminal_m_s**2 / (2 * G) * math.log1p(ratio * ratio)


def fall(height_m: float, terminal_m_s: float) -> tuple[float, float]:
    """``(v, t)``: let go at rest ``height_m`` up, how fast it lands and when."""
    landing = terminal_m_s * math.sqrt(-math.expm1(-2 * G * height_m / terminal_m_s**2))
    return landing, terminal_m_s / G * math.atanh(landing / terminal_m_s)


@dataclass(frozen=True)
class Bounces:
    #: When the ball strikes the plate, the drop's landing first, and how fast.
    impacts_s: tuple[float, ...]
    speeds_m_s: tuple[float, ...]
    #: How high it rises after each strike but the last one listed.
    apexes_m: tuple[float, ...]
    #: When it lies still: the last strike listed plus the rest of the series.
    still_s: float


def bounces(ball: BouncingBall, height_m: float) -> Bounces:
    """Every flight longer than ``SHORTEST_FLIGHT_S``, with the air, and the
    rest of the series in closed form: thrown back at ``u``, the ball's
    remaining flights without the air are ``2u/g·(1 + e + e² + …) = 2u/(g·(1 − e))``."""
    if not 0.01 <= height_m <= 2:
        raise ValueError("a ball is dropped from 1 cm to 2 m")
    terminal = terminal_speed(ball)
    e = ball.restitution
    speed, t = fall(height_m, terminal)
    impacts, speeds, apexes = [t], [speed], []
    while True:
        out = e * speed
        up_s, apex = rise(out, terminal)
        landing, down_s = fall(apex, terminal)
        if up_s + down_s < SHORTEST_FLIGHT_S:
            return Bounces(tuple(impacts), tuple(speeds), tuple(apexes), t + 2 * out / (G * (1 - e)))
        apexes.append(apex)
        t += up_s + down_s
        speed = landing
        impacts.append(t)
        speeds.append(speed)


def state(ball: BouncingBall, height_m: float, run: Bounces, t_s: float) -> tuple[float, float]:
    """``(y, v)``: the ball's height (m) and upward speed (m/s) ``t_s`` after
    it is let go; at a strike's own moment, as it leaves. In the series' closed-form rest, the flights are under a
    tenth of a millisecond and the hops under ``g·(10⁻⁴ s)²/8``, some ten
    nanometres: the ball is drawn on the plate."""
    if t_s < 0:
        raise ValueError("the ball is asked about from the moment it is let go")
    terminal = terminal_speed(ball)
    if t_s < run.impacts_s[0]:
        u = G * t_s / terminal
        return height_m - terminal**2 / G * _ln_cosh(u), -terminal * math.tanh(u)
    i = bisect.bisect_right(run.impacts_s, t_s) - 1
    if i >= len(run.apexes_m):
        return 0.0, 0.0
    tau = t_s - run.impacts_s[i]
    out = ball.restitution * run.speeds_m_s[i]
    lead = math.atan(out / terminal)
    up_s = terminal / G * lead
    if tau <= up_s:
        x = G * tau / terminal
        # ln(cos(lead − x)/cos(lead)), as log1p(cos x − 1 + tan(lead)·sin x).
        y = terminal**2 / G * math.log1p(-2 * math.sin(x / 2) ** 2 + math.tan(lead) * math.sin(x))
        return y, terminal * math.tan(lead - x)
    u = G * (tau - up_s) / terminal
    return run.apexes_m[i] - terminal**2 / G * _ln_cosh(u), -terminal * math.tanh(u)


@dataclass(frozen=True)
class BounceFigures:
    terminal_m_s: float
    #: The drop's landing, and the first bounce's height and flight.
    landing_s: float
    first_apex_m: float
    first_flight_s: float
    still_s: float
    #: Bounces whose flight lasts at least ``COUNTED_FLIGHT_S``.
    counted: int
    #: The second flight over the first: the restitution, heard.
    rhythm: float


def figures(ball: BouncingBall, height_m: float) -> BounceFigures:
    run = bounces(ball, height_m)
    flights = [b - a for a, b in zip(run.impacts_s, run.impacts_s[1:], strict=False)]
    return BounceFigures(
        terminal_m_s=terminal_speed(ball),
        landing_s=run.impacts_s[0],
        first_apex_m=run.apexes_m[0],
        first_flight_s=flights[0],
        still_s=run.still_s,
        counted=sum(1 for f in flights if f >= COUNTED_FLIGHT_S),
        rhythm=flights[1] / flights[0],
    )
