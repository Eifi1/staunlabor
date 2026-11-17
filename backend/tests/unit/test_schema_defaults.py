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
"""

from __future__ import annotations

import asyncio
import enum

from pydantic import BaseModel
from pydantic_core import PydanticUndefined

from staunlabor.api.experiments_router import defaults
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


def _differences(model: type[_In], built: dict[str, object], exhibit: str) -> list[str]:
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
    assert len(exhibits) == 34, "every exhibit's build but the chair's, which has none"
    found = [line for name, schema in exhibits.items() for line in _differences(schema, built[name], name)]
    assert found == []
