"""Differential equations of technical systems: the engine of the course
(*Grundlagen*).

Lessons 0–6 of Kurvenschmiede's course and its cheat sheet moved here on
2026-11-20 (``docs/plan.md``, "The third stage"): the recipe, first order,
second order, eigenvalues and the pole plane, Laplace and Bode, numerics, and
the two-mass oscillator. Every number on their pages comes from here — pure
functions over floats and frozen dataclasses, the standard library only, like
the exhibits' engine. The course was written from the specification
"DGL-Lernapp – Spezifikation 1.0" (21.10.2026); every reference value it printed
for these lessons, and every exercise answer, was recomputed with SciPy before
the engine was written, and ``tests/unit/test_course.py`` holds the engine to
them — including the two the specification got wrong (G10: Euler at 1 ms keeps
the shaft at 1.00°, not 0.98°; G12: 7.63 Hz is the zero of the shaft torque,
not its minimum).

Its parts, bottom up. :mod:`linalg` solves small systems and finds eigenvalues
(balanced Hessenberg QR — the polynomial's roots are the wrong way to compute
them), :mod:`ode` holds the integrators the numerics lesson compares, :mod:`lti`
the transfer functions and the second-order shape everything returns to, and
:mod:`chain` the mass chains. Over those, one module per lesson:
:mod:`first_order` (lessons 0 and 1), :mod:`second_order`, :mod:`eigen`,
:mod:`frequency`, :mod:`numerics` and :mod:`two_mass`; :mod:`exercises`
computes every exercise's answer from its stated inputs.

What it is not: a general simulator, and not the rest of Kurvenschmiede's
course. Lessons 7–10 (the reduction, the worm rig, the vacuum, the valve) and
its explorer stay there, with their own copy of everything shared, and link
here for the basics. Nothing under ``domain/experiments`` or ``domain/checks``
imports this package: an exhibit's admin check holds for the fingerprint of its
engine modules and whatever they import, so an import from here would make
every change to the course uncheck that exhibit
(``tests/unit/test_course.py`` holds the boundary).
"""

from staunlabor.domain.course.chain import Chain, Ground, Mode, forced, matrices, modes, series_stiffness
from staunlabor.domain.course.eigen import (
    Eigenvector,
    MatrixPortrait,
    PolePair,
    PortraitKind,
    ScalarGrowth,
    Trajectory,
    matrix_portrait,
    pole_from,
    pole_pair,
    scalar_growth,
)
from staunlabor.domain.course.exercises import Answer, Exercise, Lesson, exercises
from staunlabor.domain.course.first_order import (
    Analogy,
    AnalogyKind,
    FirstOrderStep,
    Measurement,
    TankRun,
    TauMark,
    analogies,
    first_order_measurement,
    first_order_step,
    tank,
)
from staunlabor.domain.course.frequency import (
    MAX_BLOCKS,
    Block,
    BlockCurve,
    BlockKind,
    ChainResponse,
    Cursor,
    FilterLoop,
    FilterMode,
    LaplaceSteps,
    chain_response,
    filter_loop,
    laplace_steps,
)
from staunlabor.domain.course.linalg import eigenvalues, expm, solve
from staunlabor.domain.course.lti import (
    Regime,
    SecondOrderFigures,
    Tf,
    log_decrement,
    magnification,
    response,
    second_order_figures,
    series,
    step_pt2,
)
from staunlabor.domain.course.numerics import (
    ErrorRow,
    EulerRegime,
    MethodRun,
    OscillatorMethod,
    OscillatorMethods,
    SensorMethods,
    StiffPair,
    StiffRun,
    oscillator_methods,
    sensor_methods,
    stiff_pair,
)
from staunlabor.domain.course.ode import Rk4Stage, Rk4Step, Trace, euler, heun, rk4, rk4_step
from staunlabor.domain.course.second_order import (
    DecayTest,
    Magnification,
    MagnificationCurve,
    Oscillator,
    Peak,
    PeakPair,
    SecondOrderStep,
    decay_test,
    magnification_at,
    oscillator,
    second_order_step,
)
from staunlabor.domain.course.two_mass import (
    Compensation,
    Differentiator,
    ForcedPoint,
    Phasor,
    TwoMass,
    TwoMassParameters,
    mass_compensation,
    two_mass,
)

__all__ = [
    "MAX_BLOCKS",
    "Analogy",
    "AnalogyKind",
    "Answer",
    "Block",
    "BlockCurve",
    "BlockKind",
    "Chain",
    "ChainResponse",
    "Compensation",
    "Cursor",
    "DecayTest",
    "Differentiator",
    "Eigenvector",
    "ErrorRow",
    "EulerRegime",
    "Exercise",
    "FilterLoop",
    "FilterMode",
    "FirstOrderStep",
    "ForcedPoint",
    "Ground",
    "LaplaceSteps",
    "Lesson",
    "Magnification",
    "MagnificationCurve",
    "MatrixPortrait",
    "Measurement",
    "MethodRun",
    "Mode",
    "Oscillator",
    "OscillatorMethod",
    "OscillatorMethods",
    "Peak",
    "PeakPair",
    "Phasor",
    "PolePair",
    "PortraitKind",
    "Regime",
    "Rk4Stage",
    "Rk4Step",
    "ScalarGrowth",
    "SecondOrderFigures",
    "SecondOrderStep",
    "SensorMethods",
    "StiffPair",
    "StiffRun",
    "TankRun",
    "TauMark",
    "Tf",
    "Trace",
    "Trajectory",
    "TwoMass",
    "TwoMassParameters",
    "analogies",
    "chain_response",
    "decay_test",
    "eigenvalues",
    "euler",
    "exercises",
    "expm",
    "filter_loop",
    "first_order_measurement",
    "first_order_step",
    "forced",
    "heun",
    "laplace_steps",
    "log_decrement",
    "magnification",
    "magnification_at",
    "mass_compensation",
    "matrices",
    "matrix_portrait",
    "modes",
    "oscillator",
    "oscillator_methods",
    "pole_from",
    "pole_pair",
    "response",
    "rk4",
    "rk4_step",
    "scalar_growth",
    "second_order_figures",
    "second_order_step",
    "sensor_methods",
    "series",
    "series_stiffness",
    "solve",
    "step_pt2",
    "stiff_pair",
    "tank",
    "two_mass",
]
