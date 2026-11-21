"""The magnet car and the coil, checked: its run, at the page's step, against
the RL circuit, Wheeler's inductance, the field of a loop, Faraday's charge,
the pendulum and the eddy-current brake.
"""

from __future__ import annotations

import math

from staunlabor.domain.checks import Case, Source
from staunlabor.domain.experiments import coil as engine

ENGINE = ("coil",)

G = 9.80665
#: The magnetic constant to the classical definition: μ₀ = 4π·10⁻⁷ H/m.
MU0 = 4e-7 * math.pi
INCH_M = 0.0254

_RL = Source(
    cite="OpenStax, University Physics Volume 2, §14.4 RL Circuits, Eq. 14.24 and 14.25",
    url="https://openstax.org/books/university-physics-volume-2/pages/14-4-rl-circuits",
    quote="I(t) = ε/R (1 − e^(−t/τ_L)) … τ_L = L/R … the inductive time constant of the circuit",
)
_WHEELER = Source(
    cite="H. A. Wheeler, “Simple inductance formulas for radio coils”, Proc. IRE 16 (1928) 1398, Eq. (2), p. 1399",
    url="https://www.worldradiohistory.com/Archive-IRE/20s/IRE-1928-10.pdf",
    quote="L = a²n²/(9a+10b) microhenries … This formula is correct to within 1 per cent for coils with b > 0.8 a.",
)
_LOOP = Source(
    cite="OpenStax, University Physics Volume 2, §12.4 Magnetic Field of a Current Loop, Eq. 12.15",
    url="https://openstax.org/books/university-physics-volume-2/pages/12-4-magnetic-field-of-a-current-loop",
    quote="B = μ₀IR² / [2(y² + R²)^(3/2)]",
)
_RECIPROCITY = Source(
    cite="OpenStax, University Physics Volume 2, §14.1 Mutual Inductance, after Eq. 14.2",
    url="https://openstax.org/books/university-physics-volume-2/pages/14-1-mutual-inductance",
    quote="we can show that M21 = M12",
)
_DIPOLE_COIL = Source(
    cite="N. Samboy, Am. J. Phys. (2023), doi:10.1119/5.0141862, Eq. (2)",
    url="https://arxiv.org/abs/2305.01813",
    quote="Φ_tot = N_c kπR²R_c² / [2(R_c² + z²)^(3/2)]",
)
_FLIP = Source(
    cite="J. Tatum, LibreTexts, Electricity and Magnetism, §10.4, Eq. 10.4.2",
    url="https://phys.libretexts.org/Bookshelves/Electricity_and_Magnetism/Electricity_and_Magnetism_(Tatum)/10%3A_Electromagnetic_Induction/10.04%3A_Search_Coils",
    quote="Q = NAB/(R+r)",
)
_FARADAY = Source(
    cite="OpenStax, University Physics Volume 2, §13.1 Faraday’s Law, Eq. 13.3",
    url="https://openstax.org/books/university-physics-volume-2/pages/13-1-faradays-law",
    quote="ε = −N dΦm/dt",
)
_BOWL = Source(
    cite="LibreTexts, General Physics I (Prince George's CC), §44.5 “Ball Rolling in a Bowl”, with β = 0 for a body that slides",
    url="https://phys.libretexts.org/Courses/Prince_Georges_Community_College/General_Physics_I%3A_Classical_Mechanics/44%3A_Rolling_Bodies/44.05%3A_Ball_Rolling_in_a_Bowl",
    quote="d²θ/dt² = −g/((β+1)(R−r)) sin θ",
)
_PERIOD = Source(
    cite="NIST Digital Library of Mathematical Functions, §22.19(i)",
    url="https://dlmf.nist.gov/22.19",
    quote="The period is 4K(sin(α/2))",
)
_BRAKE = Source(
    cite="N. Derby, S. Olbert, “Cylindrical Magnets and Ideal Solenoids”, Am. J. Phys. 78 (2010) 229, §IV.B, Eq. 28",
    url="https://arxiv.org/abs/0909.3880",
    quote="F_drag = −(v_z/R_L) ∫ B_ρ² dz′",
)
_ROD = Source(
    cite="OpenStax, University Physics Volume 2, §13.3 Motional Emf, Eq. 13.7",
    url="https://openstax.org/books/university-physics-volume-2/pages/13-3-motional-emf",
    quote="P = I²R = B²l²v²/R",
)
_FIELD_ENERGY = Source(
    cite="OpenStax, University Physics Volume 2, §14.3 Energy in a Magnetic Field, Eq. 14.22",
    url="https://openstax.org/books/university-physics-volume-2/pages/14-3-energy-in-a-magnetic-field",
    quote="U = ½LI²",
)

_EXHIBIT = engine.CoilExhibit()
_FREE = engine.CoilExhibit(track=engine.Track(rolling_resistance=0.0))
_OPEN = engine.CoilExhibit(track=engine.Track(rolling_resistance=0.0), idle=engine.Idle.OPEN)
#: A car a hundred times heavier on the page's own track: its speed hardly
#: changes in one pass, so the drop alone gives it.
_HEAVY = engine.CoilExhibit(track=engine.Track(car_mass_kg=15.0, rolling_resistance=0.0))
#: Halfway up the left ramp: where the page lets the car go.
_HALFWAY = -(_FREE.track.flat_length_m / 2 + _FREE.track.ramp_length_m / 2)


def _held_current(at_tau: float) -> float:
    """Plus held from the start, the car at rest at the top of a ramp, far from
    the coil: the current one sample after ``at_tau`` time constants."""
    run = engine.run(
        _EXHIBIT, engine.Scripted(((0.0, 1.0, engine.Press.PLUS),)), duration_s=0.05, start_x_m=-_EXHIBIT.track.end_m
    )
    tau = _EXHIBIT.coil.inductance_h / _EXHIBIT.coil.resistance_ohm
    j = min(range(len(run.t)), key=lambda n: abs(run.t[n] - at_tau * tau))
    return run.t[j], run.current_a[j]


def _rl_hand() -> float:
    t, _ = _held_current(4.0)
    tau = _EXHIBIT.coil.inductance_h / _EXHIBIT.coil.resistance_ohm
    return _EXHIBIT.supply_v / _EXHIBIT.coil.resistance_ohm * (1 - math.exp(-t / tau)) * 1000


def _wheeler_mh() -> float:
    """Wheeler's formula as printed: inches in, microhenries out."""
    a, b, n = _EXHIBIT.coil.mean_diameter_m / 2 / INCH_M, _EXHIBIT.coil.length_m / INCH_M, _EXHIBIT.coil.turns
    return a * a * n * n / (9 * a + 10 * b) / 1000


def _flux_by_turns(x: float = 0.0) -> float:
    """The magnet's flux through every turn with the car at ``x``, one loop at
    a time: a loop's field on its axis times the magnet's moment (reciprocity),
    summed over turns spread evenly along the coil."""
    m = _EXHIBIT.magnet.remanence_t * math.pi * (_EXHIBIT.magnet.diameter_m / 2) ** 2 * _EXHIBIT.magnet.length_m / MU0
    a, length, n = _EXHIBIT.coil.mean_diameter_m / 2, _EXHIBIT.coil.length_m, _EXHIBIT.coil.turns
    zs = (x - length / 2 + (j + 0.5) * length / n for j in range(n))
    return sum(MU0 * m * a * a / (2 * (a * a + z * z) ** 1.5) for z in zs)


_START_M = _HALFWAY


def _charge_in_uc() -> float:
    """The charge through the closed coil as the car rolls in from halfway up
    the ramp to the coil's centre: the run's current, sampled as the page
    draws it, by the trapezoid rule."""
    run = engine.run(_FREE, None, duration_s=3.0, start_x_m=_START_M)
    j = next(n for n in range(1, len(run.t)) if run.x_m[n] >= 0)
    q = sum(0.5 * (run.current_a[n - 1] + run.current_a[n]) * (run.t[n] - run.t[n - 1]) for n in range(1, j))
    part = -run.x_m[j - 1] / (run.x_m[j] - run.x_m[j - 1])
    at_centre = run.current_a[j - 1] + part * (run.current_a[j] - run.current_a[j - 1])
    q += 0.5 * (run.current_a[j - 1] + at_centre) * part * (run.t[j] - run.t[j - 1])
    return q * 1e6


def _charge_hand_uc() -> float:
    return -(_flux_by_turns() - _flux_by_turns(_START_M)) / _FREE.coil.resistance_ohm * 1e6


def _period_run() -> float:
    run = engine.run(_OPEN, None, duration_s=20.0)
    ups = [
        run.t[n] - run.x_m[n] * (run.t[n] - run.t[n - 1]) / (run.x_m[n] - run.x_m[n - 1])
        for n in range(1, len(run.t))
        if run.x_m[n - 1] < 0 <= run.x_m[n]
    ]
    return (ups[-1] - ups[0]) / (len(ups) - 1)


def _period_hand() -> float:
    """Two arcs, each half a pendulum's period at its amplitude, and the flat
    crossed twice at the speed the drop gives."""
    track = _OPEN.track
    theta0 = (track.ramp_length_m / 2) / track.ramp_radius_m
    v0 = math.sqrt(2 * G * track.ramp_radius_m * (1 - math.cos(theta0)))
    n, k = 20000, math.sin(theta0 / 2)
    h = math.pi / 2 / n
    big_k = h * sum(1 / math.sqrt(1 - (k * math.sin((j + 0.5) * h)) ** 2) for j in range(n))
    return 2 * (2 * math.sqrt(track.ramp_radius_m / G) * big_k) + 2 * track.flat_length_m / v0


def _brake_run_uj() -> float:
    """The energy the heavy car loses from halfway up the left ramp to its
    first turn on the right: its weight times the height it falls short."""
    run = engine.run(_HEAVY, None, duration_s=3.0, start_x_m=_HALFWAY)
    return _HEAVY.track.car_mass_kg * G * (engine.height(_HEAVY, _HALFWAY) - run.peaks_m[0]) * 1e6


def _brake_hand_uj() -> float:
    """(1/R)·∫k(x)²·v(x) dx over the pass, with k = dΨ/dx by central
    differences of the winding's flux and v from the drop alone,
    v = √(2g(h₀ − h(x))), by Simpson's rule from turn to turn."""
    ex = _HEAVY
    a, length, turns = ex.coil.mean_diameter_m / 2, ex.coil.length_m, ex.coil.turns
    m = ex.magnet.remanence_t * math.pi * (ex.magnet.diameter_m / 2) ** 2 * ex.magnet.length_m / MU0

    def psi(x: float) -> float:
        # The winding as a continuous sheet: the loop formula integrated along it.
        u1, u2 = x + length / 2, x - length / 2
        return MU0 * m * turns / (2 * length) * (u1 / math.sqrt(a * a + u1 * u1) - u2 / math.sqrt(a * a + u2 * u2))

    def k(x: float, d: float = 1e-6) -> float:
        return (psi(x + d) - psi(x - d)) / (2 * d)

    track = ex.track
    h0 = track.ramp_radius_m * (1 - math.cos((track.ramp_length_m / 2) / track.ramp_radius_m))

    def v(x: float) -> float:
        along = abs(x) - track.flat_length_m / 2
        h = track.ramp_radius_m * (1 - math.cos(along / track.ramp_radius_m)) if along > 0 else 0.0
        return math.sqrt(max(0.0, 2 * G * (h0 - h)))

    n = 20000
    h = 2 * -_HALFWAY / n
    total = sum(
        (1 if j in (0, n) else 4 if j % 2 else 2) * k(_HALFWAY + j * h) ** 2 * v(_HALFWAY + j * h) for j in range(n + 1)
    )
    return total * h / 3 / ex.coil.resistance_ohm * 1e6


def _account() -> engine.EnergyAccount:
    return engine.run(_EXHIBIT, engine.PressRule(), duration_s=10.0).energy


CASES: tuple[Case, ...] = (
    Case(
        key="rl_rise",
        unit="mA",
        expected=_rl_hand,
        measured=lambda: _held_current(4.0)[1] * 1000,
        tolerance=1e-5,
        sources=(_RL,),
        setting={"start_x_m": -_EXHIBIT.track.end_m},
    ),
    Case(
        key="wheeler",
        unit="mH",
        expected=_wheeler_mh,
        measured=lambda: _EXHIBIT.coil.inductance_h * 1000,
        # Wheeler's own accuracy; the SI form the engine uses is 0.28 % above
        # his formula as printed, whose 9 and 10 are rounded.
        tolerance=1e-2,
        sources=(_WHEELER,),
        setting={},
    ),
    Case(
        key="flux_centre",
        unit="Wb",
        expected=_flux_by_turns,
        measured=lambda: engine.flux_linkage(_EXHIBIT, 0.0),
        tolerance=1e-6,
        sources=(_LOOP, _RECIPROCITY, _DIPOLE_COIL),
        derived=True,
        setting={"start_x_m": 0.0},
    ),
    Case(
        key="charge",
        unit="µC",
        expected=_charge_hand_uc,
        measured=_charge_in_uc,
        # The coil's inductance still holds L·i/R at the centre (0.04 %), and
        # the trapezoid over 200 samples a second misses some 0.06 %.
        tolerance=2e-3,
        sources=(_FLIP, _FARADAY),
        derived=True,
        setting={"rolling_resistance": 0.0, "idle": "closed", "start_x_m": _HALFWAY},
    ),
    Case(
        key="period",
        unit="s",
        expected=_period_hand,
        measured=_period_run,
        tolerance=1e-5,
        sources=(_BOWL, _PERIOD),
        derived=True,
        setting={"rolling_resistance": 0.0, "idle": "open", "start_x_m": _HALFWAY},
    ),
    Case(
        key="brake",
        unit="µJ",
        expected=_brake_hand_uj,
        measured=_brake_run_uj,
        # The car still slows a little in the pass (it loses 0.06 % of its
        # energy), and the coil's inductance delays the current.
        tolerance=2e-3,
        sources=(_BRAKE, _ROD),
        derived=True,
        setting={"car_mass_kg": 15.0, "rolling_resistance": 0.0, "idle": "closed", "start_x_m": _HALFWAY},
    ),
    Case(
        key="energy_account",
        unit="mJ",
        expected=lambda: _account().battery_j * 1000,
        measured=lambda: (
            lambda e: (
                (e.heat_j + e.rolling_j + e.switching_j + e.end_stops_j + e.mechanical_change_j + e.field_change_j)
                * 1000
            )
        )(_account()),
        tolerance=1e-5,
        sources=(_FIELD_ENERGY, _RL),
        derived=True,
        setting={"autopilot": "on"},
    ),
)
