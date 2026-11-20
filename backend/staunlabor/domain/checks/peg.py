"""Galileo's interrupted pendulum, checked: its time loop, at the page's step,
against Galileo's own observation, the swing's period on two radii, the
loop's height and the height the string goes slack at.

No air, a thin peg and a string that does not stretch, as in the engine.
"""

from __future__ import annotations

import math

from staunlabor.domain.checks import Case, Source
from staunlabor.domain.experiments import peg as engine

ENGINE = ("peg",)

#: Standard gravity, as the engine takes it.
G = 9.80665

_GALILEO = Source(
    cite="Galileo Galilei, Dialogues Concerning Two New Sciences, transl. H. Crew and A. de Salvio (Macmillan, 1914), "
    "Third Day, p. 171 (Ed. Naz. VIII, 206), Fig. 46",
    url="https://archive.org/details/dialoguesconcern00galiuoft",
    quote="you will observe with pleasure that the ball swings to the point G in the horizontal, and you would see the "
    "same thing happen if the obstacle were placed at some lower point, say at F, about which the ball would describe "
    "the arc BI, the rise of the ball always terminating exactly on the line CD.",
)
_TENSION = Source(
    cite="javalab.org, “Force to move the pendulum”, total tension applied to the string",
    url="https://javalab.org/en/pendulum_en/",
    quote="½mv² = mgl(cos θ – cos θ_m) ∴ v² = 2gl(cos θ – cos θ_m) … The total tension = Tension by gravity + "
    "Centripetal force … = mg(3cos θ – 2cos θ_m)",
)
_SMALL = Source(
    cite="OpenStax, University Physics Volume 1, §15.4 Pendulums, Eqs. 15.18 and 15.19",
    url="https://openstax.org/books/university-physics-volume-1/pages/15-4-pendulums",
    quote="The angular frequency is ω = √(g/L) and the period is T = 2π√(L/g).",
)
_PERIOD = Source(
    cite="NIST Digital Library of Mathematical Functions, §22.19(i), Eq. 22.19.1 and after Eq. 22.19.2",
    url="https://dlmf.nist.gov/22.19",
    quote="With appropriate scalings, Newton’s equation of motion for a pendulum … is d²θ(t)/dt² = −sin θ(t) … "
    "The period is 4K(sin(½α))",
)
_INTEGRAL = Source(
    cite="NIST Digital Library of Mathematical Functions, §19.2(ii), Eqs. 19.2.4 and 19.2.8",
    url="https://dlmf.nist.gov/19.2",
    quote="F(φ,k) = ∫₀^φ dθ/√(1 − k² sin²θ) … K(k) = F(π/2,k)",
)

#: The page's string: a metre, the peg halfway down, let go at 30°.
_DEFAULT = engine.PegPendulum()
#: The page's slack case: from the horizontal, the peg at 55 cm.
_SLACK = engine.PegPendulum(peg_depth_m=0.55, start_deg=90.0)
#: From the horizontal on a metre: the energy alone puts the loop's edge at a
#: peg 60 cm down.
_LEVEL = engine.PegPendulum(peg_depth_m=0.60, start_deg=90.0)


def _height(p: engine.PegPendulum) -> float:
    """h = L(1 − cos θ₀): at the bottom ½v² = gL(1 − cos θ₀), the source's
    energy with θ = 0."""
    return p.length_m * (1 - math.cos(math.radians(p.start_deg)))


def _k_by_sum(modulus: float, n: int = 20000) -> float:
    """K(k) = ∫₀^{π/2} dφ/√(1 − k² sin²φ) by the midpoint rule: a reader's own
    integral, not the engine's arithmetic-geometric mean."""
    h = math.pi / 2 / n
    return h * sum(1 / math.sqrt(1 - (modulus * math.sin((j + 0.5) * h)) ** 2) for j in range(n))


def _period_hand(p: engine.PegPendulum) -> float:
    """Half a swing on the whole string at θ₀, half a swing round the peg at
    the angle φ₀ the same height asks for: r(1 − cos φ₀) = L(1 − cos θ₀).
    Each half is 2K(sin(½α)) in the time scaled by √(g/ℓ)."""
    r = p.small_radius_m
    theta0 = math.radians(p.start_deg)
    phi0 = math.acos(1 - _height(p) / r)
    big = 2 * math.sqrt(p.length_m / G) * _k_by_sum(math.sin(theta0 / 2))
    small = 2 * math.sqrt(r / G) * _k_by_sum(math.sin(phi0 / 2))
    return big + small


def _catches(p: engine.PegPendulum, seconds: float) -> list[float]:
    """When the peg catches the string, the page's loop stepped at its step."""
    s, t, at = engine.start(p), 0.0, []
    for _ in range(round(seconds / engine.STEP_S)):
        s, happened = engine.step(p, s, t, engine.STEP_S)
        t += engine.STEP_S
        at.extend(when for when, kind, _x, _y in happened if kind is engine.Event.CAUGHT)
    return at


def _period_run(p: engine.PegPendulum) -> float:
    """From the first catch to the fourth: three whole swings."""
    at = _catches(p, 6.0)
    return (at[3] - at[0]) / 3


def _goes_over(depth_m: float) -> bool:
    """Whether the bob, let go from the horizontal on the page's metre, goes
    over the top round a peg ``depth_m`` down: the time loop's own event."""
    p = engine.PegPendulum(peg_depth_m=depth_m, start_deg=90.0)
    return engine.run(p, 2.0).over_the_top


def _loop_edge_cm() -> float:
    """The highest peg it still goes over at, by halving between the page's
    slack case (55 cm) and its loop (65 cm)."""
    lo, hi = 0.55, 0.65
    assert not _goes_over(lo)
    assert _goes_over(hi)
    for _ in range(30):
        mid = (lo + hi) / 2
        if _goes_over(mid):
            hi = mid
        else:
            lo = mid
    return (lo + hi) / 2 * 100


def _slack_run_cm(p: engine.PegPendulum) -> float:
    """Where the time loop first lets the string go slack, from the bottom."""
    run = engine.run(p, 2.0)
    _t, _kind, _x, y = next(e for e in run.events if e[1] == engine.Event.SLACK)
    return (y + p.length_m) * 100


def _slack_hand_cm(p: engine.PegPendulum) -> float:
    """Round the peg the bob is at φ, z = r(1 − cos φ) above the bottom, with
    v² = 2g(h − z) from its height. The source's tension mg·cos φ + mv²/r,
    zero: r − z + 2(h − z) = 0, so z = (r + 2h)/3."""
    return (p.small_radius_m + 2 * _height(p)) / 3 * 100


def _setting(p: engine.PegPendulum) -> dict[str, float | str]:
    """What the page's "Set it up" sets: the string, the peg and the start."""
    return {"length_m": p.length_m, "peg_depth_m": p.peg_depth_m, "start_deg": p.start_deg}


CASES: tuple[Case, ...] = (
    Case(
        key="same_height",
        unit="cm",
        expected=lambda: _height(_DEFAULT) * 100,
        measured=lambda: engine.run(_DEFAULT, 6.0).peg_side_top_m * 100,
        # The run reads the bob once a millisecond, so the turning point can
        # fall between two readings: half a step misses at most 6 · 10⁻⁷ m,
        # 4 · 10⁻⁶ of the height (here 3 · 10⁻⁸ m).
        tolerance=5e-6,
        sources=(_GALILEO, _TENSION),
        setting=_setting(_DEFAULT),
    ),
    Case(
        key="period",
        unit="s",
        expected=lambda: _period_hand(_DEFAULT),
        measured=lambda: _period_run(_DEFAULT),
        # Classical Runge–Kutta at 1 ms, each catch found within its step by
        # 40 halvings: 2 · 10⁻¹² here.
        tolerance=1e-9,
        sources=(_SMALL, _PERIOD, _INTEGRAL),
        derived=True,
        setting=_setting(_DEFAULT),
    ),
    Case(
        key="loop",
        unit="cm",
        expected=lambda: (_LEVEL.length_m - 2 / 5 * _height(_LEVEL)) * 100,
        measured=_loop_edge_cm,
        # Just short of the edge the string is slack only for an instant at
        # the top, between two steps' ends: the loop does not see it. Its pull
        # there is 1.5·g·(φ − π)² above its least, so a dip narrower than one
        # step (5 · 10⁻³ rad at the top) can be missed: the edge may lie up to
        # 7 · 10⁻⁷ m, 1.2 · 10⁻⁶ of it, higher (here 1.1 · 10⁻⁷ m).
        tolerance=2e-6,
        sources=(_TENSION,),
        derived=True,
        setting=_setting(_LEVEL),
    ),
    Case(
        key="slack",
        unit="cm",
        expected=lambda: _slack_hand_cm(_SLACK),
        measured=lambda: _slack_run_cm(_SLACK),
        # The slack is found within its step by 40 halvings: 2 · 10⁻¹² here.
        tolerance=1e-9,
        sources=(_TENSION,),
        derived=True,
        setting=_setting(_SLACK),
    ),
)
