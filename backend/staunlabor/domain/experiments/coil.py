"""The magnet car and the coil: induction, and the two buttons that pump it.

The exhibit is a track of two ramps, left and right, with a coil round the flat
between them and a small car carrying a magnet. A meter shows the coil's current
in milliamperes, plus or minus. Two buttons switch the coil on, one each way; a
visitor who presses the first as the car comes into the coil and the second as
it leaves sends it higher up the other ramp with every pass, until it reaches
the top of each.

**One curve does both jobs.** Call ``Ψ(x)`` the flux the car's magnet puts
through the coil's turns with the car at ``x`` (the coil's centre at zero). Its
slope ``k(x) = dΨ/dx`` is

* the **voltage** the car induces as it rolls through: ``e = k(x)·v`` — the two
  opposite swings of the meter's needle as the car comes in and goes out; and
* the **force** the coil puts on the car when a current flows: ``F = k(x)·i``.

``Ψ`` peaks with the magnet in the middle, so ``k`` changes sign there. That is
why there are two buttons: the current that pulls the car *in* pulls it *back*
once it is past the middle, so the second half wants the opposite current.
"Plus coming in, minus going out" holds whichever way the car is going, because
both halves are about where the car is, not where it is heading
(``tests/unit/test_experiments.py`` drives it both ways).

**Where the energy goes.** The battery's energy ``∫u·i dt`` becomes the car's
motion (``∫F·v dt = ∫k·v·i dt``, the same product as the induced voltage
times the current — which is the whole of the motor), heat in the coil
``∫R·i² dt``, the coil's own field ``½·L·i²``, and rolling resistance; the
test closes the account to a part in a million. A perfect pass with the full
current gains ``2·I·Ψ(0)``: in, then out, each worth ``I·Ψ(0)``.

**The magnet is a point.** ``Ψ`` is the dipole's closed form,
``μ₀·m·N/(2l)·[u/√(a² + u²)]`` between the coil's two ends — the coil's axial
field per ampere times the magnet's moment, by reciprocity. Checked against a
finite cylindrical magnet (an equivalent current sheet, Maxwell's coaxial-loop
formula) before this was written: for a Ø20 × 10 mm magnet in a coil of 30 mm
radius the peak flux differs by 1 % and the peak slope by 3 %. The coil's
inductance is Wheeler's ``μ₀·N²·π·a²/(l + 0.9·a)``, 0.3 % from the current
sheet's double integral at these proportions.

**What the numbers say about the exhibit.** The coil's time constant ``L/R``
is about a millisecond; the car takes a tenth of a second through the coil. So
the current is there the moment a button is pressed, and the only slow part of
the loop is the visitor's hand — which is the game. The exhibit's real
dimensions are not published; the defaults are a table-top build that matches
what a visitor sees — a digital meter of ±100 mA (:data:`METER_RANGE_A`) that
reads under a hundred with a button held and a few tens as the car coasts
through, and a car that needs several good passes — offered as sliders, not as
a measurement. More turns of thinner wire lower the current without lowering
what a pass gains: ``Ψ`` grows with the turns as fast as ``1/R`` falls.

What it leaves out: the magnet's pull on the coil's own iron (there is none
assumed — an air coil), the car's wheels' inertia, air, and the extra push of
the wheels' own rolling inertia. The ramps are circular arcs, so the track
pushes harder on the car where it curves (``v²/R``), and rolling resistance,
a share of that push, grows with it.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from enum import IntEnum, StrEnum

#: Standard gravity.
G = 9.80665
#: The magnetic constant, 4π·10⁻⁷ H/m.
MU0 = 4e-7 * math.pi
#: The exhibit's meter: digital, −100 to +100 mA, as remembered from a visit rather than published.
METER_RANGE_A = 0.1

#: The speed below which rolling resistance fades in rather than switching sign.
RESISTANCE_FADE_M_S = 1e-3

#: 0.2 ms: a fifth of the coil's time constant at the defaults, and fifteen
#: steps through the steepest part of ``k`` at the fastest a car goes here.
STEP_S = 2e-4

SAMPLES_PER_S = 200
MAX_DURATION_S = 60.0

#: The steepest a ramp's arc may end, radians (about 69°): past that a car
#: would be climbing a wall.
STEEPEST_RAD = 1.2


#: Below this the rule presses nothing: a car standing still is neither coming
#: in nor going out, and a rule asked anyway would flip the buttons every step.
STANDING_M_S = 0.01


class Idle(StrEnum):
    """What the coil is connected to while no button is pressed: the meter
    (closed — the induced current flows, shows, and brakes the car) or nothing."""

    CLOSED = "closed"
    OPEN = "open"


class Press(IntEnum):
    MINUS = -1
    NONE = 0
    PLUS = 1


@dataclass(frozen=True)
class Magnet:
    remanence_t: float = 1.3
    diameter_m: float = 0.020
    length_m: float = 0.010

    def __post_init__(self) -> None:
        if self.remanence_t <= 0 or self.diameter_m <= 0 or self.length_m <= 0:
            raise ValueError("the magnet needs a positive remanence and size")

    @property
    def moment_a_m2(self) -> float:
        """``m = B_r·V/μ₀``: a uniformly magnetised cylinder's dipole moment."""
        return self.remanence_t * math.pi * (self.diameter_m / 2) ** 2 * self.length_m / MU0


@dataclass(frozen=True)
class Coil:
    """The default is 1600 turns of 0.26 mm copper on a 60 mm former, 50 mm
    long: about 300 m of wire, 94 Ω."""

    turns: int = 1600
    mean_diameter_m: float = 0.060
    length_m: float = 0.050
    resistance_ohm: float = 94.0

    def __post_init__(self) -> None:
        if self.turns < 1 or self.mean_diameter_m <= 0 or self.length_m <= 0 or self.resistance_ohm <= 0:
            raise ValueError("the coil needs turns, a size and a resistance")

    @property
    def inductance_h(self) -> float:
        """Wheeler's single-layer formula."""
        a = self.mean_diameter_m / 2
        return MU0 * self.turns**2 * math.pi * a * a / (self.length_m + 0.9 * a)


@dataclass(frozen=True)
class Track:
    car_mass_kg: float = 0.15
    #: The flat between the ramps; the coil sits in its middle.
    flat_length_m: float = 0.20
    #: Along the arc, from the flat's end to the top.
    ramp_length_m: float = 0.30
    #: Each ramp is a circular arc of this radius, tangent to the flat: it
    #: starts level and steepens as it rises, as the exhibit's ramps do — a
    #: radius, not a straight incline. A smooth join also keeps the force along
    #: the track continuous, which a fixed-step integrator needs: a straight
    #: ramp would need a bend at its foot for that.
    ramp_radius_m: float = 0.90
    rolling_resistance: float = 0.005

    def __post_init__(self) -> None:
        if self.car_mass_kg <= 0 or self.flat_length_m <= 0 or self.ramp_length_m <= 0:
            raise ValueError("the car needs a mass and the track a length")
        if self.ramp_radius_m <= 0 or self.ramp_length_m / self.ramp_radius_m > STEEPEST_RAD:
            raise ValueError("a ramp's arc ends steeper than 69°: make it shorter or its radius larger")
        if self.rolling_resistance < 0:
            raise ValueError("rolling resistance cannot be negative")

    @property
    def end_m(self) -> float:
        """Where each ramp's top is, from the coil's centre."""
        return self.flat_length_m / 2 + self.ramp_length_m

    @property
    def top_height_m(self) -> float:
        return self.ramp_radius_m * (1 - math.cos(self.ramp_length_m / self.ramp_radius_m))


@dataclass(frozen=True)
class CoilExhibit:
    magnet: Magnet = Magnet()
    coil: Coil = Coil()
    track: Track = Track()
    #: A 9 V block.
    supply_v: float = 9.0
    idle: Idle = Idle.CLOSED

    def __post_init__(self) -> None:
        if self.supply_v <= 0:
            raise ValueError("the supply needs a voltage")
        if self.coil.length_m / 2 >= self.track.flat_length_m / 2:
            raise ValueError("the coil has to fit on the flat between the ramps")


# ── the curve ────────────────────────────────────────────────────────────────


def _prefactor(ex: CoilExhibit) -> float:
    return MU0 * ex.magnet.moment_a_m2 * ex.coil.turns / (2 * ex.coil.length_m)


def flux_linkage(ex: CoilExhibit, x: float) -> float:
    """Ψ(x) in webers: the magnet's flux through all the turns, the car at ``x``."""
    a = ex.coil.mean_diameter_m / 2
    u1, u2 = x + ex.coil.length_m / 2, x - ex.coil.length_m / 2
    return _prefactor(ex) * (u1 / math.sqrt(a * a + u1 * u1) - u2 / math.sqrt(a * a + u2 * u2))


def coupling(ex: CoilExhibit, x: float) -> float:
    """k(x) = dΨ/dx in V·s/m (= N/A): volts per metre per second, newtons per ampere."""
    a = ex.coil.mean_diameter_m / 2
    u1, u2 = x + ex.coil.length_m / 2, x - ex.coil.length_m / 2
    return _prefactor(ex) * a * a * ((a * a + u1 * u1) ** -1.5 - (a * a + u2 * u2) ** -1.5)


def peak_coupling(ex: CoilExhibit) -> tuple[float, float]:
    """Where ``k`` is largest on the near side, and its value: golden section."""
    lo, hi = -(ex.coil.length_m / 2 + 2 * ex.coil.mean_diameter_m), 0.0
    phi = (math.sqrt(5) - 1) / 2
    for _ in range(200):
        x1, x2 = hi - phi * (hi - lo), lo + phi * (hi - lo)
        if coupling(ex, x1) > coupling(ex, x2):
            hi = x2
        else:
            lo = x1
    x = (lo + hi) / 2
    return x, coupling(ex, x)


@dataclass(frozen=True)
class CoilFigures:
    moment_a_m2: float
    inductance_h: float
    time_constant_s: float
    full_current_a: float
    peak_flux_wb: float
    peak_coupling_v_s_per_m: float
    peak_coupling_at_m: float
    #: Where the induced voltage would equal the supply: no current, no push.
    top_speed_m_s: float
    #: ``2·I·Ψ(0)``: the most one pass can give, at full current, both buttons.
    ideal_gain_per_pass_j: float
    top_height_m: float
    #: The speed at the bottom a ramp's top needs, rolling resistance included.
    speed_for_top_m_s: float
    #: What the meter shows as the car coasts through at that speed (closed coil).
    coasting_current_a: float
    #: How long the car takes from one ``k`` peak to the other at that speed:
    #: the time a visitor has between the two buttons.
    between_peaks_s: float


def figures(ex: CoilExhibit) -> CoilFigures:
    at, k_max = peak_coupling(ex)
    r = ex.coil.resistance_ohm
    t = ex.track
    speed = speed_for_top(t)
    current = ex.supply_v / r
    return CoilFigures(
        moment_a_m2=ex.magnet.moment_a_m2,
        inductance_h=ex.coil.inductance_h,
        time_constant_s=ex.coil.inductance_h / r,
        full_current_a=current,
        peak_flux_wb=flux_linkage(ex, 0.0),
        peak_coupling_v_s_per_m=k_max,
        peak_coupling_at_m=at,
        top_speed_m_s=ex.supply_v / k_max,
        ideal_gain_per_pass_j=2 * current * flux_linkage(ex, 0.0),
        top_height_m=t.top_height_m,
        speed_for_top_m_s=speed,
        coasting_current_a=k_max * speed / r,
        between_peaks_s=2 * abs(at) / speed,
    )


@dataclass(frozen=True)
class CoilCurve:
    """Ψ and ``k`` along the track, through the coil and well past it."""

    x_m: tuple[float, ...]
    flux_wb: tuple[float, ...]
    coupling_v_s_per_m: tuple[float, ...]


#: Points on :class:`CoilCurve`: odd, so the centre is one of them.
CURVE_POINTS = 241


def curve(ex: CoilExhibit) -> CoilCurve:
    """From one side to the other, the coil's half length and two diameters
    past each end — where ``k`` has fallen to a few per cent of its peak."""
    span = ex.coil.length_m / 2 + 2 * ex.coil.mean_diameter_m
    xs = tuple(-span + 2 * span * j / (CURVE_POINTS - 1) for j in range(CURVE_POINTS))
    return CoilCurve(
        x_m=xs,
        flux_wb=tuple(flux_linkage(ex, xx) for xx in xs),
        coupling_v_s_per_m=tuple(coupling(ex, xx) for xx in xs),
    )


@dataclass(frozen=True)
class CoilAnalysis:
    figures: CoilFigures
    curve: CoilCurve


def analysis(ex: CoilExhibit) -> CoilAnalysis:
    return CoilAnalysis(figures=figures(ex), curve=curve(ex))


# ── the visitor ──────────────────────────────────────────────────────────────


@dataclass(frozen=True)
class PressRule:
    """A visitor who knows the rule: plus while the car comes in, minus while it
    goes out, each within ``window_m`` of the centre, and nothing for a car
    standing still (:data:`STANDING_M_S`). ``late_s`` is how long
    after the car passes the centre the hand gets to the minus button (until
    then it is still on plus); a negative value switches early, when the car is
    still that long from the centre. ``reversed`` swaps the buttons."""

    window_m: float = 0.06
    late_s: float = 0.0
    reversed: bool = False


@dataclass(frozen=True)
class Scripted:
    """Presses at fixed times: ``(from_s, to_s, press)`` — a recorded visitor."""

    presses: tuple[tuple[float, float, Press], ...] = ()


Visitor = PressRule | Scripted | None


def _press(visitor: Visitor, t: float, x: float, v: float, crossed_at: float | None) -> Press:
    if visitor is None:
        return Press.NONE
    if isinstance(visitor, Scripted):
        for start, end, press in visitor.presses:
            if start <= t < end:
                return press
        return Press.NONE
    if abs(x) > visitor.window_m or abs(v) < STANDING_M_S:
        return Press.NONE
    coming_in = x * v < 0
    if coming_in:
        to_centre = abs(x) / abs(v) if v != 0 else math.inf
        press = Press.MINUS if visitor.late_s < 0 and to_centre < -visitor.late_s else Press.PLUS
    elif visitor.late_s > 0 and crossed_at is not None and t - crossed_at < visitor.late_s:
        press = Press.PLUS
    else:
        press = Press.MINUS
    return Press(-press) if visitor.reversed else press


# ── the run ──────────────────────────────────────────────────────────────────


def slope(ex: CoilExhibit, x: float) -> float:
    """dh/dx along the track, ``sin α``: zero on the flat, ``sin(s/R)`` a
    distance ``s`` up a ramp's arc; signed with ``x``."""
    t = ex.track
    s = abs(x) - t.flat_length_m / 2  # along the arc, from the flat's end
    if s <= 0:
        return 0.0
    return math.copysign(math.sin(s / t.ramp_radius_m), x)


def curvature(ex: CoilExhibit, x: float) -> float:
    """``1/R`` on a ramp, zero on the flat: how sharply the track turns the car
    upwards, which presses it on the track by ``v²/R`` more."""
    t = ex.track
    return 1 / t.ramp_radius_m if abs(x) > t.flat_length_m / 2 else 0.0


def height(ex: CoilExhibit, x: float) -> float:
    """The track's height: ``R·(1 − cos(s/R))`` a distance ``s`` up an arc."""
    t = ex.track
    s = abs(x) - t.flat_length_m / 2
    if s <= 0:
        return 0.0
    return t.ramp_radius_m * (1 - math.cos(s / t.ramp_radius_m))


def speed_for_top(t: Track) -> float:
    """The speed at a ramp's foot that just reaches its top, rolling resistance
    included. Along the arc ``v²`` obeys a linear equation,
    ``d(v²)/ds = −2g·(sin θ + c·cos θ) − (2c/R)·v²`` with ``θ = s/R``, whose
    integrating factor is ``e^{2cs/R}``; asking for ``v = 0`` at the top gives
    ``v₀² = 2g·∫₀^L e^{as}(sin bs + c·cos bs) ds`` (``a = 2c/R``, ``b = 1/R``),
    which is closed. Without resistance it is ``2g·h``, as it should be."""
    c, big_r, big_l = t.rolling_resistance, t.ramp_radius_m, t.ramp_length_m
    a, b = 2 * c / big_r, 1 / big_r
    e = math.exp(a * big_l)
    sb, cb = math.sin(b * big_l), math.cos(b * big_l)
    i_sin = (e * (a * sb - b * cb) + b) / (a * a + b * b)
    i_cos = (e * (a * cb + b * sb) - a) / (a * a + b * b)
    return math.sqrt(2 * G * (i_sin + c * i_cos))


def derivatives(ex: CoilExhibit, y: tuple[float, ...], u: float, open_circuit: bool) -> tuple[float, ...]:
    """``(x, v, i, battery, heat, rolling)`` → their rates. The last three are
    the energy accounts, integrated with the motion so they close with it."""
    x, v, i = y[0], y[1], y[2]
    t = ex.track
    k = coupling(ex, x)
    r = ex.coil.resistance_ohm
    grade = slope(ex, x)
    cos_a = math.sqrt(1 - grade * grade)
    # The track's push per kilogram: gravity's share across it, and on an arc
    # the v²/R that turns the car upwards.
    normal = G * cos_a + v * v * curvature(ex, x)
    resist = t.rolling_resistance * t.car_mass_kg * normal * v / math.sqrt(v * v + RESISTANCE_FADE_M_S**2)
    dv = (k * i - t.car_mass_kg * G * grade - resist) / t.car_mass_kg
    di = 0.0 if open_circuit else (u - r * i - k * v) / ex.coil.inductance_h
    return (v, dv, di, u * i, r * i * i, resist * v)


@dataclass(frozen=True)
class EnergyAccount:
    battery_j: float
    heat_j: float
    rolling_j: float
    #: Lost when a button is let go with the coil open: the field's energy
    #: goes into the spark at the contact.
    switching_j: float
    #: Lost when the car hits the end stop at a ramp's top.
    end_stops_j: float
    #: Kinetic and potential, end minus start.
    mechanical_change_j: float
    #: ``½·L·i²``, end minus start.
    field_change_j: float
    #: The battery's energy less everything above: the integration's own error,
    #: a part in a million at the engine's step, shown so the page can say so.
    unaccounted_j: float


@dataclass(frozen=True)
class CoilRun:
    t: tuple[float, ...]
    x_m: tuple[float, ...]
    speed_m_s: tuple[float, ...]
    current_a: tuple[float, ...]
    induced_v: tuple[float, ...]
    press: tuple[int, ...]
    height_m: tuple[float, ...]
    #: The height of each turn-around on a ramp, in order.
    peaks_m: tuple[float, ...]
    #: How many times the car reached a ramp's top.
    tops: int
    energy: EnergyAccount


def _mechanical(ex: CoilExhibit, x: float, v: float) -> float:
    return 0.5 * ex.track.car_mass_kg * v * v + ex.track.car_mass_kg * G * height(ex, x)


def run(
    ex: CoilExhibit,
    visitor: Visitor,
    duration_s: float = 10.0,
    start_x_m: float | None = None,
    start_speed_m_s: float = 0.0,
    step_s: float = STEP_S,
) -> CoilRun:
    """The car from ``start_x_m`` (default: halfway up the left ramp, at rest)."""
    if not 0 < duration_s <= MAX_DURATION_S:
        raise ValueError(f"a run lasts between 0 and {MAX_DURATION_S:g} s")
    if not 0 < step_s <= 1e-3:
        raise ValueError("the step lies between 0 and 1 ms")
    t = ex.track
    x0 = start_x_m if start_x_m is not None else -(t.flat_length_m / 2 + t.ramp_length_m / 2)
    if abs(x0) > t.end_m:
        raise ValueError("the car has to start on the track")
    y: tuple[float, ...] = (x0, start_speed_m_s, 0.0, 0.0, 0.0, 0.0)
    mech0 = _mechanical(ex, x0, start_speed_m_s)
    switching = stops = 0.0
    steps = round(duration_s / step_s)
    every = max(1, round(1 / (SAMPLES_PER_S * step_s)))
    out: dict[str, list[float]] = {k: [] for k in ("t", "x", "v", "i", "e", "p", "h")}
    peaks: list[float] = []
    tops = 0
    crossed_at: float | None = None
    big_l = ex.coil.inductance_h
    for n in range(steps + 1):
        now = n * step_s
        x, v, i = y[0], y[1], y[2]
        press = _press(visitor, now, x, v, crossed_at)
        open_circuit = ex.idle is Idle.OPEN and press is Press.NONE
        if open_circuit and i != 0.0:
            switching += 0.5 * big_l * i * i
            y = (x, v, 0.0, *y[3:])
        if n % every == 0:
            out["t"].append(now)
            out["x"].append(x)
            out["v"].append(v)
            out["i"].append(y[2])
            out["e"].append(coupling(ex, x) * v)
            out["p"].append(int(press))
            out["h"].append(height(ex, x))
        if n == steps:
            break
        u = ex.supply_v * int(press)
        k1 = derivatives(ex, y, u, open_circuit)
        k2 = derivatives(ex, tuple(y[j] + step_s / 2 * k1[j] for j in range(6)), u, open_circuit)
        k3 = derivatives(ex, tuple(y[j] + step_s / 2 * k2[j] for j in range(6)), u, open_circuit)
        k4 = derivatives(ex, tuple(y[j] + step_s * k3[j] for j in range(6)), u, open_circuit)
        nxt = tuple(y[j] + step_s / 6 * (k1[j] + 2 * k2[j] + 2 * k3[j] + k4[j]) for j in range(6))
        if (x < 0) != (nxt[0] < 0):
            crossed_at = now + step_s
        # A turn-around on a ramp: the speed changes sign away from the flat.
        if v * nxt[1] < 0 and abs(nxt[0]) > t.flat_length_m / 2:
            peaks.append(height(ex, nxt[0]))
        if abs(nxt[0]) >= t.end_m:
            # The end stop: the car stops dead at the top and rolls back. What
            # it loses is its speed and the height of the step's overshoot.
            top = math.copysign(t.end_m, nxt[0])
            stops += _mechanical(ex, nxt[0], nxt[1]) - _mechanical(ex, top, 0.0)
            nxt = (top, 0.0, *nxt[2:])
            tops += 1
            peaks.append(t.top_height_m)
        y = nxt
    x, v, i = y[0], y[1], y[2]
    mechanical = _mechanical(ex, x, v) - mech0
    field = 0.5 * big_l * i * i
    account = EnergyAccount(
        battery_j=y[3],
        heat_j=y[4],
        rolling_j=y[5],
        switching_j=switching,
        end_stops_j=stops,
        mechanical_change_j=mechanical,
        field_change_j=field,
        unaccounted_j=y[3] - (y[4] + y[5] + switching + stops) - mechanical - field,
    )
    return CoilRun(
        t=tuple(out["t"]),
        x_m=tuple(out["x"]),
        speed_m_s=tuple(out["v"]),
        current_a=tuple(out["i"]),
        induced_v=tuple(out["e"]),
        press=tuple(int(p) for p in out["p"]),
        height_m=tuple(out["h"]),
        peaks_m=tuple(peaks),
        tops=tops,
        energy=account,
    )


@dataclass(frozen=True)
class TimingPoint:
    late_s: float
    gain_j: float


def timing_curve(
    ex: CoilExhibit, speed_m_s: float, lates_s: tuple[float, ...], window_m: float = 0.06
) -> tuple[TimingPoint, ...]:
    """The energy one pass through the coil gains, at ``speed_m_s``, against
    how late the hand reaches the minus button. Run on the flat without rolling
    resistance, so the number is the coil's alone."""
    if speed_m_s <= 0:
        raise ValueError("the car has to be moving")
    flat = CoilExhibit(
        magnet=ex.magnet,
        coil=ex.coil,
        track=Track(
            car_mass_kg=ex.track.car_mass_kg,
            flat_length_m=ex.track.flat_length_m,
            ramp_length_m=ex.track.ramp_length_m,
            ramp_radius_m=ex.track.ramp_radius_m,
            rolling_resistance=0.0,
        ),
        supply_v=ex.supply_v,
        idle=ex.idle,
    )
    start = -(window_m + 0.01)
    distance = 2 * (window_m + 0.01)
    duration = min(MAX_DURATION_S, 2.5 * distance / speed_m_s)
    points = []
    for late in lates_s:
        result = run(flat, PressRule(window_m=window_m, late_s=late), duration, start, speed_m_s)
        # The pass ends where the car leaves the window on the far side (or
        # turns back inside it); read the kinetic energy there.
        kinetic = 0.5 * flat.track.car_mass_kg * speed_m_s**2
        end = next(
            (j for j, x in enumerate(result.x_m) if x > window_m + 0.01 or result.speed_m_s[j] <= 0),
            len(result.x_m) - 1,
        )
        points.append(TimingPoint(late, 0.5 * flat.track.car_mass_kg * result.speed_m_s[end] ** 2 - kinetic))
    return tuple(points)
