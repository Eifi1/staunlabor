"""The engine still answers what the experiments' browser simulations are held to.

The exhibits' time loops run in the browser
(`frontend/src/features/experiments/simulate/`), ported from
`domain/experiments/`. `simulate.test.ts` holds the ports to `engine-cases.json`;
this file holds `engine-cases.json` to the engine. Without it a change to the
physics here would leave the browser drawing the old model with every test
green — the port's test would still pass against a file nobody rewrote. So a
change to an exhibit's module fails here until the file is written again
(`scripts/write-experiments-cases.py`), and then fails in the frontend until
the port follows.
"""

from __future__ import annotations

import importlib.util
import json
import math
from pathlib import Path
from typing import Any

import pytest

pytestmark = pytest.mark.unit

ROOT = Path(__file__).resolve().parents[3]
SCRIPT = ROOT / "scripts" / "write-experiments-cases.py"


def _writer() -> Any:
    spec = importlib.util.spec_from_file_location("write_experiments_cases", SCRIPT)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _differences(stored: Any, fresh: Any, where: str = "") -> list[str]:
    """Every place the two disagree. Floats within a part in 10¹² — the file is
    written with `repr`, so on one machine they are equal; the margin is for a
    platform whose `cos` rounds its last bit the other way."""
    if isinstance(stored, dict) and isinstance(fresh, dict):
        if stored.keys() != fresh.keys():
            return [f"{where}: keys {sorted(stored.keys() ^ fresh.keys())}"]
        return [d for key in stored for d in _differences(stored[key], fresh[key], f"{where}.{key}")]
    if isinstance(stored, list) and isinstance(fresh, list):
        if len(stored) != len(fresh):
            return [f"{where}: {len(stored)} entries, now {len(fresh)}"]
        return [
            d for i, (a, b) in enumerate(zip(stored, fresh, strict=True)) for d in _differences(a, b, f"{where}[{i}]")
        ]
    if isinstance(stored, float) or isinstance(fresh, float):
        numbers = isinstance(stored, (int, float)) and isinstance(fresh, (int, float))
        if numbers and math.isclose(stored, fresh, rel_tol=1e-12, abs_tol=1e-300):
            return []
        return [f"{where}: {stored!r} in the file, {fresh!r} from the engine"]
    return [] if stored == fresh else [f"{where}: {stored!r} in the file, {fresh!r} from the engine"]


@pytest.fixture(scope="module")
def writer() -> Any:
    return _writer()


@pytest.fixture(scope="module")
def stored(writer: Any) -> Any:
    return json.loads(writer.TARGET.read_text(encoding="utf-8"))


def test_the_browser_s_cases_are_what_the_engine_answers(writer: Any, stored: Any):
    fresh = json.loads(writer.serialised())
    differences = _differences(stored, fresh)
    assert not differences, (
        "engine-cases.json is not what the engine answers; run "
        "`cd backend && uv run python ../scripts/write-experiments-cases.py`, then make the port agree:\n"
        + "\n".join(differences[:20])
    )


def test_the_cases_cross_every_branch_a_page_can_reach(stored: Any):
    """What the cases are for: a ball captured by a sweep and one left behind
    by a jump, a hollow ball, a swing along a line, a ball that leaves the wall;
    a car that reaches a top on the default build, the buttons both ways, a
    late and an early hand, an open coil, nobody, a recording; and the timing
    curve, braking at its late end."""
    verdicts = {c["name"]: c["ring"]["verdict"] for c in stored["smoke"]}
    assert {"ring", "too_fast", "too_slow"} <= set(verdicts.values()), "a ring, a smear and a drift"
    assert any(c["ring"]["trailing"] for c in stored["smoke"]), "a slug past the formation number"
    elephants = {c["name"]: c["run"] for c in stored["elephant"]}
    assert elephants["a tilt it cannot hold"]["fell_at_s"] is not None, "a ball that falls out"
    assert all(r["fell_at_s"] is None for name, r in elephants.items() if name != "a tilt it cannot hold")
    rested = elephants["too little air"]["y_m"]["values"]
    assert max(rested) == min(rested), "a ball the air cannot lift sits on the rim"
    assert any(p["s_m"] < 0 for p in stored["elephant_points"]), "a point behind the opening, where no air blows"
    cannons = {c["name"]: c for c in stored["cannon"]}
    exhibit = cannons["the exhibit"]["drop"]["contacts"]
    floor = next(c for c in exhibit if c["contact"] == 0)
    assert any(c["contact"] == 1 and c["start_s"] < floor["end_s"] for c in exhibit), "contacts that overlap"
    assert any(c["end_s"] is None for case in cannons.values() for c in case["drop"]["contacts"]), "one still closed"
    lossless = [c for c in cannons["one ball, lossless"]["drop"]["contacts"] if c["end_s"] is not None]
    assert lossless and abs(lossless[0]["parting_m_s"] - lossless[0]["closing_m_s"]) < 0.01, "a ball that loses nothing"
    pits = stored["pit"]
    assert all(c["run"]["still"] for c in pits), "every pit case runs until the balls lie still"
    assert any(c["inertia"] == 0 for c in pits), "a block that slides, which does not turn"
    assert any(c["inertia"] > 0.5 for c in pits), "a hollow ball"
    spheres = stored["sphere"]
    assert any(c["run"]["final_angle_deg"] > 70 for c in spheres)
    assert any(c["drive"]["sweep_s"] == 0 and c["run"]["highest_angle_deg"] < 25 for c in spheres)
    assert any(c["sphere"]["ball"] == "hollow" for c in spheres)
    assert any(c["drive"]["path"] == "line" for c in spheres)
    assert any(c["run"]["left_the_wall"] for c in spheres)
    coils = stored["coil"]
    assert any(c["run"]["tops"] > 0 and c["exhibit"]["coil"]["turns"] == 1600 for c in coils)
    rules = [c["visitor"] for c in coils if c["visitor"] and c["visitor"]["kind"] == "rule"]
    assert any(r["reversed"] for r in rules)
    assert {0.03, -0.02} <= {r["late_s"] for r in rules}
    assert any(c["exhibit"]["idle"] == "open" for c in coils)
    assert any(c["visitor"] is None for c in coils)
    assert any(c["visitor"] and c["visitor"]["kind"] == "scripted" for c in coils)
    gains = [p["gain_j"] for p in stored["timing"]["points"]]
    assert gains[-1] < 0 < max(gains)
    assert {p["m"] for p in stored["jacobi"]} >= {0.0, 1.0}, "both ends of the parameter"
    assert any(p["t"] > 4 * p["period_s"] for p in stored["pendulum_angles"]), "an instant many periods in"
    assert any(p["amplitude_deg"] == 0 for p in stored["pendulum_angles"]), "a pendulum let go at rest"
    assert any(c.get("damping_per_s", 0) > 0 for c in stored["swing"]), "a damped swing"
    assert any(c["spread_deg"] > 30 for c in stored["wave"]), "a row that comes back apart"
    phases = {c["h"][p]["phase_deg"] for c in stored["harmonograph"] for p in ("pen", "board")}
    assert any(180 < p < 360 for p in phases), "a pendulum started on its way back"
    assert any(c["figures"]["pen_fades_s"] is None for c in stored["harmonograph"]), "an undamped pair"
    rolls = {c["name"]: c["run"] for c in stored["cone"]}
    assert any(r["stopped_at_s"] is not None and r["final_x_m"] > 0 for r in rolls.values()), "up to the top"
    assert any(r["stopped_at_s"] is not None and r["final_x_m"] == 0 for r in rolls.values()), "down to the bottom"
    assert any(r["stopped_at_s"] is None for r in rolls.values()), "a cone that stays where it is laid"
    surfaces = [s for c in stored["parabola_surfaces"] for s in c["surfaces"]]
    assert any(s["dry_radius_m"] > 0 for s in surfaces), "a dry middle"
    assert any(s["spills"] for s in surfaces), "water spilling"
    assert any(s["focus_m"] is None for s in surfaces), "water at rest"
    assert any(c["vessel_rate"] == 0 for c in stored["parabola_spins"]), "water spinning down"
