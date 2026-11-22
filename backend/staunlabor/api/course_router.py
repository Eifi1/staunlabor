"""The course (*Grundlagen*): lessons 0–6 on differential equations, one route
per widget.

Unauthenticated, as the whole site is, and for the same reason: it holds no
data, reads nothing and writes nothing — numbers come in, curves go out — and a
course is something anybody should be able to open. The routes are
Kurvenschmiede's ``/dynamics/...`` ones for these lessons, the same requests and
answers under ``/course``, so the pages that moved with them send what they sent
there. Its lessons 7–10 and its explorer stayed there, and with them the two
time simulations (the valve, the park cycle) and their budget: nothing here runs
longer than a slider can wait for.

The handlers are ``def``, not ``async def``: each is pure Python with nothing to
await, and an ``async`` handler would run it on the event loop and stall every
other request for its length. ``defaults`` alone is ``async``: it builds a few
models. The dearest routes are the numerics lesson's oscillator at its finest
step (ten thousand steps of three integrators) and its stiff pair at a
millisecond (thirty thousand), some fifty milliseconds each, and the
compensation at its cap (``two_mass.MAX_SAMPLES``, the slider's 10 kHz at 1 Hz),
some hundred and thirty — inside the two hundred the budget is sized for.

Every route but ``defaults`` spends the exhibits' budget,
:data:`~staunlabor.security.EXPERIMENT_RUNS`, per address
(``security.limit_run``): one budget for every calculation, so an
address cannot double what it makes the server compute by asking two pages
instead of one. A 429 says the seconds in its body.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends

from staunlabor.domain.course import (
    TwoMassParameters,
    analogies,
    chain_response,
    decay_test,
    exercises,
    filter_loop,
    first_order_measurement,
    first_order_step,
    laplace_steps,
    magnification_at,
    mass_compensation,
    matrix_portrait,
    oscillator,
    oscillator_methods,
    pole_from,
    pole_pair,
    scalar_growth,
    second_order_step,
    sensor_methods,
    stiff_pair,
    tank,
    two_mass,
)
from staunlabor.domain.schemas.course import (
    BlockChainIn,
    ChainResponseOut,
    CompensationOut,
    CompensationRunIn,
    CourseDefaultsOut,
    DecayTestOut,
    ExerciseOut,
    FilterIn,
    FilterLoopOut,
    FirstOrderIn,
    FirstOrderLessonOut,
    LaplaceIn,
    LaplaceStepsOut,
    MatrixIn,
    MatrixPortraitOut,
    MeasurementOut,
    OscillatorMethodsOut,
    PolePairOut,
    PolesIn,
    ScalarGrowthOut,
    ScalarIn,
    SecondOrderIn,
    SecondOrderLessonOut,
    SeedIn,
    SensorMethodsOut,
    SensorRunIn,
    StepIn,
    StiffPairOut,
    TankIn,
    TankRunOut,
    TwoMassOut,
    TwoMassParametersIn,
    TwoMassRunIn,
)
from staunlabor.security import PAGE_SETTLE_S, limit_run

router = APIRouter(prefix="/course", tags=["course"])

#: The oscillator lesson's step range, seconds: a tenth of a millisecond (ten
#: thousand steps a method) to five, where Euler has long since run away.
OSCILLATOR_STEPS = (1e-4, 5e-3)
#: The stiff pair's: a millisecond (thirty thousand steps over the thirty
#: seconds) to three seconds.
STIFF_STEPS = (1e-3, 3.0)


def _within(value: float, bounds: tuple[float, float], what: str) -> None:
    lo, hi = bounds
    if not lo <= value <= hi:
        raise ValueError(f"The {what} must lie between {lo:g} and {hi:g} s.")


@router.get("/defaults", response_model=CourseDefaultsOut)
async def defaults() -> CourseDefaultsOut:
    return CourseDefaultsOut(
        two_mass=TwoMassParametersIn.model_validate(TwoMassParameters()),
        exercises=[ExerciseOut.model_validate(e) for e in exercises()],
        settle_s=PAGE_SETTLE_S,
    )


# ── lessons 0–2 ──────────────────────────────────────────────────────────────


@router.post("/tank", response_model=TankRunOut, dependencies=[Depends(limit_run)])
def tank_fill(payload: TankIn) -> TankRunOut:
    return TankRunOut.model_validate(tank(**payload.model_dump()))


@router.post("/first-order", response_model=FirstOrderLessonOut, dependencies=[Depends(limit_run)])
def first_order(payload: FirstOrderIn) -> FirstOrderLessonOut:
    return FirstOrderLessonOut.model_validate(
        {
            "step": first_order_step(**payload.model_dump()),
            "analogies": analogies(payload.time_constant_s),
        },
        from_attributes=True,
    )


@router.post("/first-order/measurement", response_model=MeasurementOut, dependencies=[Depends(limit_run)])
def measurement(payload: SeedIn) -> MeasurementOut:
    return MeasurementOut.model_validate(first_order_measurement(payload.seed))


@router.post("/second-order", response_model=SecondOrderLessonOut, dependencies=[Depends(limit_run)])
def second_order(payload: SecondOrderIn) -> SecondOrderLessonOut:
    system = oscillator(
        payload.inertia,
        stiffness=payload.stiffness,
        damping_coefficient=payload.damping_coefficient,
        f0_hz=payload.f0_hz,
        damping_ratio=payload.damping_ratio,
    )
    return SecondOrderLessonOut.model_validate(
        {
            "step": second_order_step(system, payload.torque),
            "magnification": magnification_at(system, payload.excitation_hz),
        },
        from_attributes=True,
    )


@router.post("/second-order/decay", response_model=DecayTestOut, dependencies=[Depends(limit_run)])
def decay(payload: SeedIn) -> DecayTestOut:
    return DecayTestOut.model_validate(decay_test(payload.seed))


# ── lesson 3 ─────────────────────────────────────────────────────────────────


@router.post("/eigen/scalar", response_model=ScalarGrowthOut, dependencies=[Depends(limit_run)])
def eigen_scalar(payload: ScalarIn) -> ScalarGrowthOut:
    return ScalarGrowthOut.model_validate(scalar_growth(payload.rate))


@router.post("/eigen/poles", response_model=PolePairOut, dependencies=[Depends(limit_run)])
def eigen_poles(payload: PolesIn) -> PolePairOut:
    if payload.real is not None and payload.imag is not None:
        f0, damping = pole_from(payload.real, payload.imag)
        # A pole dragged far into the right half-plane would draw a step
        # response of 10²⁰; the drag is held to what the slider allows.
        damping = max(-0.3, min(1.5, damping))
        f0 = max(0.5, min(100.0, f0))
    else:
        assert payload.f0_hz is not None and payload.damping is not None  # the schema says so
        f0, damping = payload.f0_hz, payload.damping
    return PolePairOut.model_validate(pole_pair(f0, damping))


@router.post("/eigen/matrix", response_model=MatrixPortraitOut, dependencies=[Depends(limit_run)])
def eigen_matrix(payload: MatrixIn) -> MatrixPortraitOut:
    return MatrixPortraitOut.model_validate(matrix_portrait(**payload.model_dump()))


# ── lesson 4 ─────────────────────────────────────────────────────────────────


@router.post("/laplace", response_model=LaplaceStepsOut, dependencies=[Depends(limit_run)])
def laplace(payload: LaplaceIn) -> LaplaceStepsOut:
    return LaplaceStepsOut.model_validate(laplace_steps(**payload.model_dump()))


@router.post("/laplace/chain", response_model=ChainResponseOut, dependencies=[Depends(limit_run)])
def laplace_chain(payload: BlockChainIn) -> ChainResponseOut:
    return ChainResponseOut.model_validate(
        chain_response(
            [b.to_domain() for b in payload.blocks],
            payload.cursor_hz,
            payload.f_min_hz,
            payload.f_max_hz,
            payload.t_end_s,
        )
    )


@router.post("/laplace/filter-loop", response_model=FilterLoopOut, dependencies=[Depends(limit_run)])
def laplace_filter_loop(payload: FilterIn) -> FilterLoopOut:
    return FilterLoopOut.model_validate(filter_loop(**payload.model_dump()))


# ── lesson 5 ─────────────────────────────────────────────────────────────────


@router.post("/numerics/sensor", response_model=SensorMethodsOut, dependencies=[Depends(limit_run)])
def numerics_sensor(payload: SensorRunIn) -> SensorMethodsOut:
    return SensorMethodsOut.model_validate(sensor_methods(**payload.model_dump()))


@router.post("/numerics/oscillator", response_model=OscillatorMethodsOut, dependencies=[Depends(limit_run)])
def numerics_oscillator(payload: StepIn) -> OscillatorMethodsOut:
    _within(payload.step_s, OSCILLATOR_STEPS, "step")
    return OscillatorMethodsOut.model_validate(oscillator_methods(payload.step_s))


@router.post("/numerics/stiff", response_model=StiffPairOut, dependencies=[Depends(limit_run)])
def numerics_stiff(payload: StepIn) -> StiffPairOut:
    _within(payload.step_s, STIFF_STEPS, "step")
    return StiffPairOut.model_validate(stiff_pair(payload.step_s))


# ── lesson 6 ─────────────────────────────────────────────────────────────────


@router.post("/two-mass", response_model=TwoMassOut, dependencies=[Depends(limit_run)])
def two_mass_rig(payload: TwoMassRunIn) -> TwoMassOut:
    return TwoMassOut.model_validate(two_mass(payload.parameters.to_domain(), payload.excitation_hz))


@router.post("/two-mass/compensation", response_model=CompensationOut, dependencies=[Depends(limit_run)])
def two_mass_compensation(payload: CompensationRunIn) -> CompensationOut:
    return CompensationOut.model_validate(
        mass_compensation(
            payload.parameters.to_domain(),
            payload.excitation_hz,
            payload.noise_rad,
            payload.sample_rate_hz,
            payload.differentiator,
            payload.corner_hz,
            payload.seed,
        )
    )
