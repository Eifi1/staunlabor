"""The harmonograph, checked: its pendulums' time loop, at the page's step,
against the exact pendulum's period, the figure closing at an exact ratio, the
figure turning off it when the swings differ, and the swing's fade.
"""

from __future__ import annotations

import math

from staunlabor.domain.checks import Case, Source
from staunlabor.domain.experiments import harmonograph as engine
from staunlabor.domain.experiments import pendulum as block

ENGINE = ("harmonograph",)

G = 9.80665

_PERIOD = Source(
    cite="NIST Digital Library of Mathematical Functions, §22.19(i), Eqs. 22.19.1–22.19.2",
    url="https://dlmf.nist.gov/22.19",
    quote="With appropriate scalings, Newton’s equation of motion for a pendulum … is d²θ(t)/dt² = −sin θ(t), … for "
    "an initial angular displacement α, with dθ/dt = 0 at time 0 … The period is 4K(sin(½α)).",
)
_K = Source(
    cite="NIST Digital Library of Mathematical Functions, §19.2(ii), Eqs. 19.2.4 and 19.2.8",
    url="https://dlmf.nist.gov/19.2",
    quote="F(ϕ, k) = ∫₀^ϕ dθ/√(1 − k² sin²θ) … The cases with ϕ = π/2 are the complete integrals: K(k) = F(π/2, k)",
)
_SCALE = Source(
    cite="OpenStax, University Physics Volume 1, §15.4 Pendulums, Eqs. 15.17–15.19",
    url="https://openstax.org/books/university-physics-volume-1/pages/15-4-pendulums",
    quote="d²θ/dt² = −(g/L)θ. (15.17) … The angular frequency is ω = √(g/L) (15.18) and the period is "
    "T = 2π√(L/g). (15.19)",
)
_CLOSES = Source(
    cite="Wikipedia, “Lissajous curve”, introduction",
    url="https://en.wikipedia.org/wiki/Lissajous_curve",
    quote="A small change to one of the frequencies will mean the x oscillation after one cycle will be slightly out "
    "of synchronization with the y motion and so the ellipse will fail to close and trace a curve slightly adjacent "
    "during the next orbit showing as a precession of the ellipse. The pattern closes if the frequencies are whole "
    "number ratios i.e. a/b is rational.",
)
_DECAY = Source(
    cite="Wikipedia, “Harmonic oscillator”, §Damped harmonic oscillator",
    url="https://en.wikipedia.org/wiki/Harmonic_oscillator",
    quote="d²x/dt² + 2ζω₀ dx/dt + ω₀²x = 0, … Underdamped (ζ < 1): … the exponential decay of the underdamped "
    "harmonic oscillator is given by λ = ω₀ζ.",
)

_PEN_M = 0.8
#: Undamped, so the beats stay as they were let go.
_STILL = 0.0


def _pendulum(
    length_m: float, amplitude_deg: float, phase_deg: float = 0.0, damping: float = _STILL
) -> engine.HarmonographPendulum:
    return engine.HarmonographPendulum(
        length_m=length_m, amplitude_deg=amplitude_deg, phase_deg=phase_deg, damping_per_s=damping
    )


def _k_by_sum(modulus: float, n: int = 20000) -> float:
    """K(k) = ∫₀^{π/2} dφ/√(1 − k² sin²φ) by the midpoint rule: our own sum,
    not the engine's arithmetic-geometric mean."""
    h = math.pi / 2 / n
    return h * sum(1 / math.sqrt(1 - (modulus * math.sin((j + 0.5) * h)) ** 2) for j in range(n))


def _period_hand_s(length_m: float, amplitude_deg: float) -> float:
    """4K(sin(α/2)) in the source's time, whose unit is 1/ω₀ = √(L/g)."""
    return 4 * math.sqrt(length_m / G) * _k_by_sum(math.sin(math.radians(amplitude_deg) / 2))


def _ups(p: engine.HarmonographPendulum, seconds: float) -> list[float]:
    """The pendulum let go as the page lets it go and stepped as the page
    steps it: when it passes the bottom going up, interpolated between steps."""
    f = block.swing_rhs(p.length_m, p.damping_per_s)
    y, t, out = engine.start(p), 0.0, []
    for _ in range(round(seconds / block.STEP_S)):
        nxt = block.rk4(f, t, y, block.STEP_S)
        if y[0] < 0 <= nxt[0]:
            out.append(t + block.STEP_S * -y[0] / (nxt[0] - y[0]))
        y, t = nxt, t + block.STEP_S
    return out


def _period_run_s(p: engine.HarmonographPendulum, seconds: float = 30.0) -> float:
    ups = _ups(p, seconds)
    return (ups[-1] - ups[0]) / (len(ups) - 1)


#: An exact 2:3, both let go at 12°: the board's length (2/3)² of the pen's.
_TWO_THREE = engine.Harmonograph(
    pen=_pendulum(_PEN_M, 12.0), board=_pendulum(_PEN_M * (2 / 3) ** 2, 12.0, phase_deg=90.0)
)


def _state_at(p: engine.HarmonographPendulum, t_s: float) -> tuple[float, ...]:
    """The page's steps up to ``t_s``, the last one cut to land on it."""
    f = block.swing_rhs(p.length_m, p.damping_per_s)
    y, t = engine.start(p), 0.0
    for _ in range(int(t_s / block.STEP_S)):
        y = block.rk4(f, t, y, block.STEP_S)
        t += block.STEP_S
    return block.rk4(f, t, y, t_s - t)


def _closure_run_m(h: engine.Harmonograph) -> float:
    """How far the pen is, after two of its swings, from where it started on the board."""
    back = 2 * _period_hand_s(h.pen.length_m, h.pen.amplitude_deg)
    a0, b0 = engine.start(h.pen), engine.start(h.board)
    a1, b1 = _state_at(h.pen, back), _state_at(h.board, back)
    dx = h.pen.length_m * (math.sin(a1[0]) - math.sin(a0[0]))
    dy = h.board.length_m * (math.sin(b1[0]) - math.sin(b0[0]))
    return math.hypot(dx, dy)


#: The page's pair, 2:3 detuned by 2/3 %, but the pen let go at 30° and the board at 5°.
_DRIFTING = engine.Harmonograph(
    pen=_pendulum(_PEN_M, 30.0), board=_pendulum(_PEN_M * (2 / 3.02) ** 2, 5.0, phase_deg=90.0)
)


def _turn_hand_s(h: engine.Harmonograph) -> float:
    """Once every 1/|3f₁ − 2f₂|, f the beats as let go, by the exact period."""
    f1 = 1 / _period_hand_s(h.pen.length_m, h.pen.amplitude_deg)
    f2 = 1 / _period_hand_s(h.board.length_m, h.board.amplitude_deg)
    return 1 / abs(3 * f1 - 2 * f2)


def _turn_run_s(h: engine.Harmonograph, seconds: float = 200.0) -> float:
    """The same, with each beat counted from the time loop over 200 s."""
    up1, up2 = _ups(h.pen, seconds), _ups(h.board, seconds)
    f1 = (len(up1) - 1) / (up1[-1] - up1[0])
    f2 = (len(up2) - 1) / (up2[-1] - up2[0])
    return 1 / abs(3 * f1 - 2 * f2)


#: A small swing, 2°, with the page's friction.
_FADING = _pendulum(_PEN_M, 2.0, damping=0.02)


def _fade_hand_s(p: engine.HarmonographPendulum) -> float:
    """c = 2ζω₀ in the source's terms, so the swing falls as e^(−ct/2): to a
    tenth after 2·ln 10/c."""
    return 2 * math.log(10) / p.damping_per_s


def _fade_run_s(p: engine.HarmonographPendulum) -> float:
    """The swing's turning points from the page's steps; where their size
    passes a tenth of the start, interpolated on its logarithm."""
    f = block.swing_rhs(p.length_m, p.damping_per_s)
    y, t = engine.start(p), 0.0
    tenth = math.radians(p.amplitude_deg) / 10
    last: tuple[float, float] | None = None
    while t < 2 * _fade_hand_s(p):
        nxt = block.rk4(f, t, y, block.STEP_S)
        if (y[1] > 0 >= nxt[1]) or (y[1] < 0 <= nxt[1]):
            share = y[1] / (y[1] - nxt[1])
            here = (t + block.STEP_S * share, abs(y[0] + (nxt[0] - y[0]) * share))
            if last is not None and last[1] >= tenth > here[1]:
                drop = (math.log(last[1]) - math.log(tenth)) / (math.log(last[1]) - math.log(here[1]))
                return last[0] + (here[0] - last[0]) * drop
            last = here
        y, t = nxt, t + block.STEP_S
    raise AssertionError("the swing never fell to a tenth")


def _setting(h: engine.Harmonograph) -> dict[str, float | str]:
    """What the page's "Set it up" sets: the build, as the engine's fields."""
    return {
        "pen_length_m": h.pen.length_m,
        "pen_amplitude_deg": h.pen.amplitude_deg,
        "board_length_m": h.board.length_m,
        "board_amplitude_deg": h.board.amplitude_deg,
        "board_phase_deg": h.board.phase_deg,
        "damping_per_s": h.pen.damping_per_s,
    }


CASES: tuple[Case, ...] = (
    Case(
        key="wide_slower",
        unit="s",
        expected=lambda: _period_hand_s(_PEN_M, 30.0),
        measured=lambda: _period_run_s(_pendulum(_PEN_M, 30.0)),
        # Runge–Kutta at 1 ms on a swing of 1.8 s: far below 10⁻⁹.
        tolerance=1e-9,
        sources=(_PERIOD, _K, _SCALE),
        derived=True,
        setting=_setting(_DRIFTING),
    ),
    Case(
        key="closes",
        unit="m",
        expected=lambda: 0.0,
        measured=lambda: _closure_run_m(_TWO_THREE),
        # Absolute, in metres: the steps' error, some 10⁻¹¹ m.
        tolerance=1e-9,
        sources=(_CLOSES, _PERIOD),
        derived=True,
        setting=_setting(_TWO_THREE),
    ),
    Case(
        key="turns",
        unit="s",
        expected=lambda: _turn_hand_s(_DRIFTING),
        measured=lambda: _turn_run_s(_DRIFTING),
        # The turn is the small difference of two beats, 150 times as sensitive;
        # the crossings' interpolation still leaves it below 10⁻⁹.
        tolerance=1e-8,
        sources=(_CLOSES, _PERIOD, _K),
        derived=True,
        setting=_setting(_DRIFTING),
    ),
    Case(
        key="fades",
        unit="s",
        expected=lambda: _fade_hand_s(_FADING),
        measured=lambda: _fade_run_s(_FADING),
        # At 2° the pendulum is not quite linear: while it swings wide it sheds
        # its energy a little faster than e^(−ct); 1.4·10⁻⁵ here.
        tolerance=5e-5,
        sources=(_DECAY,),
        derived=True,
        setting=_setting(engine.Harmonograph(pen=_FADING, board=_pendulum(_PEN_M * (2 / 3.02) ** 2, 2.0, 90.0, 0.02))),
    ),
)
