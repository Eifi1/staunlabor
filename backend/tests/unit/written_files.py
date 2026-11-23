"""What the tests of the written files share: loading a ``scripts/write-*.py`` by
its path, and naming every place a stored file and a fresh answer disagree.

The scripts are not a package (their names have hyphens, and ``backend/`` is not
installed), so each is loaded from its file, as ``uv run python ../scripts/…``
runs it."""

from __future__ import annotations

import importlib.util
import math
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[3]


def load_script(name: str) -> Any:
    """``scripts/<name>`` as a module, its ``__main__`` block not run."""
    script = ROOT / "scripts" / name
    spec = importlib.util.spec_from_file_location(script.stem.replace("-", "_"), script)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def differences(
    stored: Any, fresh: Any, where: str = "", *, rel_tol: float = 1e-12, abs_tol: float = 1e-300
) -> list[str]:
    """Every place the two disagree, numbers within ``rel_tol`` (and ``abs_tol``
    near zero). A file written with ``repr`` is equal on the machine that wrote
    it; the margin is for a platform whose ``cos`` rounds its last bit the other
    way, or for a file that rounds its numbers itself."""
    if isinstance(stored, dict) and isinstance(fresh, dict):
        if stored.keys() != fresh.keys():
            return [f"{where}: keys {sorted(stored.keys() ^ fresh.keys())}"]
        return [
            d
            for key in stored
            for d in differences(stored[key], fresh[key], f"{where}.{key}", rel_tol=rel_tol, abs_tol=abs_tol)
        ]
    if isinstance(stored, list) and isinstance(fresh, list):
        if len(stored) != len(fresh):
            return [f"{where}: {len(stored)} entries, now {len(fresh)}"]
        return [
            d
            for i, (a, b) in enumerate(zip(stored, fresh, strict=True))
            for d in differences(a, b, f"{where}[{i}]", rel_tol=rel_tol, abs_tol=abs_tol)
        ]
    if isinstance(stored, float) or isinstance(fresh, float):
        numbers = isinstance(stored, (int, float)) and isinstance(fresh, (int, float))
        if numbers and math.isclose(stored, fresh, rel_tol=rel_tol, abs_tol=abs_tol):
            return []
        return [f"{where}: {stored!r} in the file, {fresh!r} now"]
    return [] if stored == fresh else [f"{where}: {stored!r} in the file, {fresh!r} now"]
