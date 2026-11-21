"""The falling plates, checked: the plastic plate against free fall, the fall
against Newton's law with a drag proportional to the speed, the thickness and
the metal against the brake's proportions, and fine teeth against the endless
strip.

The brake itself has no closed form for a plate with edges; what the cases
hold it to are its proportions (thickness, conductivity, density) and the one
limit in which it has one: teeth much wider than high.
"""

from __future__ import annotations

import math

from staunlabor.domain.checks import Case, Source
from staunlabor.domain.experiments import plates as engine

ENGINE = ("plates",)

#: Standard gravity, as the engine takes it.
G = 9.80665

_FREE_FALL = Source(
    cite="OpenStax, University Physics Volume 1, §3.5 Free Fall, Eq. 3.16",
    url="https://openstax.org/books/university-physics-volume-1/pages/3-5-free-fall",
    quote="If an object is dropped, we know the initial velocity is zero when in free fall. … y = y₀ + v₀t − ½gt²",
)
_LINEAR_DRAG = Source(
    cite="OpenStax, University Physics Volume 1, §6.4, “The Calculus of Velocity-Dependent Frictional Forces”",
    url="https://openstax.org/books/university-physics-volume-1/pages/6-4-drag-force-and-terminal-speed",
    quote="mg − bv = m dv/dt … v_T = mg/b … y = (mg/b)t + (m²g/b²)(e^(−bt/m) − 1)",
)
_OHM = Source(
    cite="Wikipedia, “Ohm’s law”, §“Magnetic effects”",
    url="https://en.wikipedia.org/wiki/Ohm%27s_law",
    quote="If an external B-field is present and the conductor is not at rest but moving at velocity v, then an extra term must be added to account for the current induced by the Lorentz force on the charge carriers. J = σ(E + v × B)",
)
_METALS = Source(
    cite="Wikipedia, “Electrical resistivity and conductivity”, §7 “Resistivity-density product”, table (resistivity in nΩ·m, density in g/cm³)",
    url="https://en.wikipedia.org/wiki/Electrical_resistivity_and_conductivity",
    quote="Resistivity, density, and resistivity–density product of selected materials, and relative to copper (Cu) … Aluminium 26.50 1.579 2.70 0.301 72 0.48 … Copper 16.78 1 8.96 1 150 1",
)
_MOTIONAL = Source(
    cite="OpenStax, University Physics Volume 2, §13.3 Motional Emf, Eq. 13.6 and 13.7",
    url="https://openstax.org/books/university-physics-volume-2/pages/13-3-motional-emf",
    quote="The power dissipated is P = I²R = (Blv/R)²R = l²B²v²/R. In satisfying the principle of energy conservation, the produced and dissipated powers are equal.",
)

_COLUMN = engine.MagnetColumn()
_PLASTIC = engine.Plate("plastic")
#: The exhibit's slotted plate: aluminium, teeth 8 mm high.
_SLOTTED = engine.Plate("aluminium", tooth_m=0.008)
_ALUMINIUM = engine.Plate("aluminium")
_THICK = engine.Plate("aluminium", thickness_m=0.010)
_COPPER = engine.Plate("copper")
#: Magnets 10 mm high, so a period of 20 mm; teeth 2 mm high, 1 mm thick, so
#: the plate stays slow enough for the model (its currents' own field 5 % of
#: the magnets').
_FINE_COLUMN = engine.MagnetColumn(pitch_m=0.02)
_FINE = engine.Plate("aluminium", thickness_m=0.001, tooth_m=0.002)


def _late_start_hand() -> float:
    """Long after the start the plate falls at v_E, τ behind one that had
    started at it: t = s/v_E + τ, with the page's own m and c̄."""
    m, c = engine.mass_kg(_SLOTTED), engine.brake(_COLUMN, _SLOTTED)
    terminal, tau = m * G / c, m / c
    return _COLUMN.drop_m / terminal + tau


def _metals_hand() -> float:
    """v_E = ϱ·g/(σ·⟨B²⟩·η): for the same plate between the same magnets the
    terminal speeds go as resistivity × density, the table's figures."""
    return (26.50 * 2.70) / (16.78 * 8.96)


def _metals_page() -> float:
    aluminium = engine.figures(_COLUMN, _ALUMINIUM).terminal_m_s
    copper = engine.figures(_COLUMN, _COPPER).terminal_m_s
    assert aluminium is not None and copper is not None
    return aluminium / copper


def _strip_hand() -> float:
    """An endless strip h high: η = 1 − (sin(kh/2)/(kh/2))², k = 2π/λ."""
    u = math.pi * _FINE.tooth_m / _FINE_COLUMN.pitch_m
    return 1 - (math.sin(u) / u) ** 2


def _strip_page() -> float:
    share = engine.figures(_FINE_COLUMN, _FINE).share
    assert share is not None
    return share


def _setting(column: engine.MagnetColumn, plate: engine.Plate) -> dict[str, float | str]:
    """What the page's "Set it up" sets: the column's field and magnets, and
    the reader's own plate."""
    return {
        "field_t": column.field_t,
        "pitch_m": column.pitch_m,
        "material": plate.material,
        "thickness_m": plate.thickness_m,
        "tooth_m": plate.tooth_m,
    }


CASES: tuple[Case, ...] = (
    Case(
        key="free_fall",
        unit="s",
        expected=lambda: math.sqrt(2 * _COLUMN.drop_m / G),
        measured=lambda: engine.fall_time_s(_COLUMN, _PLASTIC),
        tolerance=1e-12,
        sources=(_FREE_FALL,),
        setting=_setting(_COLUMN, _PLASTIC),
    ),
    Case(
        key="late_start",
        unit="s",
        expected=_late_start_hand,
        measured=lambda: engine.fall_time_s(_COLUMN, _SLOTTED),
        # What the hand leaves out is τ·e^(−t/τ), with t/τ = 33: 10⁻¹⁵ of the
        # time; the rest is the page's root-finding, which stops at 10⁻¹⁴.
        tolerance=1e-12,
        sources=(_LINEAR_DRAG,),
        derived=True,
        setting=_setting(_COLUMN, _SLOTTED),
    ),
    Case(
        key="thickness",
        unit="",
        expected=lambda: 1.0,
        measured=lambda: engine.fall_time_s(_COLUMN, _THICK) / engine.fall_time_s(_COLUMN, _ALUMINIUM),
        # Exact; what is left is the sums' rounding.
        tolerance=1e-12,
        sources=(_OHM, _LINEAR_DRAG),
        derived=True,
        setting=_setting(_COLUMN, _THICK),
    ),
    Case(
        key="metals",
        unit="",
        expected=_metals_hand,
        measured=_metals_page,
        # The engine's conductivities have three digits, the table's
        # resistivities four: aluminium's 3.77·10⁷ S/m lies 0.09 % under
        # 1/(26.50 nΩ·m), copper's 5.96·10⁷ 0.01 % over 1/(16.78 nΩ·m).
        tolerance=2e-3,
        sources=(_OHM, _LINEAR_DRAG, _METALS),
        derived=True,
        setting=_setting(_COLUMN, _COPPER),
    ),
    Case(
        key="strip",
        unit="",
        expected=_strip_hand,
        measured=_strip_page,
        # The formula's teeth are endlessly wide; the plate's are 10 cm, and
        # their ends take a share of about 0.63·h/W of the brake (the leading
        # term of the edges' series for a narrow tooth, 186·ζ(5)/π⁵): 1.3 %
        # for teeth 2 mm high.
        tolerance=1.5e-2,
        sources=(_OHM, _MOTIONAL),
        derived=True,
        setting=_setting(_FINE_COLUMN, _FINE),
    ),
)
