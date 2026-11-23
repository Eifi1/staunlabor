"""The standing string: a cord on a vibrator stands still in one, two, three … loops.

The exhibit is a thin elastic cord whose one end a vibrator shakes a
millimetre or two up and down, a hundred times a second; the visitor leads the
other end over a peg and pulls it down by hand. Held slack, the cord only
blurs; pulled slowly tighter, at certain pulls it swings wide and stands in
one, two, three loops with quiet nodes between them, and between those it
falls back. The harder the pull, the fewer the loops. On the page the
vibrator's tone can be turned too.

**The model.** The cord's sideways place ``y(x, t)`` obeys the damped wave
equation ``μ·∂²y/∂t² + μ·γ·∂y/∂t = T·∂²y/∂x²`` (the wave equation of String
vibration with a damping term), ``T`` the hand's pull, ``μ`` the cord's mass per metre, ``γ`` its
damping (the air's and the cord's own, as one rate), between the vibrator,
``y(0, t) = A·sin θ`` with ``θ̇ = Ω``, and the peg, ``y(L, t) = 0``. Waves
run along it at ``v = √(T/μ)``. Its modes, ``sin(nπx/L)``, ring at
``fₙ = n/(2L)·√(T/μ)``: the eigenvalues of ``−v²·∂²/∂x²`` with both ends held
are ``(nπv/L)²``.

**Steadily driven** at ``Ω`` the cord swings as
``y = Im[A·sin(k(L − x))/sin(kL)·e^{iθ}]`` with the complex wavenumber
``k = (Ω/v)·√(1 − iγ/Ω)``: the transfer function of the driven string at
``s = iΩ``, its poles the modes. Where ``kL`` is near ``nπ`` — a whole number
of half-waves between the ends — ``sin(kL)`` is nearly nought and the cord
swings about ``2vA/(γL)`` at its antinodes, at a given pull the same for
every loop count; between, hardly more than the vibrator's stroke. At a given
tone ``f``, the pull for ``n`` loops is ``T = μ·(2Lf/n)²``.

**In time** (:func:`step`) the cord is the vibrator's line plus the modes:
``y = A·sin θ·(1 − x/L) + Σ qₙ·sin(nπx/L)``, the first :data:`MODES` kept;
each ``qₙ`` is a damped oscillator,
``q̈ₙ + γ·q̇ₙ + ωₙ²·qₙ = (2A/(nπ))·(Ω²·sin θ − γΩ·cos θ)``, solved exactly over
each step with the drive held through it (its steady swing plus its free,
decaying one), so a step may be as long as a frame and the stepping adds no
error of its own. The modes left out answer the drive almost at once and
weakly, as ``(Ω/ωₙ)²/n``: on the page's cord at its hundred hertz they are
10⁻⁴ of the widest swing at three loops, under 10⁻³ at six or between two
loop counts, a few micrometres.

**What the page draws.** A cord swinging a hundred times a second cannot be drawn
at sixty frames: the drawing shows what the eye sees, the blur between the
cord's two extremes (:func:`swing_m`, ``√(y² + (ẏ/Ω)²)``, which a steady swing
keeps exactly), and in it the cord as a strobe lamp a little off the tone
would show it, slowed down (:func:`strobe_m`).

**What it leaves out.** The cord's stretch (an elastic cord pulled harder gets
longer and thinner, which here keeps ``L`` and ``μ``: the length is the part
between the vibrator and the peg); the cord's stiffness;
swings so wide that the tension changes along them; the vibrator's own give;
the cord's swing out of the plane. Melde's own experiment drove the cord
along its length, which makes it swing at half the fork's tone; here the
vibrator shakes it across.
"""

from __future__ import annotations

import cmath
import math
from collections.abc import Callable
from dataclasses import dataclass, replace

#: The modes the time loop keeps: the drive reaches the sixteenth tone at most
#: on the page's sliders; the rest answer it almost statically.
MODES = 40

#: The museum's vibrator: a hundred times a second, where the page starts.
VIBRATOR_HZ = 100.0

#: The highest drive asked for, Hz.
MAX_DRIVE_HZ = 200.0

#: The longest step, s: a frame, held to the page's longest (`play.ts`).
MAX_STEP_S = 0.05

#: Steps of the golden-section searches below, each shrinking the bracket to
#: 0.618 of itself: 80 take it far below a float's last digit.
_SEARCH_STEPS = 80

_GOLDEN = (math.sqrt(5) - 1) / 2


@dataclass(frozen=True)
class Cord:
    #: L: from the vibrator to the peg.
    length_m: float = 1.0
    #: T: the hand's pull, where the page starts: between two and three loops
    #: at the vibrator's hundred hertz.
    tension_n: float = 3.0
    #: μ: a thin elastic cord, half a gram a metre.
    density_kg_m: float = 0.0005
    #: γ: the damping, the air's and the cord's own, as one rate.
    damping_per_s: float = 12.0
    #: A: the vibrator's stroke, each way.
    drive_m: float = 0.002

    def __post_init__(self) -> None:
        if not 0.2 <= self.length_m <= 5:
            raise ValueError("a cord runs 20 cm to 5 m from the vibrator to the peg")
        if not 0.05 <= self.tension_n <= 100:
            raise ValueError("the cord is pulled with 0.05 to 100 N")
        if not 0.0002 <= self.density_kg_m <= 0.1:
            raise ValueError("a cord weighs 0.2 to 100 g a metre")
        if not 0.01 <= self.damping_per_s <= 20:
            raise ValueError("the damping lies between 0.01 and 20 per second")
        if not 0 < self.drive_m <= 0.01:
            raise ValueError("the vibrator moves more than nothing and at most 1 cm each way")
        if self.damping_per_s / 2 >= 2 * math.pi * mode_hz(self, 1):
            raise ValueError("so much damping that the cord no longer swings")


def wave_speed_m_s(cord: Cord) -> float:
    """``v = √(T/μ)``: how fast a wave runs along the cord."""
    return math.sqrt(cord.tension_n / cord.density_kg_m)


def mode_hz(cord: Cord, n: int) -> float:
    """``fₙ = n/(2L)·√(T/μ)``: the ``n``-th tone, ``n`` loops between the ends."""
    if n < 1:
        raise ValueError("a mode has at least one loop")
    return n * wave_speed_m_s(cord) / (2 * cord.length_m)


def half_waves(cord: Cord, drive_hz: float) -> float:
    """``2Lf/v``: how many half-waves of the drive's tone fit between the ends."""
    return 2 * cord.length_m * drive_hz / wave_speed_m_s(cord)


def _check_drive(drive_hz: float) -> None:
    if not 0 < drive_hz <= MAX_DRIVE_HZ:
        raise ValueError(f"the vibrator runs at more than 0 and at most {MAX_DRIVE_HZ:g} Hz")


def wavenumber(cord: Cord, drive_hz: float) -> complex:
    """``k = (Ω/v)·√(1 − iγ/Ω)``: the drive's wave on the damped cord, its real
    part the turning, its imaginary part (negative) the fading along it."""
    _check_drive(drive_hz)
    big = 2 * math.pi * drive_hz
    return big / wave_speed_m_s(cord) * cmath.sqrt(1 - 1j * cord.damping_per_s / big)


def steady(cord: Cord, drive_hz: float, x_m: float) -> complex:
    """``Y(x) = A·sin(k(L − x))/sin(kL)``: the steady swing at ``x_m``, the cord
    there ``Im[Y·e^{iθ}]`` while the vibrator is ``A·sin θ``."""
    k = wavenumber(cord, drive_hz)
    return cord.drive_m * cmath.sin(k * (cord.length_m - x_m)) / cmath.sin(k * cord.length_m)


def _golden(f: Callable[[float], float], lo: float, hi: float) -> float:
    """Where ``f`` is largest in ``[lo, hi]``, ``f`` rising then falling there
    (or only rising, or only falling): golden-section search."""
    a, b = lo, hi
    c, d = b - _GOLDEN * (b - a), a + _GOLDEN * (b - a)
    fc, fd = f(c), f(d)
    for _ in range(_SEARCH_STEPS):
        if fc >= fd:
            b, d, fd = d, c, fc
            c = b - _GOLDEN * (b - a)
            fc = f(c)
        else:
            a, c, fc = c, d, fd
            d = a + _GOLDEN * (b - a)
            fd = f(d)
    return (a + b) / 2


def widest_m(cord: Cord, drive_hz: float) -> float:
    """The steady swing at the cord's widest point, each way.

    ``|sin(k·s)|² = sin²(a·s) + sinh²(b·s)`` with ``k = a − ib`` and ``s = L − x``,
    the distance from the peg: its peaks grow with ``s``, so the widest
    point is the last peak before the vibrator, searched between the troughs
    either side of it, or the vibrator's end itself, whichever swings wider."""
    k = wavenumber(cord, drive_hz)
    a, length = k.real, cord.length_m
    # The last peak, near s = (m + ½)·π/a, between the troughs m·π/a and (m + 1)·π/a.
    last = max(0, math.floor(a * length / math.pi - 0.5))
    s = _golden(lambda s: abs(cmath.sin(k * s)), last * math.pi / a, min(length, (last + 1) * math.pi / a))
    end = abs(cmath.sin(k * length))
    return cord.drive_m * max(abs(cmath.sin(k * s)), end) / end


def resonance_hz(cord: Cord, n: int) -> float:
    """Where the widest swing peaks near the ``n``-th tone: searched between
    the half-tones either side, ``(n ± ½)·f₁``. A little below ``fₙ``, by the
    damping: by about ``γ²/(8Ω²)`` of it."""
    f1 = mode_hz(cord, 1)
    return _golden(lambda f: widest_m(cord, f), (n - 0.5) * f1, min((n + 0.5) * f1, MAX_DRIVE_HZ))


#: The most a pull may be, N: the engine's bound.
MAX_PULL_N = 100.0


def pull_n(cord: Cord, drive_hz: float, n: float) -> float:
    """``T = μ·(2Lf/n)²``: the pull for ``n`` half-waves at ``drive_hz``."""
    return cord.density_kg_m * (2 * cord.length_m * drive_hz / n) ** 2


def resonance_pull_n(cord: Cord, drive_hz: float, n: float) -> float:
    """Where the widest swing peaks as the hand pulls, at ``drive_hz``, near
    the pull for ``n`` loops: searched between the pulls for ``n ± ½``
    half-waves, as the visitor finds it."""
    if n < 1:
        raise ValueError("a mode has at least one loop")

    def widest(t: float) -> float:
        return widest_m(replace(cord, tension_n=t), drive_hz)

    return _golden(widest, pull_n(cord, drive_hz, n + 0.5), min(pull_n(cord, drive_hz, n - 0.5), MAX_PULL_N))


def loops(cord: Cord, drive_hz: float, points: int = 400) -> int:
    """The loops the steady cord stands in: the swing's peaks along it, the
    vibrator's end not counted, read at ``points`` + 1 places."""
    swing = [abs(steady(cord, drive_hz, cord.length_m * i / points)) for i in range(points + 1)]
    return sum(1 for i in range(1, points) if swing[i - 1] < swing[i] >= swing[i + 1])


def node_spacing_m(cord: Cord, drive_hz: float) -> float:
    """How far apart the two nodes nearest the peg lie: the swing's least
    values, searched in the first two half-waves from the peg. Half a
    wavelength (Standing wave)."""
    k = wavenumber(cord, drive_hz)
    half = math.pi / k.real
    if 2.5 * half > cord.length_m:
        raise ValueError("fewer than two whole half-waves fit on the cord at this tone")

    def quiet(x: float) -> float:
        return -abs(steady(cord, drive_hz, x))

    near = _golden(quiet, cord.length_m - 1.5 * half, cord.length_m - 0.5 * half)
    far = _golden(quiet, cord.length_m - 2.5 * half, cord.length_m - 1.5 * half)
    return near - far


# ── the time loop ──────────────────────────────────────────────────────────


@dataclass(frozen=True)
class Shaking:
    t: float
    #: θ: the vibrator's phase, its place ``A·sin θ``.
    theta: float
    #: Each mode's amplitude and its rate, m and m/s, the first first.
    q: tuple[float, ...]
    v: tuple[float, ...]


def start() -> Shaking:
    """The cord at rest, straight, the vibrator in the middle of its stroke."""
    return Shaking(t=0.0, theta=0.0, q=(0.0,) * MODES, v=(0.0,) * MODES)


def _forced(cord: Cord, n: int, big: float) -> complex:
    """``Qₙ``: mode ``n``'s steady answer to the drive, ``qₙ = Im[Qₙ·e^{iθ}]``."""
    omega = math.pi * n * wave_speed_m_s(cord) / cord.length_m
    g = cord.damping_per_s
    push = 2 * cord.drive_m / (n * math.pi) * (big * big - 1j * g * big)
    return push / (omega * omega - big * big + 1j * g * big)


def step(cord: Cord, s: Shaking, drive_hz: float, dt: float) -> Shaking:
    """``dt`` on, the vibrator held at ``drive_hz``: each mode's steady swing
    carried on in phase, and its free swing, what is left, decaying as
    ``e^{−γt/2}`` at its own damped tone, both exactly."""
    _check_drive(drive_hz)
    if not 0 <= dt <= MAX_STEP_S:
        raise ValueError(f"a step lasts 0 to {MAX_STEP_S:g} s")
    big = 2 * math.pi * drive_hz
    theta = s.theta + big * dt
    now, then = cmath.exp(1j * s.theta), cmath.exp(1j * theta)
    alpha = cord.damping_per_s / 2
    fade = math.exp(-alpha * dt)
    q: list[float] = []
    v: list[float] = []
    for i in range(MODES):
        n = i + 1
        omega = math.pi * n * wave_speed_m_s(cord) / cord.length_m
        damped = math.sqrt(omega * omega - alpha * alpha)
        forced = _forced(cord, n, big)
        h0 = s.q[i] - (forced * now).imag
        r0 = s.v[i] - (1j * big * forced * now).imag
        c, sn = math.cos(damped * dt), math.sin(damped * dt)
        tilt = (r0 + alpha * h0) / damped
        q.append((forced * then).imag + fade * (h0 * c + tilt * sn))
        v.append((1j * big * forced * then).imag + fade * (r0 * c - (damped * h0 + alpha * tilt) * sn))
    return Shaking(t=s.t + dt, theta=theta, q=tuple(q), v=tuple(v))


def place_m(cord: Cord, s: Shaking, x_m: float) -> float:
    """The cord's place at ``x_m`` now: the vibrator's line plus the modes."""
    line = cord.drive_m * math.sin(s.theta) * (1 - x_m / cord.length_m)
    return line + sum(q * math.sin((i + 1) * math.pi * x_m / cord.length_m) for i, q in enumerate(s.q))


def rate_m_s(cord: Cord, s: Shaking, drive_hz: float, x_m: float) -> float:
    """How fast the cord moves at ``x_m`` now."""
    big = 2 * math.pi * drive_hz
    line = cord.drive_m * big * math.cos(s.theta) * (1 - x_m / cord.length_m)
    return line + sum(v * math.sin((i + 1) * math.pi * x_m / cord.length_m) for i, v in enumerate(s.v))


def swing_m(cord: Cord, s: Shaking, drive_hz: float, x_m: float) -> float:
    """How wide the cord swings at ``x_m`` now, each way: its place and its
    speed taken together at the drive's tone, ``√(y² + (ẏ/Ω)²)``, the blur's
    half-width, which a steady swing keeps exactly."""
    big = 2 * math.pi * drive_hz
    return math.hypot(place_m(cord, s, x_m), rate_m_s(cord, s, drive_hz, x_m) / big)


def strobe_m(cord: Cord, s: Shaking, drive_hz: float, x_m: float, phase: float) -> float:
    """The cord at ``x_m`` as it stands ``phase`` of a turn of the drive later,
    were it swinging steadily: ``y·cos φ + (ẏ/Ω)·sin φ``. A strobe lamp a
    little off the tone shows this with ``φ`` slowly turning."""
    big = 2 * math.pi * drive_hz
    y = place_m(cord, s, x_m)
    return y * math.cos(phase) + rate_m_s(cord, s, drive_hz, x_m) / big * math.sin(phase)


@dataclass(frozen=True)
class StringFigures:
    #: At the cord's own pull.
    wave_speed_m_s: float
    #: f₁ … f₆ at that pull, Hz.
    tones_hz: tuple[float, ...]
    #: At ``drive_hz``, the pulls for one to six loops, N, by ``T = μ·(2Lf/n)²``.
    pulls_n: tuple[float, ...]
    #: Where the widest swing peaks as the hand pulls, near one to six loops, N,
    #: and how wide it swings there, m.
    peak_pulls_n: tuple[float, ...]
    peak_widths_m: tuple[float, ...]
    #: The widest swing at the pull for two and a half half-waves, m.
    between_m: float
    #: ``2vA/(γL)`` at the three loops' pull: their peak in the weak-damping limit, m.
    three_limit_m: float


#: The tones and the pulls the figures name.
TONES = 6


def figures(cord: Cord, drive_hz: float = VIBRATOR_HZ) -> StringFigures:
    """The page's numbers for ``cord`` shaken at ``drive_hz``."""
    peaks = tuple(resonance_pull_n(cord, drive_hz, n) for n in range(1, TONES + 1))
    return StringFigures(
        wave_speed_m_s=wave_speed_m_s(cord),
        tones_hz=tuple(mode_hz(cord, n) for n in range(1, TONES + 1)),
        pulls_n=tuple(pull_n(cord, drive_hz, n) for n in range(1, TONES + 1)),
        peak_pulls_n=peaks,
        peak_widths_m=tuple(widest_m(replace(cord, tension_n=t), drive_hz) for t in peaks),
        between_m=widest_m(replace(cord, tension_n=pull_n(cord, drive_hz, 2.5)), drive_hz),
        three_limit_m=2
        * math.sqrt(pull_n(cord, drive_hz, 3) / cord.density_kg_m)
        * cord.drive_m
        / (cord.damping_per_s * cord.length_m),
    )
