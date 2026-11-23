"""The exhibits' figures and curves, one route each.

Unauthenticated, as the whole site is: it holds no data, reads nothing and
writes nothing, and an exhibit is something anybody should be able to open.

What is **not** here is any exhibit's time simulation: those answer a hand
sixty times a second, which no round trip can, so the pages run them in the
browser (``frontend/src/features/experiments/simulate/``), the engine's steps
ported and held to it by ``tests/unit/test_experiments_browser.py``. What the
server answers is what a slider changes, for the exhibits whose figures are
worth a round trip; most exhibits have no route, and their pages compute in the
browser from ``/defaults`` alone. Each route costs a millisecond to a couple of hundred, the
Chladni plate's driven modes (the same for every plate) two seconds once a
process and nothing after.

The handlers are ``def``: pure Python with nothing to await would stall the
event loop as ``async``. All but ``defaults``, which builds a few models. Every
route but ``defaults`` spends :data:`~staunlabor.security.EXPERIMENT_RUNS` per
address; a 429 says the seconds in its body.
"""

from __future__ import annotations

from dataclasses import asdict

from fastapi import APIRouter, Depends

from staunlabor.domain.experiments import (
    BLOCK_HEIGHT_M,
    BLOCK_LENGTH_M,
    EXHIBIT_BLOCKS,
    EXHIBIT_HEIGHT_M,
    EXHIBIT_PLATES,
    GALTON_BALLS,
    GALTON_LEVEL,
    GALTON_ROWS,
    GALTON_SEED,
    GLASS_BEAD,
    METER_RANGE_A,
    STEEL,
    TABLE_TENNIS,
    WATER_DROP,
    BallStack,
    Body,
    Bottle,
    Carousel,
    ChladniPlate,
    Circuit,
    CoilExhibit,
    ConeExhibit,
    CoupledPendulums,
    Cradle,
    Diver,
    DoublePendulum,
    DrainingVessel,
    Elephant,
    FilmRings,
    Fork,
    FoucaultPendulum,
    Funnel,
    GyroWheel,
    Harmonograph,
    LevitationBase,
    LevitationTop,
    MagnetColumn,
    MaxwellWheel,
    Metronomes,
    PegPendulum,
    PendulumWave,
    Plate,
    Platform,
    Race,
    ResonanceRack,
    Rider,
    SkyTube,
    Slits,
    SmokeExhibit,
    Sphere,
    StoneArch,
    StringCord,
    Vessel,
    WaterWheel,
    cannon_figures,
    chair_analysis,
    chladni_driven_modes,
    coil_analysis,
    elephant_figures,
    platform_figures,
    race_valley,
    run_race,
    smoke_figures,
    sphere_figures,
    wave_figures,
)
from staunlabor.domain.experiments.chladni import DEGREE as CHLADNI_DEGREE
from staunlabor.domain.experiments.jet import Jet as WaterJet
from staunlabor.domain.experiments.kapitza import KapitzaPendulum
from staunlabor.domain.experiments.polarizer import POLAROID
from staunlabor.domain.experiments.ship import DAMPING_PER_S as SHIP_DAMPING
from staunlabor.domain.experiments.ship import Hull as ShipHull
from staunlabor.domain.experiments.ship import Weight as ShipWeight
from staunlabor.domain.experiments.spring import WilberforceSpring
from staunlabor.domain.schemas.experiments import (
    BallStackIn,
    BeatsIn,
    BodyIn,
    BounceIn,
    CannonFiguresOut,
    CarouselIn,
    ChairAnalysisOut,
    ChladniModeOut,
    ChladniModesOut,
    ChladniPlateIn,
    CircuitIn,
    CoilAnalysisOut,
    CoilExhibitIn,
    ConeExhibitIn,
    CoupledPendulumsIn,
    CradleIn,
    DiverExhibitIn,
    DoublePendulumIn,
    DrainingVesselIn,
    ElephantFiguresOut,
    ElephantIn,
    ExperimentsDefaultsOut,
    FilmIn,
    FoucaultPendulumIn,
    FunnelIn,
    GaltonIn,
    GyroWheelIn,
    HarmonographIn,
    KapitzaPendulumIn,
    LevitationIn,
    MaxwellWheelIn,
    MetronomesIn,
    OverhangIn,
    PegPendulumIn,
    PlatesIn,
    PlatformExhibitIn,
    PlatformFiguresOut,
    PlatformIn,
    PolarizerSheetIn,
    RaceAnalysisOut,
    RaceIn,
    RainbowIn,
    ResonanceRackIn,
    ShipIn,
    SkyTubeIn,
    SlitsIn,
    SmokeExhibitIn,
    SmokeFiguresOut,
    SphereFiguresOut,
    SphereIn,
    StoneArchIn,
    StringCordIn,
    VesselIn,
    WaterJetIn,
    WaterWheelIn,
    WaveFiguresOut,
    WaveIn,
    WilberforceSpringIn,
)
from staunlabor.security import PAGE_SETTLE_S, limit_run

router = APIRouter(prefix="/experiments", tags=["experiments"])


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
        wave=WaveIn.model_validate(PendulumWave()),
        harmonograph=HarmonographIn.model_validate(Harmonograph()),
        cone=ConeExhibitIn.model_validate(ConeExhibit()),
        parabola=VesselIn.model_validate(Vessel()),
        coupled=CoupledPendulumsIn.model_validate(CoupledPendulums()),
        peg=PegPendulumIn.model_validate(PegPendulum()),
        maxwell=MaxwellWheelIn.model_validate(MaxwellWheel()),
        chaos=DoublePendulumIn.model_validate(DoublePendulum()),
        kapitza=KapitzaPendulumIn.model_validate(KapitzaPendulum()),
        waterwheel=WaterWheelIn.model_validate(WaterWheel()),
        foucault=FoucaultPendulumIn.model_validate(FoucaultPendulum()),
        coriolis=CarouselIn.model_validate(Carousel()),
        cradle=CradleIn.model_validate(Cradle()),
        well=FunnelIn.model_validate(Funnel()),
        resonance=ResonanceRackIn.model_validate(ResonanceRack()),
        gyroscope=GyroWheelIn.model_validate(GyroWheel()),
        arch=StoneArchIn.model_validate(StoneArch()),
        levitation=LevitationIn.model_validate({"base": asdict(LevitationBase()), "top": asdict(LevitationTop())}),
        circuit=CircuitIn.model_validate(Circuit()),
        plates=PlatesIn.model_validate(
            {"column": asdict(MagnetColumn()), "exhibit": [asdict(p) for p in EXHIBIT_PLATES], "plate": asdict(Plate())}
        ),
        vessel=DrainingVesselIn.model_validate(DrainingVessel()),
        bounce=BounceIn.model_validate({"balls": [asdict(STEEL), asdict(TABLE_TENNIS)], "height_m": EXHIBIT_HEIGHT_M}),
        overhang=OverhangIn(blocks=EXHIBIT_BLOCKS, length_m=BLOCK_LENGTH_M, height_m=BLOCK_HEIGHT_M),
        galton=GaltonIn(rows=GALTON_ROWS, p=GALTON_LEVEL, balls=GALTON_BALLS, seed=GALTON_SEED),
        film=FilmIn.model_validate(FilmRings()),
        diver=DiverExhibitIn.model_validate({"diver": asdict(Diver()), "depth_m": Bottle().depth_m}),
        ship=ShipIn.model_validate(
            {"hull": asdict(ShipHull()), "weight": asdict(ShipWeight()), "damping_per_s": SHIP_DAMPING}
        ),
        rainbow=RainbowIn.model_validate({"glass": asdict(GLASS_BEAD), "water": asdict(WATER_DROP)}),
        sky=SkyTubeIn.model_validate(SkyTube()),
        slits=SlitsIn.model_validate(Slits()),
        polarizer=PolarizerSheetIn.model_validate(POLAROID),
        jet=WaterJetIn.model_validate(WaterJet()),
        beats=BeatsIn.model_validate({"fork": asdict(Fork()), "rider": asdict(Rider())}),
        spring=WilberforceSpringIn.model_validate(WilberforceSpring()),
        metronomes=MetronomesIn.model_validate(Metronomes()),
        string=StringCordIn.model_validate(StringCord()),
        chladni=ChladniPlateIn.model_validate(ChladniPlate()),
        meter_range_a=METER_RANGE_A,
        settle_s=PAGE_SETTLE_S,
    )


@router.post("/sphere", response_model=SphereFiguresOut, dependencies=[Depends(limit_run)])
def sphere(payload: SphereIn) -> SphereFiguresOut:
    return SphereFiguresOut.model_validate(sphere_figures(Sphere(**payload.model_dump())))


@router.post("/coil", response_model=CoilAnalysisOut, dependencies=[Depends(limit_run)])
def coil(payload: CoilExhibitIn) -> CoilAnalysisOut:
    return CoilAnalysisOut.model_validate(coil_analysis(payload.to_domain()))


@router.get("/chair", response_model=ChairAnalysisOut, dependencies=[Depends(limit_run)])
def chair() -> ChairAnalysisOut:
    return ChairAnalysisOut.model_validate(chair_analysis())


@router.get("/chladni", response_model=ChladniModesOut, dependencies=[Depends(limit_run)])
def chladni() -> ChladniModesOut:
    """The plate's driven modes: the same for every plate (its size and steel
    only scale the tones), computed once a process — two seconds the first
    time, nothing after."""
    driven = chladni_driven_modes()
    return ChladniModesOut(
        degree=CHLADNI_DEGREE,
        modes=[
            ChladniModeOut(
                lam=mode.lam,
                m=[m for m, _, _ in mode.terms],
                n=[n for _, n, _ in mode.terms],
                c=[c for _, _, c in mode.terms],
            )
            for mode in driven
        ],
    )


@router.post("/platform", response_model=PlatformFiguresOut, dependencies=[Depends(limit_run)])
def platform(payload: PlatformExhibitIn) -> PlatformFiguresOut:
    return PlatformFiguresOut.model_validate(platform_figures(*payload.to_domain()))


@router.post("/race", response_model=RaceAnalysisOut, dependencies=[Depends(limit_run)])
def race(payload: RaceIn) -> RaceAnalysisOut:
    spec = Race(**payload.model_dump())
    return RaceAnalysisOut.model_validate(
        {"race": run_race(spec), "valley": race_valley(spec.ball)}, from_attributes=True
    )


@router.post("/elephant", response_model=ElephantFiguresOut, dependencies=[Depends(limit_run)])
def elephant(payload: ElephantIn) -> ElephantFiguresOut:
    return ElephantFiguresOut.model_validate(elephant_figures(payload.to_domain()))


@router.post("/smoke", response_model=SmokeFiguresOut, dependencies=[Depends(limit_run)])
def smoke(payload: SmokeExhibitIn) -> SmokeFiguresOut:
    return SmokeFiguresOut.model_validate(smoke_figures(payload.to_domain()))


@router.post("/cannon", response_model=CannonFiguresOut, dependencies=[Depends(limit_run)])
def cannon(payload: BallStackIn) -> CannonFiguresOut:
    return CannonFiguresOut.model_validate(cannon_figures(payload.to_domain()))


@router.post("/wave", response_model=WaveFiguresOut, dependencies=[Depends(limit_run)])
def wave(payload: WaveIn) -> WaveFiguresOut:
    return WaveFiguresOut.model_validate(wave_figures(PendulumWave(**payload.model_dump())))
