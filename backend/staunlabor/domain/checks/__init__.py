"""The exhibits' checks: limiting cases a reader can work out by hand, each one
held against the engine's own computation and against a published source.

A check is only worth something if what it compares against does not come
from the same mind that wrote the engine. So every case carries the source of
its formula (where to find it and the statement verbatim, in the source's own
language), and its expected value is computed here, from that formula, not by
the engine's own closed forms. What is measured is what the page shows: the
engine's time loop at the step the page uses, or the function it calls.

Where no source states the formula exactly as it is used, the case says so
(``derived``) and its words on the page give the one step from the sources;
a reader then checks that step, not a citation.

What this package deliberately does not do: decide whether an exhibit counts
as checked. That is a person's verdict, given on the page by an admin and
stored with the exhibit's :func:`fingerprint`, so a later change to the engine
brings the notice back by itself.

Pure functions, the standard library only, like the engine.
"""

from __future__ import annotations

import ast
import hashlib
import importlib.util
from collections.abc import Callable, Mapping
from dataclasses import dataclass, field
from pathlib import Path

__all__ = [
    "Case",
    "Result",
    "Source",
    "cases",
    "exhibits",
    "fingerprint",
    "results",
]


@dataclass(frozen=True)
class Source:
    """Where a reader finds the formula, and what it says there."""

    #: Author, title, and where in it: section, equation, page.
    cite: str
    url: str
    #: The statement as the source has it, untranslated.
    quote: str


@dataclass(frozen=True)
class Case:
    """One limiting case. ``key`` names its words in the catalogues
    (``experiments.checks.<exhibit>.<key>``): what is set, what the formula
    says, and why the case would catch a mistake."""

    key: str
    unit: str
    #: By hand, from the source's formula.
    expected: Callable[[], float]
    #: The engine, as the page runs it.
    measured: Callable[[], float]
    #: The relative deviation allowed; the case's words say where it comes from.
    tolerance: float
    sources: tuple[Source, ...]
    #: No source states the formula as used; the case's words give the step.
    derived: bool = False
    #: What the case sets, in the engine's own inputs.
    setting: Mapping[str, float | str] = field(default_factory=dict)


@dataclass(frozen=True)
class Result:
    exhibit: str
    key: str
    unit: str
    expected: float
    measured: float
    #: ``|measured − expected| / |expected|``; the absolute difference where
    #: the expected value is zero.
    deviation: float
    tolerance: float
    derived: bool
    sources: tuple[Source, ...]


def _registry() -> dict[str, tuple[tuple[Case, ...], tuple[str, ...]]]:
    # Imported here: each module imports this one for its dataclasses.
    from staunlabor.domain.checks import (
        arch,
        beats,
        bounce,
        cannon,
        chair,
        chaos,
        chladni,
        circuit,
        coil,
        cone,
        coriolis,
        coupled,
        cradle,
        diver,
        elephant,
        foucault,
        harmonograph,
        levitation,
        maxwell,
        overhang,
        parabola,
        peg,
        plates,
        platform,
        race,
        rainbow,
        resonance,
        sky,
        slits,
        smoke,
        sphere,
        waterwheel,
        wave,
        well,
    )

    return {
        "arch": (arch.CASES, arch.ENGINE),
        "beats": (beats.CASES, beats.ENGINE),
        "bounce": (bounce.CASES, bounce.ENGINE),
        "cannon": (cannon.CASES, cannon.ENGINE),
        "chair": (chair.CASES, chair.ENGINE),
        "chaos": (chaos.CASES, chaos.ENGINE),
        "chladni": (chladni.CASES, chladni.ENGINE),
        "circuit": (circuit.CASES, circuit.ENGINE),
        "coil": (coil.CASES, coil.ENGINE),
        "cone": (cone.CASES, cone.ENGINE),
        "coriolis": (coriolis.CASES, coriolis.ENGINE),
        "coupled": (coupled.CASES, coupled.ENGINE),
        "cradle": (cradle.CASES, cradle.ENGINE),
        "diver": (diver.CASES, diver.ENGINE),
        "elephant": (elephant.CASES, elephant.ENGINE),
        "foucault": (foucault.CASES, foucault.ENGINE),
        "harmonograph": (harmonograph.CASES, harmonograph.ENGINE),
        "levitation": (levitation.CASES, levitation.ENGINE),
        "maxwell": (maxwell.CASES, maxwell.ENGINE),
        "overhang": (overhang.CASES, overhang.ENGINE),
        "parabola": (parabola.CASES, parabola.ENGINE),
        "peg": (peg.CASES, peg.ENGINE),
        "plates": (plates.CASES, plates.ENGINE),
        "platform": (platform.CASES, platform.ENGINE),
        "race": (race.CASES, race.ENGINE),
        "rainbow": (rainbow.CASES, rainbow.ENGINE),
        "resonance": (resonance.CASES, resonance.ENGINE),
        "sky": (sky.CASES, sky.ENGINE),
        "slits": (slits.CASES, slits.ENGINE),
        "smoke": (smoke.CASES, smoke.ENGINE),
        "sphere": (sphere.CASES, sphere.ENGINE),
        "waterwheel": (waterwheel.CASES, waterwheel.ENGINE),
        "wave": (wave.CASES, wave.ENGINE),
        "well": (well.CASES, well.ENGINE),
    }


def exhibits() -> tuple[str, ...]:
    """The exhibits that have checks, by their page's name (``exhibits.ts``)."""
    return tuple(sorted(_registry()))


def cases(exhibit: str) -> tuple[Case, ...]:
    entry = _registry().get(exhibit)
    if entry is None:
        raise ValueError(f"no checks for {exhibit!r}")
    return entry[0]


def results(exhibit: str) -> tuple[Result, ...]:
    """Every case of ``exhibit``, computed: the engine against the source."""
    out = []
    for case in cases(exhibit):
        expected, measured = case.expected(), case.measured()
        deviation = abs(measured - expected) / abs(expected) if expected != 0 else abs(measured)
        out.append(
            Result(
                exhibit=exhibit,
                key=case.key,
                unit=case.unit,
                expected=expected,
                measured=measured,
                deviation=deviation,
                tolerance=case.tolerance,
                derived=case.derived,
                sources=case.sources,
            )
        )
    return tuple(out)


# ── the fingerprint ──────────────────────────────────────────────────────────

_ENGINE = "staunlabor.domain.experiments"


def _source(module: str) -> str:
    spec = importlib.util.find_spec(module)
    if spec is None or spec.origin is None:
        raise ValueError(f"no source for {module}")
    return Path(spec.origin).read_text(encoding="utf-8")


def _code(text: str) -> str:
    """The module's code without its docstrings and comments: a reworded
    comment is no new calculation, a changed constant is."""
    tree = ast.parse(text)
    for node in ast.walk(tree):
        body = getattr(node, "body", None)
        if (
            isinstance(body, list)
            and body
            and isinstance(body[0], ast.Expr)
            and isinstance(body[0].value, ast.Constant)
            and isinstance(body[0].value.value, str)
        ):
            body[0] = ast.Pass()
    return ast.dump(tree, include_attributes=False)


def _engine_imports(text: str) -> set[str]:
    """The engine modules ``text`` imports, so a shared helper's change
    reaches every exhibit that uses it."""
    found = set()
    for node in ast.walk(ast.parse(text)):
        if isinstance(node, ast.ImportFrom) and node.module:
            if node.module.startswith(_ENGINE + "."):
                found.add(node.module)
            elif node.module == _ENGINE:
                found.update(f"{_ENGINE}.{alias.name}" for alias in node.names)
            elif node.level == 1 and node.module:
                found.add(f"{_ENGINE}.{node.module}")
        elif isinstance(node, ast.Import):
            found.update(alias.name for alias in node.names if alias.name.startswith(_ENGINE + "."))
    return found


def fingerprint(exhibit: str) -> str:
    """What a check of ``exhibit`` holds for: the code of its engine modules,
    of every engine module they import, and of its cases. An admin's check is
    stored with it; once it differs, the exhibit counts as unchecked again."""
    entry = _registry().get(exhibit)
    if entry is None:
        raise ValueError(f"no checks for {exhibit!r}")
    engine = entry[1]
    todo = [f"{_ENGINE}.{name}" for name in engine]
    seen: dict[str, str] = {}
    while todo:
        module = todo.pop()
        if module in seen:
            continue
        text = _source(module)
        seen[module] = _code(text)
        todo.extend(_engine_imports(text) - seen.keys())
    seen[f"staunlabor.domain.checks.{exhibit}"] = _code(_source(f"staunlabor.domain.checks.{exhibit}"))
    digest = hashlib.sha256()
    for module in sorted(seen):
        digest.update(module.encode())
        digest.update(b"\0")
        digest.update(seen[module].encode())
        digest.update(b"\0")
    return digest.hexdigest()
