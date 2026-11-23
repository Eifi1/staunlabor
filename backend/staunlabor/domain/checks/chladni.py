"""The Chladni plate, checked: its driven tones against Iguchi's free square
plate as Leissa tabulates it, the sharpness of a tone against its damping, and
the swing at a higher tone against each mode answering on its own.

The modes themselves have no closed form for a free plate. What is checked is
the eigenvalue against a published table, and what the page makes of the
modes once it has them.
"""

from __future__ import annotations

import math

from staunlabor.domain.checks import Case, Source
from staunlabor.domain.checks._hand import bisect
from staunlabor.domain.experiments import chladni as engine

#: Poisson's ratio of Leissa's table, and the engine's.
NU = 0.3

_TABLE = Source(
    cite="A. W. Leissa, Vibration of Plates, NASA SP-160 (1969), Table 4.65, p. 104 (after Iguchi, ref. 4.113)",
    url="https://ntrs.nasa.gov/api/citations/19700009156/downloads/19700009156.pdf",
    quote="Frequency Parameters and Mode Shapes for a Completely Free Square Plate; ν=0.3 … ωa²√(ρ/D) … "
    "Modes symmetric about coordinate axes, symmetric about diagonals … 24.2702 … 63.6870 … 122.4449 … "
    "168.4888 … 299.9325",
)
_PLATE = Source(
    cite="A. W. Leissa, Vibration of Plates, NASA SP-160 (1969), Ch. 1, Eqs. (1.1) and (1.2), p. 1",
    url="https://ntrs.nasa.gov/api/citations/19700009156/downloads/19700009156.pdf",
    quote="D∇⁴w + ρ ∂²w/∂t² = 0 (1.1) where D is the flexural rigidity and is defined by D = Eh³/12(1−ν²) (1.2) "
    "E is Young's modulus, h is the plate thickness, ν is Poisson's ratio, ρ is mass density per unit area of "
    "the plate",
)
_Q_ZETA = Source(
    cite="Wikipedia, “Q factor”, §Physical interpretation",
    url="https://en.wikipedia.org/wiki/Q_factor",
    quote="Starting from the stored energy definition, it can be shown that Q = 1/(2ζ), where ζ is the damping ratio.",
)
_Q_WIDTH = Source(
    cite="Wikipedia, “Q factor”, §Physical interpretation",
    url="https://en.wikipedia.org/wiki/Q_factor",
    quote="The width (bandwidth) of the resonance is given by (approximately): Δf = f_N/Q, where f_N is the natural "
    "frequency, and Δf, the bandwidth, is the width of the range of frequencies for which the energy is at least "
    "half its peak value.",
)
_MODAL = Source(
    cite="MIT OpenCourseWare 2.003SC Engineering Dynamics (Fall 2011), Recitation 12 Notes: Modal Analysis, p. 4",
    url="https://ocw.mit.edu/courses/2-003sc-engineering-dynamics-fall-2011/"
    "650ea2d4579aa784f6e46044188560b0_MIT2_003SCF11_rec12note1.pdf",
    quote="θ = Uq = [u]⁽¹⁾q₁(t) + [u]⁽²⁾q₂(t) … |q₁| = |Q₁| (1/K₁)/[(1 − ω²/ω₁²)² + (2ζ₁ω/ω₁)²]^(1/2) … "
    "|q₁| = (Q₁/K₁)·1/(2ζ₁)",
)

#: The plate the page shows: 24 cm, 1 mm of steel.
_STEEL = engine.Plate()

#: Leissa's table, the modes symmetric about the axes and the diagonals: the
#: ones a shaker at the middle drives.
_LEISSA_LOWEST = 24.2702
_LEISSA_SECOND = 63.6870


def _driven() -> tuple[engine.Mode, ...]:
    """The modes the route sends the page."""
    return engine.driven_modes()


def _tone_hz(index: int) -> float:
    """A tone button of the page: the route's λ through the page's formula."""
    return engine.frequency_hz(_STEEL, _driven()[index].lam)


def _leissa_hz(lam: float, plate: engine.Plate) -> float:
    """f = λ/(2π·a²)·√(D/ρ), D = E·h³/(12(1 − ν²)), ρ the mass per unit area,
    worked out here."""
    d = plate.youngs_gpa * 1e9 * plate.thickness_m**3 / (12 * (1 - NU * NU))
    rho = plate.density_kg_m3 * plate.thickness_m
    return lam / (2 * math.pi * plate.side_m**2) * math.sqrt(d / rho)


def _swing(drive_hz: float) -> float:
    """The middle's swing, as the page's tile reads it against the lowest tone's."""
    driven = _driven()
    return engine.response(_STEEL, driven, drive_hz, 0.0, 0.0) / engine.response(_STEEL, driven, _tone_hz(0), 0.0, 0.0)


def _half_swing_hz(side: int) -> float:
    """Where, beside the lowest tone, the middle's swing has fallen to 1/√2 of
    its swing at the tone (half the energy): bisection on the page's answer."""
    f1 = _tone_hz(0)
    lo, hi = (f1, f1 * 1.01) if side > 0 else (f1 * 0.99, f1)
    target = 1 / math.sqrt(2)
    inside = (lambda f: _swing(f) > target) if side > 0 else (lambda f: _swing(f) < target)
    return bisect(inside, lo, hi, 60)


def _q_run() -> float:
    return _tone_hz(0) / (_half_swing_hz(+1) - _half_swing_hz(-1))


def _gauss(n: int) -> list[tuple[float, float]]:
    """Gauss–Legendre nodes and weights on [−1, 1], by Newton's method on P_n:
    our own, so the mode's mass is an integral here, not the engine's Σc²."""
    out = []
    for i in range(1, n + 1):
        x = math.cos(math.pi * (i - 0.25) / (n + 0.5))
        for _ in range(100):
            p0, p1 = 1.0, x
            for k in range(2, n + 1):
                p0, p1 = p1, ((2 * k - 1) * x * p1 - (k - 1) * p0) / k
            dp = n * (x * p1 - p0) / (x * x - 1)
            x -= p1 / dp
            if abs(p1 / dp) < 1e-15:
                break
        p0, p1 = 1.0, x
        for k in range(2, n + 1):
            p0, p1 = p1, ((2 * k - 1) * x * p1 - (k - 1) * p0) / k
        dp = n * (x * p1 - p0) / (x * x - 1)
        out.append((x, 2 / ((1 - x * x) * dp * dp)))
    return out


def _mass(mode: engine.Mode) -> float:
    """μ = ∫∫φ² over the square [−1, 1]², by 24 × 24 Gauss points: exact for a
    mode of degree 20 in each direction, whose square has degree 40."""
    nodes = _gauss(24)
    return sum(wx * wy * engine.value(mode, x, y) ** 2 for x, wx in nodes for y, wy in nodes)


def _alone(mode: engine.Mode) -> float:
    """One mode at its own tone, pushed at the middle: φ(0)²/(μ·2ζ·ω²), with
    the common factors left out. ω ∝ λ for one plate."""
    return engine.value(mode, 0.0, 0.0) ** 2 / (_mass(mode) * mode.lam**2)


_FOURTH = 3


def _fourth_hand_percent() -> float:
    driven = _driven()
    return _alone(driven[_FOURTH]) / _alone(driven[0]) * 100


CASES: tuple[Case, ...] = (
    Case(
        key="lowest_tone",
        unit="Hz",
        expected=lambda: _leissa_hz(_LEISSA_LOWEST, _STEEL),
        measured=lambda: _tone_hz(0),
        # Leissa prints six digits: half a unit in the last is 2·10⁻⁶.
        tolerance=2e-6,
        sources=(_TABLE, _PLATE),
        setting={"drive_hz": _tone_hz(0)},
    ),
    Case(
        key="second_tone",
        unit="",
        expected=lambda: _LEISSA_SECOND / _LEISSA_LOWEST,
        measured=lambda: _tone_hz(1) / _tone_hz(0),
        # Iguchi's series, cut off after five terms, lies 1.4·10⁻⁵ above the
        # engine's Ritz value, which is itself an upper bound.
        tolerance=5e-5,
        sources=(_TABLE,),
        setting={"drive_hz": _tone_hz(1)},
    ),
    Case(
        key="sharpness",
        unit="",
        expected=lambda: 1 / (2 * _STEEL.damping_ratio),
        measured=_q_run,
        # One mode alone, its half points taken against its swing at the tone,
        # gives 1/(2ζ) to 8·10⁻⁶; the other nine, off their tones, add 1.4·10⁻⁵.
        tolerance=1e-4,
        sources=(_Q_ZETA, _Q_WIDTH),
        derived=True,
        setting={"drive_hz": _half_swing_hz(+1)},
    ),
    Case(
        key="fourth_tone",
        unit="%",
        expected=_fourth_hand_percent,
        measured=lambda: _swing(_tone_hz(_FOURTH)) * 100,
        # The other nine modes, off their tones, answer in step with the push
        # while the ringing mode answers a quarter turn behind: they add only
        # in quadrature, 6·10⁻⁵ here.
        tolerance=2e-4,
        sources=(_MODAL, _PLATE),
        derived=True,
        setting={"drive_hz": _tone_hz(_FOURTH)},
    ),
)
