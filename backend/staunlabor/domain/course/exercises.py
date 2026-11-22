"""The exercises' answers, computed from the numbers each exercise states.

An exercise is a sentence in seven catalogues with its numbers interpolated,
and an answer the reader's entry is held to. The answer is **computed here, from
the same inputs the sentence shows**, rather than written down beside it: a
written answer drifts the first time an input is corrected and nothing notices.
``tests/unit/test_course.py`` then holds every answer to the value the
specification printed, so a slip in either shows up as a failing test.

The tolerance is the specification's where it gave one, and a relative 2 %
otherwise — enough for a reader who rounds an intermediate result, not enough
for one who used the wrong formula.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from enum import StrEnum

from staunlabor.domain.course.chain import series_stiffness
from staunlabor.domain.course.lti import log_decrement, step_pt1
from staunlabor.domain.course.ode import euler


class Lesson(StrEnum):
    """The lessons, in the order a reader meets them: Kurvenschmiede's 0–6 and
    the cheat sheet. Its 7–10 (the reduction, the worm rig, the vacuum, the
    valve) stayed there with their exercises."""

    recipe = "recipe"
    first_order = "first_order"
    second_order = "second_order"
    eigenvalues = "eigenvalues"
    laplace = "laplace"
    numerics = "numerics"
    two_mass = "two_mass"
    cheat_sheet = "cheat_sheet"


@dataclass(frozen=True)
class Answer:
    """One number the reader enters: the value, its unit as the page shows it,
    and how close counts (``absolute`` in the unit, or ``relative``)."""

    value: float
    unit: str
    absolute: float | None = None
    relative: float | None = None


@dataclass(frozen=True)
class Exercise:
    """``key`` is the exercise's catalogue key and its id in the reader's
    progress; ``inputs`` are the numbers its sentence interpolates, by name."""

    key: str
    lesson: Lesson
    inputs: dict[str, float]
    answers: tuple[Answer, ...]
    estimate_first: bool = False


def _delay_ms(corner_hz: float, f_hz: float) -> tuple[float, float]:
    phase = -math.degrees(math.atan(f_hz / corner_hz))
    return phase, -phase / 360 / f_hz * 1000


def exercises() -> tuple[Exercise, ...]:
    """Every exercise, its answers computed now."""
    u11 = {"tau": 4.0, "start": 20.0, "final": 80.0, "t": 8.0}
    u21 = {"first": 10.0, "second": 7.3}
    u41 = {"corner": 50.0, "f": 5.0}
    u42 = {"corner": 5.0, "f": 3.0}
    u51 = {"tau": 4.0, "start": 20.0, "final": 80.0, "h": 1.0, "steps": 2.0}
    u52 = {"ratio": 0.1}
    u61 = {"j1": 0.01, "j2": 0.05, "c1": 500.0, "c2": 115.0}
    u62 = {"j2": 0.03, "c2": 115.0, "f": 3.0}

    euler_run = euler(
        lambda _t, y: ((u51["final"] - y[0]) / u51["tau"],), (u51["start"],), u51["h"], u51["h"] * u51["steps"]
    )
    phase42, delay42 = _delay_ms(u42["corner"], u42["f"])
    series = series_stiffness(u61["c1"], u61["c2"])
    f_a = math.sqrt(u62["c2"] / u62["j2"]) / (2 * math.pi)
    return (
        Exercise(
            "pt1_reading",
            Lesson.first_order,
            u11,
            (Answer(step_pt1(u11["t"], u11["tau"], u11["start"], u11["final"]), "°C", absolute=0.2),),
            estimate_first=True,
        ),
        Exercise(
            "decrement",
            Lesson.second_order,
            u21,
            (Answer(log_decrement(u21["first"], u21["second"])[1], "", absolute=0.002),),
        ),
        Exercise(
            "double_frequency",
            Lesson.second_order,
            {"factor": 2.0},
            (Answer(2.0**2, "×", absolute=0.01),),
            estimate_first=True,
        ),
        Exercise(
            "filter_delay",
            Lesson.laplace,
            u41,
            (Answer(_delay_ms(u41["corner"], u41["f"])[1], "ms", absolute=0.1),),
            estimate_first=True,
        ),
        Exercise(
            "filter_phase",
            Lesson.laplace,
            u42,
            (Answer(phase42, "°", absolute=0.5), Answer(delay42, "ms", absolute=0.5)),
        ),
        Exercise("euler_steps", Lesson.numerics, u51, (Answer(euler_run.states[0][-1], "°C", absolute=0.01),)),
        Exercise(
            "euler_gain",
            Lesson.numerics,
            u52,
            (Answer(abs(1 + 1j * u52["ratio"]), "", absolute=0.0005),),
            estimate_first=True,
        ),
        Exercise(
            "hand_estimate",
            Lesson.two_mass,
            u61,
            (Answer(math.sqrt(series / (u61["j1"] + u61["j2"])) / (2 * math.pi), "Hz", relative=0.02),),
            estimate_first=True,
        ),
        Exercise(
            "light_adapter",
            Lesson.two_mass,
            u62,
            (Answer((u62["f"] / f_a) ** 2 * 100, "%", absolute=0.5),),
            estimate_first=True,
        ),
    )
