"""The two bases every wire shape of the site stands on, the exhibits' and the
course's alike.

An input refuses a field it does not know (``extra="forbid"``): a misspelt
name is a 422 that names it, never a default silently kept. Both read from
attributes, so a model is built straight from the engine's dataclass
(``SphereIn.model_validate(Sphere())``) and an answer from the engine's result.
"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict


class _Out(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class _In(BaseModel):
    model_config = ConfigDict(extra="forbid", from_attributes=True)
