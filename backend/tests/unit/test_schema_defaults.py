"""The input schemas' own defaults against the engine's.

Each ``*In`` model repeats its dataclass's defaults in ``Field(default=…)``:
what a request that leaves a field out is run with. Nothing tied the copy to
the engine, so a default changed on one side alone would have run a request
on another exhibit than the page shows. Here every default an input schema
spells is held to the exhibit's build as ``/defaults`` answers it, which is
the engine's own (``experiments_router.defaults``) — through that route, so the
pairing of schema and dataclass is the router's and needs no list here.

A field without a default has nothing to compare, and is not looked into:
the exhibit sets what it holds, which need not be its schema's defaults (the
harmonograph's board is a pendulum set apart from its pen, the rainbow's water
a bead of another glass). Every routed input gives each of its parts a default
of its own, so all of a request's defaults are held here.

The course's inputs are held the same way: the two-mass rig against
``/course/defaults``, and every other default an input spells against the
keyword default of the engine function or dataclass its router hands it to —
or, where the engine has none, named as the lesson's own starting value.
"""

from __future__ import annotations

import asyncio
import enum
import inspect
from collections.abc import Callable

from pydantic import BaseModel
from pydantic_core import PydanticUndefined

from staunlabor.api import course_router
from staunlabor.api.experiments_router import defaults
from staunlabor.domain import course
from staunlabor.domain.schemas import course as course_schemas
from staunlabor.domain.schemas.experiments import ExperimentsDefaultsOut, _In


def _plain(value: object) -> object:
    """A value as data: models and enums opened, tuples as lists (a dataclass
    holds a tuple where its schema holds a list)."""
    if isinstance(value, BaseModel):
        return _plain(value.model_dump())
    if isinstance(value, dict):
        return {key: _plain(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_plain(item) for item in value]
    if isinstance(value, enum.Enum):
        return value.value
    return value


def _schema(annotation: object) -> type[_In] | None:
    """The input schema a field holds, if it holds one."""
    if isinstance(annotation, type) and issubclass(annotation, _In):
        return annotation
    return None


def _differences(model: type[BaseModel], built: dict[str, object], exhibit: str) -> list[str]:
    found: list[str] = []
    for name, info in model.model_fields.items():
        if info.default is PydanticUndefined and info.default_factory is None:
            continue
        own = _plain(info.get_default(call_default_factory=True))
        if own != _plain(built[name]):
            found.append(f"{exhibit}.{name}: the schema says {own!r}, the engine {_plain(built[name])!r}")
    return found


def test_every_default_an_input_schema_spells_is_the_engines():
    built = asyncio.run(defaults()).model_dump()
    exhibits = {
        name: schema
        for name, info in ExperimentsDefaultsOut.model_fields.items()
        if (schema := _schema(info.annotation)) is not None
    }
    assert len(exhibits) == 44, "every exhibit's build but the chair's, which has none"
    found = [line for name, schema in exhibits.items() for line in _differences(schema, built[name], name)]
    assert found == []


def test_the_course_s_rig_is_the_engine_s():
    built = asyncio.run(course_router.defaults()).model_dump()
    assert set(course_schemas.CourseDefaultsOut.model_fields) == {"two_mass", "exercises", "settle_s"}
    assert _differences(course_schemas.TwoMassParametersIn, built["two_mass"], "two_mass") == []


#: Every input the course's router takes, and what it hands the input's fields
#: to by name.
COURSE_INPUTS: dict[type[BaseModel], Callable[..., object]] = {
    course_schemas.TankIn: course.tank,
    course_schemas.FirstOrderIn: course.first_order_step,
    course_schemas.SeedIn: course.decay_test,
    course_schemas.SecondOrderIn: course.oscillator,
    course_schemas.ScalarIn: course.scalar_growth,
    course_schemas.PolesIn: course.pole_pair,
    course_schemas.MatrixIn: course.matrix_portrait,
    course_schemas.LaplaceIn: course.laplace_steps,
    course_schemas.BlockIn: course.Block,
    course_schemas.BlockChainIn: course.chain_response,
    course_schemas.FilterIn: course.filter_loop,
    course_schemas.SensorRunIn: course.sensor_methods,
    course_schemas.StepIn: course.oscillator_methods,
    course_schemas.TwoMassParametersIn: course.TwoMassParameters,
    course_schemas.TwoMassRunIn: course.two_mass,
    course_schemas.CompensationRunIn: course.mass_compensation,
}

#: Defaults the engine does not have: what the lesson's widget starts from (the
#: sensor of lesson 1, the torque step and the excitation of lesson 2, the first
#: seed), and the pole widget's two ways of being asked, either left out.
LESSON_OWN = {
    ("SensorRunIn", "time_constant_s"),
    ("SensorRunIn", "start"),
    ("SensorRunIn", "final"),
    ("SecondOrderIn", "torque"),
    ("SecondOrderIn", "excitation_hz"),
    ("SeedIn", "seed"),
    ("PolesIn", "f0_hz"),
    ("PolesIn", "damping"),
    ("PolesIn", "real"),
    ("PolesIn", "imag"),
}


def test_every_default_a_course_input_spells_is_the_engine_s_or_the_lesson_s():
    routed = {
        value
        for value in vars(course_schemas).values()
        if isinstance(value, type) and issubclass(value, course_schemas._In) and value is not course_schemas._In
    }
    assert routed == set(COURSE_INPUTS), "an input the table does not pair with the engine"
    found: list[str] = []
    lesson_own: set[tuple[str, str]] = set()
    for model, target in COURSE_INPUTS.items():
        parameters = inspect.signature(target).parameters
        for name, info in model.model_fields.items():
            if info.default is PydanticUndefined and info.default_factory is None:
                continue
            own = info.get_default(call_default_factory=True)
            engine = parameters[name].default if name in parameters else inspect.Parameter.empty
            if engine is inspect.Parameter.empty:
                lesson_own.add((model.__name__, name))
            elif _plain(own) != _plain(engine):
                found.append(f"{model.__name__}.{name}: the schema says {own!r}, the engine {engine!r}")
    assert found == []
    assert lesson_own == LESSON_OWN
