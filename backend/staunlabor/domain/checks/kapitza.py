"""Kapitza's pendulum, checked: the least drive that holds the rod upside down
against Kapitza's bound and against the exact edge of Mathieu's stable region,
the slow wobble about the top against Kapitza's averaged motion, and the band
of drives that swings the hanging rod up against Mathieu's first resonance.

The page asks the browser port (``simulate/kapitza.ts``: ``leastFrequencyHz``,
``swingUpBandHz``, ``rhs``, ``rk4``, ``stepFor``), held to this engine by
``engine-cases.json``; what is measured here is the engine the port copies.
Landau and Lifshitz (*Mechanics*, §30, problem 1) could not be read for these
cases (no copy open to read); Butikov's paper states the bound and the slow
rates, Fowler's notes, which follow Landau's §30, the bound again; the exact
edges are the DLMF's series of Mathieu's characteristic values.
"""

from __future__ import annotations

import itertools
import math

from staunlabor.domain.checks import Case, Source
from staunlabor.domain.checks._hand import G
from staunlabor.domain.experiments import kapitza as engine

_BUTIKOV_BOUND = Source(
    cite="E. I. Butikov, “On the dynamic stabilization of an inverted pendulum”, Am. J. Phys. 69, 755 (2001), Eq. (7)",
    url="https://butikov.itmo.ru/Inverted.pdf",
    quote="a²ω² > 2gl. (7) Thus, the inverted position of the pendulum is stable if the maximal velocity ωa of the vibrating axis is greater than the velocity √2gl attained by a body during a free fall from the height that equals the pendulum length l.",
)
_FOWLER = Source(
    cite="M. Fowler, University of Virginia, Physics 7010, “Motion in a Rapidly Oscillating Field: the Ponderomotive Force”, §“Stability of a Pendulum with a Rapidly Oscillating Vertical Driving Force”",
    url="https://galileoandeinstein.phys.virginia.edu/7010/CM_21_Ponderomotive_Force.html",
    quote="(Landau has a misprint — an extra ℓ in this, p 95) … V_eff = V + f̄²/2mΩ² = mgℓ(−cos ϕ + (a²Ω²/4gℓ) sin²ϕ). … and for a²Ω² > 2gℓ, the upward position is stable!",
)
_BUTIKOV_SLOW = Source(
    cite="E. I. Butikov, “On the dynamic stabilization of an inverted pendulum”, Am. J. Phys. 69, 755 (2001), Eq. (10)",
    url="https://butikov.itmo.ru/Inverted.pdf",
    quote="The frequencies ω_up and ω_down of small slow oscillations about the inverted position and the lower vertical position are given by ω_up² = a²ω²/2l² − ω0², ω_down² = a²ω²/2l² + ω0². (10)",
)
_MATHIEU = Source(
    cite="NIST Digital Library of Mathematical Functions, §28.2(i), Eq. 28.2.1",
    url="https://dlmf.nist.gov/28.2",
    quote="w″+(a−2q cos(2z))w=0",
)
_A0 = Source(
    cite="NIST Digital Library of Mathematical Functions, §28.6(i), Eq. 28.6.1",
    url="https://dlmf.nist.gov/28.6",
    quote="a₀(q) = −½q² + (7/128)q⁴ − (29/2304)q⁶ + (68687/188 74368)q⁸ + ⋯",
)
_A1_B1 = Source(
    cite="NIST Digital Library of Mathematical Functions, §28.6(i), Eqs. 28.6.2 and 28.6.3",
    url="https://dlmf.nist.gov/28.6",
    quote="a₁(q) = 1 + q − ⅛q² − (1/64)q³ − (1/1536)q⁴ + (11/36864)q⁵ + (49/5 89824)q⁶ + (55/94 37184)q⁷ − (83/353 89440)q⁸ + ⋯, b₁(q) = 1 − q − ⅛q² + (1/64)q³ − (1/1536)q⁴ − (11/36864)q⁵ + (49/5 89824)q⁶ − (55/94 37184)q⁷ − (83/353 89440)q⁸ + ⋯",
)
_STABILITY = Source(
    cite="NIST Digital Library of Mathematical Functions, §28.17, Stability as x → ±∞",
    url="https://dlmf.nist.gov/28.17",
    quote="If all solutions of (28.2.1) are bounded when x→±∞ along the real axis, then the corresponding pair of parameters (a,q) is called stable. All other pairs are unstable. … The boundary of each region comprises the characteristic curves a=a_n(q) and a=b_n(q)",
)

#: A 20 cm rod shaken by 2 mm: a/l = 0.01, where Kapitza's bound is nearly exact.
_SMALL = engine.KapitzaPendulum(length_m=0.2, amplitude_m=0.002, frequency_hz=160.0, damping_per_s=0.0)
#: The same rod shaken by 4 cm: a/l = 0.2, where the bound is 0.86 % short.
_WIDE = engine.KapitzaPendulum(length_m=0.2, amplitude_m=0.04, frequency_hz=8.5, damping_per_s=0.0)
#: The page's pendulum without its damping, 2° off the top.
_PAGE = engine.KapitzaPendulum(damping_per_s=0.0)
_OFF_TOP_DEG = 178.0
#: The page's pendulum without its damping, at twice its own frequency.
_HANGING = engine.KapitzaPendulum(frequency_hz=2.23, damping_per_s=0.0)


def _kapitza_hz(k: engine.KapitzaPendulum) -> float:
    """``a·ω = √(2gl)`` solved for the drive, Hz."""
    return math.sqrt(2 * G * k.length_m) / k.amplitude_m / (2 * math.pi)


def _a0(q: float) -> float:
    return -(q**2) / 2 + 7 * q**4 / 128 - 29 * q**6 / 2304 + 68687 * q**8 / 18874368


def _a1(q: float) -> float:
    return (
        1
        + q
        - q**2 / 8
        - q**3 / 64
        - q**4 / 1536
        + 11 * q**5 / 36864
        + 49 * q**6 / 589824
        + 55 * q**7 / 9437184
        - 83 * q**8 / 35389440
    )


def _b1(q: float) -> float:
    return _a1(-q)


def _drive_for(characteristic: float, k: engine.KapitzaPendulum) -> float:
    """The drive at which Mathieu's ``a`` is ``±characteristic``: with
    ``ωt = 2z`` the rod's small deviation obeys 28.2.1 with
    ``a = ∓4g/(lω²)`` (top, bottom) and ``q = ±2a/l``, so
    ``ω = √(4g/(l·|a|))``, Hz."""
    return math.sqrt(4 * G / (k.length_m * abs(characteristic))) / (2 * math.pi)


def _boundary_by_series() -> float:
    return _drive_for(_a0(2 * _WIDE.amplitude_m / _WIDE.length_m), _WIDE)


def _band_by_series() -> float:
    q = 2 * _HANGING.amplitude_m / _HANGING.length_m
    return _drive_for(_b1(q), _HANGING) - _drive_for(_a1(q), _HANGING)


def _band_measured() -> float:
    band = engine.swing_up_band_hz(_HANGING)
    assert band is not None
    return band[1] - band[0]


def _least(k: engine.KapitzaPendulum) -> float:
    found = engine.least_frequency_hz(k)
    assert found is not None
    return found


def _slow_period_hand() -> float:
    w, length = 2 * math.pi * _PAGE.frequency_hz, _PAGE.length_m
    return 2 * math.pi / math.sqrt((_PAGE.amplitude_m * w) ** 2 / (2 * length**2) - G / length)


def _slow_period_measured() -> float:
    """The page's loop, from rest 2° off the top, looked at once a drive
    period, as a strobe would: the time between the rod's upward crossings of
    the top, interpolated, over 10 s."""
    f, h = engine.rhs(_PAGE), engine.step_for(_PAGE)
    per = round(1 / _PAGE.frequency_hz / h)
    y = engine.start_state(_OFF_TOP_DEG)
    strobe = []
    for i in range(round(10.0 / h)):
        if i % per == 0:
            strobe.append((i * h, y[0] - math.pi))
        y = engine.rk4(f, i * h, y, h)
    ups = [t0 + (t1 - t0) * -p0 / (p1 - p0) for (t0, p0), (t1, p1) in itertools.pairwise(strobe) if p0 < 0 <= p1]
    return (ups[-1] - ups[0]) / (len(ups) - 1)


def _setting(k: engine.KapitzaPendulum, start_deg: float) -> dict[str, float | str]:
    """What the page's "Set it up" sets: the build, the motor on, and where
    the rod starts (180° is the top)."""
    return {
        "length_m": k.length_m,
        "amplitude_m": k.amplitude_m,
        "frequency_hz": k.frequency_hz,
        "damping_per_s": k.damping_per_s,
        "start_deg": start_deg,
    }


CASES: tuple[Case, ...] = (
    Case(
        key="bound",
        unit="Hz",
        expected=lambda: _kapitza_hz(_SMALL),
        measured=lambda: _least(_SMALL),
        # Kapitza's bound is the first term in a/l: the exact edge lies
        # (7/32)(a/l)² = 2.2 · 10⁻⁵ higher.
        tolerance=5e-5,
        sources=(_BUTIKOV_BOUND, _FOWLER),
        setting=_setting(_SMALL, 178.0),
    ),
    Case(
        key="mathieu",
        unit="Hz",
        expected=_boundary_by_series,
        measured=lambda: _least(_WIDE),
        # The series stops at q⁸: 7.5 · 10⁻⁷ at q = 0.4.
        tolerance=1e-5,
        sources=(_MATHIEU, _A0, _STABILITY),
        derived=True,
        setting=_setting(_WIDE, 178.0),
    ),
    Case(
        key="wobble",
        unit="s",
        expected=_slow_period_hand,
        measured=_slow_period_measured,
        # Kapitza's averaging drops terms of order (a/l)² = 2.5 · 10⁻³ and
        # (Ω/ω)² = 5 · 10⁻⁴; the loop lies 3.0 · 10⁻⁴ off.
        tolerance=3e-3,
        sources=(_BUTIKOV_SLOW,),
        setting=_setting(_PAGE, _OFF_TOP_DEG),
    ),
    Case(
        key="swing_up",
        unit="Hz",
        expected=_band_by_series,
        measured=_band_measured,
        # The series stop at q⁸, 10⁻¹² at q = 0.1.
        tolerance=1e-6,
        sources=(_MATHIEU, _A1_B1, _STABILITY),
        derived=True,
        setting=_setting(_HANGING, 5.0),
    ),
)
