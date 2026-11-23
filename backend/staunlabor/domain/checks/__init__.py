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
from dataclasses import dataclass
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
    #: What the case sets, in the engine's own inputs; required, so a new case
    #: cannot leave its page without the inputs it was computed for.
    setting: Mapping[str, float | str]
    #: No source states the formula as used; the case's words give the step.
    derived: bool = False


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
    setting: Mapping[str, float | str]


def _registry() -> dict[str, tuple[Case, ...]]:
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
        gyroscope,
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
        "arch": arch.CASES,
        "beats": beats.CASES,
        "bounce": bounce.CASES,
        "cannon": cannon.CASES,
        "chair": chair.CASES,
        "chaos": chaos.CASES,
        "chladni": chladni.CASES,
        "circuit": circuit.CASES,
        "coil": coil.CASES,
        "cone": cone.CASES,
        "coriolis": coriolis.CASES,
        "coupled": coupled.CASES,
        "cradle": cradle.CASES,
        "diver": diver.CASES,
        "elephant": elephant.CASES,
        "foucault": foucault.CASES,
        "gyroscope": gyroscope.CASES,
        "harmonograph": harmonograph.CASES,
        "levitation": levitation.CASES,
        "maxwell": maxwell.CASES,
        "overhang": overhang.CASES,
        "parabola": parabola.CASES,
        "peg": peg.CASES,
        "plates": plates.CASES,
        "platform": platform.CASES,
        "race": race.CASES,
        "rainbow": rainbow.CASES,
        "resonance": resonance.CASES,
        "sky": sky.CASES,
        "slits": slits.CASES,
        "smoke": smoke.CASES,
        "sphere": sphere.CASES,
        "waterwheel": waterwheel.CASES,
        "wave": wave.CASES,
        "well": well.CASES,
    }


def exhibits() -> tuple[str, ...]:
    """The exhibits that have checks, by their page's name (``exhibits.ts``)."""
    return tuple(sorted(_registry()))


def cases(exhibit: str) -> tuple[Case, ...]:
    entry = _registry().get(exhibit)
    if entry is None:
        raise ValueError(f"no checks for {exhibit!r}")
    return entry


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
                setting=case.setting,
            )
        )
    return tuple(out)


# ── the fingerprint ──────────────────────────────────────────────────────────

_ENGINE = "staunlabor.domain.experiments"
_CHECKS = "staunlabor.domain.checks"


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


def _fingerprinted(module: str) -> bool:
    """An engine module, or a module of this package's own other than the
    package itself (which holds only the dataclasses): what a check's verdict
    stands on."""
    return module.startswith((_ENGINE + ".", _CHECKS + "."))


def _imports(text: str, package: str) -> set[str]:
    """The fingerprinted modules ``text`` imports, relative imports read
    against ``package``: an engine helper's change reaches every exhibit that
    uses it, and so does the change of a helper the checks share (say
    ``checks/_hand.py``), which a walk over the engine alone would miss and
    leave every exhibit using it checked."""
    found = set()
    for node in ast.walk(ast.parse(text)):
        if isinstance(node, ast.ImportFrom):
            base = node.module or ""
            if node.level:
                parts = package.split(".")
                parent = ".".join(parts[: len(parts) - node.level + 1])
                base = f"{parent}.{base}" if base else parent
            if _fingerprinted(base):
                found.add(base)
            # ``from <package> import name``: a name that is a module of it.
            for alias in node.names:
                if base in (_ENGINE, _CHECKS) and importlib.util.find_spec(f"{base}.{alias.name}") is not None:
                    found.add(f"{base}.{alias.name}")
        elif isinstance(node, ast.Import):
            found.update(alias.name for alias in node.names if _fingerprinted(alias.name))
    return found


def fingerprint(exhibit: str) -> str:
    """What a check of ``exhibit`` holds for: the code of its cases and of
    every module they import, and so on down, the engine's modules and the
    checks' shared helpers alike. The walk starts at the check module alone:
    its ``from staunlabor.domain.experiments import … as engine`` names the
    engine it measures, so no second list of engine modules can fall out of
    step with what the cases really run. An admin's check is stored with it;
    once it differs, the exhibit counts as unchecked again."""
    if exhibit not in _registry():
        raise ValueError(f"no checks for {exhibit!r}")
    todo = [f"{_CHECKS}.{exhibit}"]
    seen: dict[str, str] = {}
    while todo:
        module = todo.pop()
        if module in seen:
            continue
        text = _source(module)
        seen[module] = _code(text)
        todo.extend(_imports(text, module.rpartition(".")[0]) - seen.keys())
    digest = hashlib.sha256()
    for module in sorted(seen):
        digest.update(module.encode())
        digest.update(b"\0")
        digest.update(seen[module].encode())
        digest.update(b"\0")
    return digest.hexdigest()
