"""The exhibits' figures and curves, one route each.

Unauthenticated, as the whole site is: it holds no data, reads nothing and
writes nothing, and an exhibit is something anybody should be able to open.

What is **not** here is any exhibit's time simulation. The ball in the sphere,
the car on its ramps, the platform, the elephant's ball, the smoke ring and the
ball cannon answer a hand sixty times a second, which no round trip can, so the
pages run them in the browser (``frontend/src/features/experiments/simulate/``),
the engine's steps ported and held to it by ``tests/unit/test_experiments_browser.py``.
What the server answers is what a slider changes: the orbits and the swing for
a sphere, the flux and its slope for a coil, the three boxes for the chair, the
spins and the curves of the platform, the six tracks and the valley of the race,
the float height, the curves and the tilt limit of the elephant's ball, the
window of the smoke ring, how high the ball cannon's top ball goes for one, two
and three balls — each a millisecond or a few, the race some twenty, the
elephant, the smoke ring and the cannon up to two hundred.

The handlers are ``def``: pure Python with nothing to await would stall the
event loop as ``async``. All but ``defaults``, which builds a few models. Every
route but ``defaults`` spends :data:`~staunlabor.security.EXPERIMENT_RUNS` per
address; a 429 says the seconds in its body.
"""

from __future__ import annotations

from eifi1_server_kit.limiter import charge
from fastapi import APIRouter, Depends, Request

from staunlabor.domain.experiments import (
    METER_RANGE_A,
    Ball,
    BallStack,
    Body,
    Coil,
    CoilExhibit,
    Drum,
    Elephant,
    FloatingBall,
    Jet,
    Magnet,
    Platform,
    Race,
    Room,
    SmokeExhibit,
    Sphere,
    Track,
    cannon_figures,
    chair_analysis,
    coil_analysis,
    elephant_figures,
    platform_figures,
    race_valley,
    run_race,
    smoke_figures,
    sphere_figures,
)
from staunlabor.domain.schemas.experiments import (
    BallStackIn,
    BodyIn,
    CannonFiguresOut,
    ChairAnalysisOut,
    CoilAnalysisOut,
    CoilExhibitIn,
    ElephantFiguresOut,
    ElephantIn,
    ExperimentsDefaultsOut,
    PlatformExhibitIn,
    PlatformFiguresOut,
    PlatformIn,
    RaceAnalysisOut,
    RaceIn,
    SmokeExhibitIn,
    SmokeFiguresOut,
    SphereFiguresOut,
    SphereIn,
)
from staunlabor.security import PAGE_SETTLE_S, caller_address

router = APIRouter(prefix="/experiments", tags=["experiments"])


def limit_run(request: Request) -> None:
    """Spend one of this address's attempts, or refuse with the wait."""
    charge(
        request.app.state.experiments_limiters.runs,
        caller_address(request),
        lambda seconds: f"Too many calculations from this address. Try again in {seconds} seconds.",
    )


def _exhibit(payload: CoilExhibitIn) -> CoilExhibit:
    return CoilExhibit(
        magnet=Magnet(**payload.magnet.model_dump()),
        coil=Coil(**payload.coil.model_dump()),
        track=Track(**payload.track.model_dump()),
        supply_v=payload.supply_v,
        idle=payload.idle,
    )


@router.get("/defaults", response_model=ExperimentsDefaultsOut)
async def defaults() -> ExperimentsDefaultsOut:
    return ExperimentsDefaultsOut(
        sphere=SphereIn.model_validate(Sphere()),
        coil=CoilExhibitIn.model_validate(CoilExhibit()),
        platform=PlatformExhibitIn(body=BodyIn.model_validate(Body()), platform=PlatformIn.model_validate(Platform())),
        race=RaceIn.model_validate(Race()),
        elephant=ElephantIn.model_validate(Elephant()),
        smoke=SmokeExhibitIn.model_validate(SmokeExhibit()),
        cannon=BallStackIn.model_validate(BallStack()),
        meter_range_a=METER_RANGE_A,
        settle_s=PAGE_SETTLE_S,
    )


@router.post("/sphere", response_model=SphereFiguresOut, dependencies=[Depends(limit_run)])
def sphere(payload: SphereIn) -> SphereFiguresOut:
    return SphereFiguresOut.model_validate(sphere_figures(Sphere(**payload.model_dump())))


@router.post("/coil", response_model=CoilAnalysisOut, dependencies=[Depends(limit_run)])
def coil(payload: CoilExhibitIn) -> CoilAnalysisOut:
    return CoilAnalysisOut.model_validate(coil_analysis(_exhibit(payload)))


@router.get("/chair", response_model=ChairAnalysisOut, dependencies=[Depends(limit_run)])
def chair() -> ChairAnalysisOut:
    return ChairAnalysisOut.model_validate(chair_analysis())


@router.post("/platform", response_model=PlatformFiguresOut, dependencies=[Depends(limit_run)])
def platform(payload: PlatformExhibitIn) -> PlatformFiguresOut:
    return PlatformFiguresOut.model_validate(
        platform_figures(Body(**payload.body.model_dump()), Platform(**payload.platform.model_dump()))
    )


@router.post("/race", response_model=RaceAnalysisOut, dependencies=[Depends(limit_run)])
def race(payload: RaceIn) -> RaceAnalysisOut:
    spec = Race(**payload.model_dump())
    return RaceAnalysisOut.model_validate(
        {"race": run_race(spec), "valley": race_valley(spec.ball)}, from_attributes=True
    )


@router.post("/elephant", response_model=ElephantFiguresOut, dependencies=[Depends(limit_run)])
def elephant(payload: ElephantIn) -> ElephantFiguresOut:
    spec = Elephant(
        jet=Jet(**payload.jet.model_dump()), ball=FloatingBall(**payload.ball.model_dump()), coanda=payload.coanda
    )
    return ElephantFiguresOut.model_validate(elephant_figures(spec))


@router.post("/smoke", response_model=SmokeFiguresOut, dependencies=[Depends(limit_run)])
def smoke(payload: SmokeExhibitIn) -> SmokeFiguresOut:
    spec = SmokeExhibit(drum=Drum(**payload.drum.model_dump()), room=Room(**payload.room.model_dump()))
    return SmokeFiguresOut.model_validate(smoke_figures(spec))


@router.post("/cannon", response_model=CannonFiguresOut, dependencies=[Depends(limit_run)])
def cannon(payload: BallStackIn) -> CannonFiguresOut:
    spec = BallStack(
        balls=tuple(Ball(**ball.model_dump()) for ball in payload.balls),
        drop_m=payload.drop_m,
        gap_m=payload.gap_m,
        floor_restitution=payload.floor_restitution,
        ball_restitution=payload.ball_restitution,
        youngs_mpa=payload.youngs_mpa,
    )
    return CannonFiguresOut.model_validate(cannon_figures(spec))
