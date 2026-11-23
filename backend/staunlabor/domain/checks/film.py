"""The soap film between two rings, checked: the farthest the rings can be apart
with a film between them, the area of the film just before it tears, the two
catenoids between rings a radius apart, and the distance from which two flat
discs have less area.

The page draws the browser port (``simulate/film.ts``), held to this engine by
``engine-cases.json``. What is measured here is what the page calls:
:func:`catenoids`, which draws the film and gives its waist and area, and
:func:`figures`, whose ``least`` tells the page whether the film is the least
area. The hand values solve the sources' own equations, each by its own
bisection, not by the engine's ``t = h/(2c)``.
"""

from __future__ import annotations

import math

from staunlabor.domain.checks import Case, Source
from staunlabor.domain.checks._hand import bisect
from staunlabor.domain.experiments import film as engine

_MW = "https://mathworld.wolfram.com/MinimalSurfaceofRevolution.html"
_TEAR_MW = Source(
    cite="E. W. Weisstein, “Minimal Surface of Revolution”, MathWorld, Eqs. (25)–(26) (rings at (±x_0, y_0))",
    url=_MW,
    quote="Defining u=px_0^*, u=coth u. (25) This has solution u=1.1996786403.... From (22), y_0p=cosh u. Divide "
    "this by (25) to obtain y_0/x_0=sinh u, so the maximum possible value of x_0/y_0 is "
    "x_0/y_0=csch u=0.6627434193.... (26) Therefore, only Goldschmidt ring solutions exist for x_0/y_0>0.6627....",
)
_TWO_MW = Source(
    cite="E. W. Weisstein, “Minimal Surface of Revolution”, MathWorld, Eqs. (40)–(41)",
    url=_MW,
    quote="If we take x_0=1/2 and y_0=1 then (19) becomes 1=a cosh(1/(2a)), (41) which has two solutions: "
    'a_1=0.2350... ("deep"), and a_2=0.8483... ("flat"). However, upon plugging these into (40) with '
    "x_0=1/2, we find A_1=6.8456... and A_2=5.9917.... So A_1 is not, in fact, a local minimum, and A_2 is the "
    "only true minimal solution.",
)
_AREA_MW = Source(
    cite="E. W. Weisstein, “Minimal Surface of Revolution”, MathWorld, Eq. (40)",
    url=_MW,
    quote="The surface area of the minimal catenoid surface is given by A=2(2pi)int_0^(x_0)y sqrt(1+y'^2)dx, … "
    "=pi a^2[sinh((2x_0)/a)+(2x_0)/a]. (40)",
)
_EQUAL_MW = Source(
    cite="E. W. Weisstein, “Minimal Surface of Revolution”, MathWorld, Eqs. (48)–(50)",
    url=_MW,
    quote="Defining u=(y_0)/a (47) gives u sqrt(u^2-1)+cosh^(-1)u-u^2=0. (48) This has a solution u=1.2113614259. "
    "The value of x_0/y_0 for which A_(catenary)=A_(2 disks) (49) is therefore "
    "(x_0)/(y_0)=((x_0)/a)/((y_0)/a)=(cosh^(-1)((y_0)/a))/((y_0)/a)=(cosh^(-1)u)/u=0.5276973967. (50) For "
    "x_0/y_0 in (0.52770,0.6627), the catenary solution has larger area than the two disks, so it exists only as "
    "a local minimum.",
)
_JIA = Source(
    cite="L. L. Jia, S. Pei, R. A. Pelcovits, T. R. Powers, “Axisymmetric membranes with edges under external force: "
    "buckling, minimal surfaces, and tethers”, arXiv:2106.01507, §1.1 Soap film problem",
    url="https://arxiv.org/abs/2106.01507",
    quote="as long as the separation is less than the maximum value of separation h_max ≈ 1.3255a, there are two "
    "catenoids connecting the rings. There is one catenoid solution at h = h_max, and no catenoid solutions for "
    "h > h_max.",
)
_JIA_AREA = Source(
    cite="L. L. Jia, S. Pei, R. A. Pelcovits, T. R. Powers, arXiv:2106.01507, §1.1 Soap film problem",
    url="https://arxiv.org/abs/2106.01507",
    quote="Note that for a given ring radius a, the critical catenoid at the largest extension h ≈ 1.3255a is also "
    "the catenoid of greatest area (Fig. 3), with Ā ≡ A/(2πa²) ≈ 1.1997, a number we define to be Ā_max.",
)
_JIA_STABLE = Source(
    cite="L. L. Jia, S. Pei, R. A. Pelcovits, T. R. Powers, arXiv:2106.01507, §1.1 Soap film problem",
    url="https://arxiv.org/abs/2106.01507",
    quote="For a given h/a, the catenoid with the larger neck radius has less area (Figs. 2 and 3). This branch of "
    "catenoids is also stable to small perturbations, whereas the larger-area branch is unstable",
)
_ITO = Source(
    cite="M. Ito, T. Sato, “In situ observation of a soap-film catenoid—a simple educational physics experiment”, "
    "Eur. J. Phys. 31 (2010) 357, §2 and §3, doi:10.1088/0143-0807/31/2/013",
    url="https://doi.org/10.1088/0143-0807/31/2/013",
    quote="For h/R > 1.33, it is not possible to form a catenoid … However, in the experiment, the jump from the "
    "stable catenoid to the two discs does not occur. Furthermore, as the distance h approaches the critical "
    "distance h_c = 1.33R, the catenoid exhibits strange behaviour.",
)

#: The page's rings, 10 cm across.
_R = engine.EXHIBIT_RADIUS_M
#: Halvings of the hand's brackets, each a unit or so wide: past a double's
#: last digit.
_HALVINGS = 80


def _coth_root() -> float:
    """MathWorld's (25), u = coth u, by halving: u < coth u below the root."""
    return bisect(lambda u: u < 1 / math.tanh(u), 0.5, 2.0, _HALVINGS)


def _tear_hand() -> float:
    """h/R = 2·x_0/y_0 = 2·csch u, MathWorld's (26) with h = 2x_0."""
    return 2 / math.sinh(_coth_root())


def _tear_page() -> float:
    """The farthest distance, over R, at which the engine still finds a film
    with a waist: halved on its own answer, not read off its constant."""
    return bisect(lambda h: engine.catenoids(engine.Rings(_R, h)) is not None, 0.5 * _R, 2 * _R, _HALVINGS) / _R


def _ito_area(a: float, radius: float) -> float:
    """Ito and Sato's (4): S = 2πa²[cosh⁻¹(R/a) + ½·sinh(2·cosh⁻¹(R/a))]."""
    w = math.acosh(radius / a)
    return 2 * math.pi * a**2 * (w + 0.5 * math.sinh(2 * w))


def _critical_area_hand() -> float:
    """The critical catenoid's area over the discs' 2πR²: at the tear,
    y_0p = cosh u (MathWorld's (22)–(23)) puts the waist at a = R/cosh u."""
    return _ito_area(1 / math.cosh(_coth_root()), 1.0) / (2 * math.pi)


def _critical_area_page() -> float:
    """The engine's wide film a hair (10⁻¹⁰ of R) short of the tear, over the
    discs: at the tear itself a rounding may put it past."""
    film = engine.figures(engine.Rings(_R, _tear_page() * _R * (1 - 1e-10)))
    assert film.area_m2 is not None
    return film.area_m2 / film.discs_m2


def _necks_hand(x0: float, y0: float) -> tuple[float, float]:
    """The two roots of MathWorld's (19), y_0 = a·cosh(x_0/a): a·cosh(x_0/a)
    falls to a least value and rises again; each side halved apart."""

    def f(a: float) -> float:
        return a * math.cosh(x0 / a)

    # Where f is least: d/da = cosh(x_0/a) − (x_0/a)·sinh(x_0/a) = 0.
    least = bisect(lambda a: math.cosh(x0 / a) - (x0 / a) * math.sinh(x0 / a) < 0, x0 / 10, 10 * x0, _HALVINGS)
    deep = bisect(lambda a: f(a) > y0, x0 / 50, least, _HALVINGS)
    flat = bisect(lambda a: f(a) < y0, least, 10 * y0, _HALVINGS)
    return deep, flat


def _mw_area(a: float, x0: float) -> float:
    """MathWorld's (40): A = πa²[sinh(2x_0/a) + 2x_0/a]."""
    return math.pi * a**2 * (math.sinh(2 * x0 / a) + 2 * x0 / a)


def _flat_hand_cm2() -> float:
    """MathWorld's rings x_0 = ½, y_0 = 1 are a radius apart; on the page's
    5 cm rings every length is 5 cm times theirs, every area 25 cm² times."""
    _, flat = _necks_hand(0.5, 1.0)
    return _mw_area(flat, 0.5) * (_R * 100) ** 2


def _ring_apart() -> tuple[engine.Catenoid, engine.Catenoid]:
    both = engine.catenoids(engine.Rings(_R, _R))
    assert both is not None
    return both


def _equal_hand() -> float:
    """MathWorld's (48) for u = y_0/a, then (50): h/R = 2·cosh⁻¹(u)/u."""
    u = bisect(lambda u: u * math.sqrt(u * u - 1) + math.acosh(u) - u * u < 0, 1.0 + 1e-12, 2.0, _HALVINGS)
    return 2 * math.acosh(u) / u


def _equal_page() -> float:
    """Where the engine's ``least`` turns off as the rings are drawn apart,
    over R."""
    return bisect(lambda h: engine.figures(engine.Rings(_R, h)).least, 0.5 * _R, 1.3 * _R, _HALVINGS) / _R


def _setting(distance_cm: float) -> dict[str, float | str]:
    """What the page's "Set it up" sets: the rings' radius and distance, the
    film dipped anew."""
    return {"radius_m": _R, "distance_m": distance_cm / 100}


CASES: tuple[Case, ...] = (
    Case(
        key="tear",
        unit="",
        expected=_tear_hand,
        measured=_tear_page,
        # Both halved past a double's last digit: rounding only.
        tolerance=1e-12,
        sources=(_TEAR_MW, _JIA, _ITO),
        # Just over a millimetre short of the tear at 6.63 cm: the reader
        # draws the rest.
        setting=_setting(6.5),
    ),
    Case(
        key="critical_area",
        unit="",
        expected=_critical_area_hand,
        measured=_critical_area_page,
        # 10⁻¹⁰ of R short of the tear moves the area by 10⁻¹⁰ at most; the
        # waist halved where both catenoids meet is good to 10⁻⁸, and the area
        # there is level in it to first order.
        tolerance=1e-9,
        sources=(_JIA_AREA, _TEAR_MW),
        setting=_setting(6.6),
    ),
    Case(
        key="flat",
        unit="cm²",
        expected=_flat_hand_cm2,
        measured=lambda: _ring_apart()[0].area_m2 * 1e4,
        # Rounding only.
        tolerance=1e-12,
        sources=(_TWO_MW, _AREA_MW, _JIA_STABLE),
        setting=_setting(5.0),
    ),
    Case(
        key="deep",
        unit="cm",
        expected=lambda: _necks_hand(0.5, 1.0)[0] * _R * 100,
        measured=lambda: _ring_apart()[1].neck_m * 100,
        # Rounding only.
        tolerance=1e-12,
        sources=(_TWO_MW, _JIA_STABLE),
        setting=_setting(5.0),
    ),
    Case(
        key="equal",
        unit="",
        expected=_equal_hand,
        measured=_equal_page,
        # Rounding only.
        tolerance=1e-12,
        sources=(_EQUAL_MW, _ITO),
        setting=_setting(5.4),
    ),
)
