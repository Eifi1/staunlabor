"""The wire shape of the course (*Grundlagen*): what each lesson's widget sends
and what the engine answers.

The lessons-0–6 part of Kurvenschmiede's ``domain/schemas/dynamics.py``, field
for field and bound for bound, so the pages that moved with it send what they
sent there. Mirrors the dataclasses in ``domain/course/`` by name —
``tests/unit/test_course.py`` holds the pairs — with two additions of the
wire's own. A complex number is not JSON, so a pole or an eigenvalue travels as
``{re, im}`` (:data:`Cx`). And every input carries bounds: the widgets' sliders
stay well inside them, so a value outside is a typo or a script, and either is
better refused here with the field's name than computed. What the bounds cannot
catch alone (a step outside the range its lesson allows, a compensation record
longer than :data:`~staunlabor.domain.course.two_mass.MAX_SAMPLES`) the router or
the engine refuses with a ``ValueError``, which ``main.py`` answers as a 400 in
English, like the exhibits'; the reader only meets that sentence by typing past
a slider's range.
"""

from __future__ import annotations

from typing import Annotated, Any

from pydantic import BaseModel, BeforeValidator, Field, model_validator

from staunlabor.domain.course import (
    MAX_BLOCKS,
    MAX_SENSOR_STEPS,
    AnalogyKind,
    Block,
    BlockKind,
    Differentiator,
    EulerRegime,
    FilterMode,
    Lesson,
    OscillatorMethod,
    PortraitKind,
    Regime,
    TwoMassParameters,
)
from staunlabor.domain.schemas._base import _In, _Out


def _complex(value: Any) -> Any:
    if isinstance(value, complex):
        return {"re": value.real, "im": value.imag}
    return value


class ComplexOut(BaseModel):
    re: float
    im: float


#: A complex number on the wire.
Cx = Annotated[ComplexOut, BeforeValidator(_complex)]


#: A seed for the noisy exercises; any non-negative integer draws a curve.
_SEED = Field(ge=0, le=2**31 - 1, default=1)


# ── lesson 0 and 1 ───────────────────────────────────────────────────────────


class TankIn(_In):
    inflow_lps: float = Field(ge=0, le=1000)
    area_m2: float = Field(gt=0, le=100)
    outflow_lps_per_m: float = Field(gt=0, le=10_000)
    level0_m: float = Field(ge=0, le=100, default=0.0)


class TankRunOut(_Out):
    time_s: list[float]
    level_m: list[float]
    outflow_lps: list[float]
    inflow_lps: float
    time_constant_s: float
    level_final_m: float


class FirstOrderIn(_In):
    time_constant_s: float = Field(gt=0, le=1000)
    start: float = Field(ge=-1e6, le=1e6)
    final: float = Field(ge=-1e6, le=1e6)
    at_s: float = Field(ge=0, le=1e5)


class TauMarkOut(_Out):
    multiple: int
    time_s: float
    value: float
    fraction: float


class FirstOrderStepOut(_Out):
    time_s: list[float]
    value: list[float]
    remaining: list[float]
    marks: list[TauMarkOut]
    tangent_end_s: float
    at_s: float
    at_value: float
    at_fraction: float


class AnalogyOut(_Out):
    kind: AnalogyKind
    storage: float
    resistance: float
    time_constant_s: float


class FirstOrderLessonOut(BaseModel):
    """The step and its four analogies — one request, because the analogy
    switch relabels the same curve."""

    step: FirstOrderStepOut
    analogies: list[AnalogyOut]


class SeedIn(_In):
    seed: int = _SEED


class MeasurementOut(_Out):
    seed: int
    time_s: list[float]
    value: list[float]
    start: float
    final: float
    level_63: float
    time_constant_s: float
    noise: float


# ── lesson 2 ─────────────────────────────────────────────────────────────────


class SecondOrderIn(_In):
    """The shaft by its parts (``stiffness``, ``damping_coefficient``) or by its
    two numbers (``f0_hz``, ``damping_ratio``), the inertia given either way."""

    inertia: float = Field(gt=0, le=100)
    stiffness: float | None = Field(gt=0, le=1e8, default=None)
    damping_coefficient: float | None = Field(ge=0, le=1e6, default=None)
    f0_hz: float | None = Field(gt=0, le=10_000, default=None)
    damping_ratio: float | None = Field(ge=0, le=10, default=None)
    torque: float = Field(gt=0, le=1e6, default=10.0)
    excitation_hz: float = Field(gt=0, le=10_000, default=3.0)

    @model_validator(mode="after")
    def _one_description(self) -> SecondOrderIn:
        parts = self.stiffness is not None and self.damping_coefficient is not None
        numbers = self.f0_hz is not None and self.damping_ratio is not None
        if parts == numbers:
            raise ValueError("Describe the shaft by its stiffness and damping, or by f0 and D — one of the two.")
        return self


class OscillatorOut(_Out):
    inertia: float
    stiffness: float
    damping_coefficient: float
    f0_hz: float
    damping_ratio: float


class SecondOrderFiguresOut(_Out):
    w0: float
    f0_hz: float
    damping: float
    regime: Regime
    damped_w: float | None
    overshoot: float | None
    peak_time_s: float | None
    settling_time_s: float | None
    poles: list[Cx]


class SecondOrderStepOut(_Out):
    system: OscillatorOut
    figures: SecondOrderFiguresOut
    time_s: list[float]
    value: list[float]
    envelope_upper: list[float]
    envelope_lower: list[float]
    final_value: float
    peak_value: float | None


class MagnificationCurveOut(_Out):
    damping: float
    value: list[float]


class MagnificationOut(_Out):
    ratio: list[float]
    curves: list[MagnificationCurveOut]
    damping: float
    f0_hz: float
    excitation_hz: float
    excitation_ratio: float
    excitation_value: float | None
    error_pct: float | None
    phase_deg: float
    peak_ratio: float | None
    peak_value: float


class SecondOrderLessonOut(BaseModel):
    step: SecondOrderStepOut
    magnification: MagnificationOut


class PeakOut(_Out):
    time_s: float
    value: float


class PeakPairOut(_Out):
    first: int
    decrement: float
    damping: float


class DecayTestOut(_Out):
    seed: int
    time_s: list[float]
    value: list[float]
    peaks: list[PeakOut]
    pairs: list[PeakPairOut]
    overall_damping: float | None
    true_damping: float
    f0_hz: float
    noise: float


# ── lesson 3 ─────────────────────────────────────────────────────────────────


class ScalarIn(_In):
    rate: float = Field(ge=-20, le=5)


class ScalarGrowthOut(_Out):
    rate: float
    time_s: list[float]
    value: list[float]
    stable: bool
    time_constant_s: float | None
    doubling_time_s: float | None


class PolesIn(_In):
    """The pair by ``f0_hz`` and ``damping``, or by one dragged pole
    (``real``, ``imag`` in 1/s) — one of the two."""

    f0_hz: float | None = Field(gt=0, le=1000, default=None)
    damping: float | None = Field(ge=-0.3, le=1.5, default=None)
    real: float | None = Field(ge=-1e4, le=1e4, default=None)
    imag: float | None = Field(ge=-1e4, le=1e4, default=None)

    @model_validator(mode="after")
    def _one_description(self) -> PolesIn:
        numbers = self.f0_hz is not None and self.damping is not None
        pole = self.real is not None and self.imag is not None
        if numbers == pole:
            raise ValueError("Give f0 and D, or one pole — one of the two.")
        return self


class PolePairOut(_Out):
    f0_hz: float
    damping: float
    poles: list[Cx]
    real_part: float
    imag_hz: float
    stable: bool
    regime: Regime
    overshoot: float | None
    time_s: list[float]
    value: list[float]
    envelope_upper: list[float]
    envelope_lower: list[float]


class MatrixIn(_In):
    a11: float = Field(ge=-100, le=100)
    a12: float = Field(ge=-100, le=100)
    a21: float = Field(ge=-100, le=100)
    a22: float = Field(ge=-100, le=100)


class TrajectoryOut(_Out):
    x1: list[float]
    x2: list[float]


class EigenvectorOut(_Out):
    eigenvalue: float
    x1: float
    x2: float


class MatrixPortraitOut(_Out):
    matrix: list[list[float]]
    eigenvalues: list[Cx]
    eigenvectors: list[EigenvectorOut]
    kind: PortraitKind
    trace: float
    determinant: float
    horizon_s: float
    trajectories: list[TrajectoryOut]


# ── lesson 4 ─────────────────────────────────────────────────────────────────


class LaplaceIn(_In):
    time_constant_s: float = Field(gt=0, le=1000)
    gain: float = Field(ge=-1e3, le=1e3)
    step: float = Field(ge=-1e3, le=1e3)
    start: float = Field(ge=-1e3, le=1e3, default=0.0)


class LaplaceStepsOut(_Out):
    time_constant_s: float
    gain: float
    step: float
    start: float
    pole: float
    residue_zero: float
    residue_pole: float
    final_value: float
    time_s: list[float]
    value: list[float]


class BlockIn(_In):
    kind: BlockKind
    gain: float = Field(ge=-1e3, le=1e3, default=1.0)
    time_constant_s: float = Field(gt=0, le=1000, default=1.0)
    f0_hz: float = Field(gt=0, le=10_000, default=1.0)
    damping: float = Field(ge=0, le=10, default=0.5)
    dead_time_s: float = Field(ge=0, le=100, default=0.0)

    def to_domain(self) -> Block:
        return Block(**self.model_dump())


class BlockChainIn(_In):
    blocks: list[BlockIn] = Field(min_length=1, max_length=MAX_BLOCKS)
    cursor_hz: float = Field(gt=0, le=10_000)
    f_min_hz: float = Field(gt=0, le=1000, default=0.01)
    f_max_hz: float = Field(gt=0, le=1e5, default=1000.0)
    t_end_s: float | None = Field(gt=0, le=1000, default=None)

    @model_validator(mode="after")
    def _ascending(self) -> BlockChainIn:
        if self.f_max_hz <= self.f_min_hz:
            raise ValueError("The frequency range must ascend.")
        return self


class BlockCurveOut(_Out):
    magnitude_db: list[float]
    phase_deg: list[float]


class CursorOut(_Out):
    frequency_hz: float
    magnitude: float
    magnitude_db: float
    phase_deg: float
    delay_s: float


class ChainResponseOut(_Out):
    frequency_hz: list[float]
    magnitude_db: list[float]
    phase_deg: list[float]
    blocks: list[BlockCurveOut]
    poles: list[Cx]
    static_gain: float | None
    dead_time_s: float
    cursor: CursorOut
    time_s: list[float]
    step: list[float]


class FilterIn(_In):
    frequency_hz: float = Field(gt=0, le=100)
    corner_hz: float = Field(gt=0, le=1000)
    mode: FilterMode
    amplitude_deg: float = Field(gt=0, le=1000, default=30.0)
    stiffness_nm_per_deg: float = Field(ge=0, le=1e4, default=1.0)
    friction_nm: float = Field(ge=0, le=1e4, default=0.0)


class FilterLoopOut(_Out):
    frequency_hz: float
    corner_hz: float
    mode: FilterMode
    angle_deg: list[float]
    torque: list[float]
    measured_angle_deg: list[float]
    measured_torque: list[float]
    apparent_hysteresis: float
    true_hysteresis: float
    phase_lag_deg: float
    delay_s: float


# ── lesson 5 ─────────────────────────────────────────────────────────────────


class SensorRunIn(_In):
    time_constant_s: float = Field(gt=0, le=1000, default=4.0)
    start: float = Field(ge=-1e4, le=1e4, default=20.0)
    final: float = Field(ge=-1e4, le=1e4, default=80.0)
    step_s: float = Field(gt=0, le=1000)
    steps: int = Field(ge=1, le=MAX_SENSOR_STEPS)


class ErrorRowOut(_Out):
    time_s: float
    exact: float
    euler: float
    heun: float
    rk4: float


class Rk4StageOut(_Out):
    t: float
    y: list[float]
    slope: list[float]


class Rk4StepOut(_Out):
    t: float
    h: float
    y: list[float]
    stages: list[Rk4StageOut]
    y_next: list[float]


class SensorMethodsOut(_Out):
    time_constant_s: float
    step_s: float
    exact_time_s: list[float]
    exact: list[float]
    rows: list[ErrorRowOut]
    rk4_steps: list[Rk4StepOut]
    euler_factor: float
    rk4_factor: float
    regime: EulerRegime


class StepIn(_In):
    """One step size, in seconds — the oscillator's (0.1–5 ms) and the stiff
    pair's (1 ms–3 s) each bounded by their own ranges in the router."""

    step_s: float = Field(gt=0, le=10)


class MethodRunOut(_Out):
    method: OscillatorMethod
    time_s: list[float]
    angle_deg: list[float]
    amplitude_deg: list[float]
    final_amplitude_deg: float
    damping: float | None


class OscillatorMethodsOut(_Out):
    step_s: float
    f0_hz: float
    damping: float
    step_ratio: float
    euler_gain: float
    euler_neutral_step_s: float
    runs: list[MethodRunOut]


class StiffRunOut(_Out):
    time_s: list[float]
    fast: list[float]
    slow: list[float]
    stable: bool
    steps: int
    work: int


class StiffPairOut(_Out):
    step_s: float
    fast_time_constant_s: float
    slow_time_constant_s: float
    rk4_max_step_s: float
    rk4_min_steps: int
    exact_time_s: list[float]
    exact_slow: list[float]
    rk4: StiffRunOut
    implicit: StiffRunOut


# ── lesson 6 ─────────────────────────────────────────────────────────────────


class TwoMassParametersIn(_In):
    motor_inertia: float = Field(gt=0, le=10, default=0.01)
    adapter_inertia: float = Field(gt=0, le=10, default=0.05)
    shaft_stiffness: float = Field(gt=0, le=1e6, default=500.0)
    bar_stiffness: float = Field(gt=0, le=1e6, default=115.0)
    shaft_damping: float = Field(ge=0, le=1e3, default=0.2)
    bar_damping: float = Field(ge=0, le=1e3, default=0.3)

    def to_domain(self) -> TwoMassParameters:
        return TwoMassParameters(**self.model_dump())


class TwoMassRunIn(_In):
    parameters: TwoMassParametersIn
    excitation_hz: float = Field(gt=0, le=1000)


class PhasorOut(_Out):
    magnitude: float
    phase_deg: float


class ModeOut(_Out):
    eigenvalue: Cx
    frequency_hz: float
    damped_frequency_hz: float
    damping: float
    shape: list[float]
    reference: int
    phase_spread_deg: float


class ForcedPointOut(_Out):
    frequency_hz: float
    motor: PhasorOut
    adapter: PhasorOut
    ratio: PhasorOut
    in_phase: bool
    shaft_torque: PhasorOut
    bar_torque: PhasorOut
    reading_ratio: float | None
    error_pct: float | None


class TwoMassOut(_Out):
    parameters: TwoMassParametersIn
    modes: list[ModeOut]
    hand_estimate_hz: float
    hand_deviation_pct: float | None
    absorber_hz: float
    motor_still_hz: float
    frequency_hz: list[float]
    shaft_magnitude: list[float]
    bar_magnitude: list[float]
    point: ForcedPointOut


class CompensationRunIn(_In):
    parameters: TwoMassParametersIn
    excitation_hz: float = Field(gt=0, le=200)
    noise_rad: float = Field(ge=0, le=0.1)
    sample_rate_hz: float = Field(gt=0, le=20_000)
    differentiator: Differentiator
    corner_hz: float = Field(gt=0, le=10_000)
    seed: int = _SEED


class CompensationOut(_Out):
    frequency_hz: float
    sample_rate_hz: float
    time_s: list[float]
    bar_torque: list[float]
    shaft_torque: list[float]
    compensated: list[float]
    uncompensated_error: float
    compensated_error: float
    noise_torque: float


# ── the exercises and the defaults ───────────────────────────────────────────


class AnswerOut(_Out):
    value: float
    unit: str
    absolute: float | None
    relative: float | None


class ExerciseOut(_Out):
    key: str
    lesson: Lesson
    inputs: dict[str, float]
    answers: list[AnswerOut]
    estimate_first: bool


class CourseDefaultsOut(BaseModel):
    """Everything the lessons start from: the two-mass rig lesson 6 is written
    about, the exercises with their computed answers, and how long a slider must
    hold still before a request goes out (``settle_s``, from which the budget is
    derived)."""

    two_mass: TwoMassParametersIn
    exercises: list[ExerciseOut]
    settle_s: float
