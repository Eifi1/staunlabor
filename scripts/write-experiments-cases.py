"""Write what the engine answers for the experiments' two simulations, so the
browser can be held to it: `frontend/src/features/experiments/simulate/engine-cases.json`.

The ball in the hanging sphere and the magnet car on its ramps answer a hand
sixty times a second, and the race's balls in their pit are a time loop the
API's budget has no room for, so they run in the browser
(`frontend/src/features/experiments/simulate/sphere.ts`, `coil.ts`), ported
from `domain/experiments/sphere.py`, `coil.py` and `platform.py`. A port is only as good as
the check that it still says what the original says; this script is the
original's half of that check, the course's way (`write-dynamics-cases.py`):
it runs the engine on a handful of cases — a sweep, a jump, a hollow ball, a
swing along a line, a ball started on its orbit; the press rule, the buttons
the wrong way round, a late and an early hand, an open coil, nobody pressing,
a recorded visitor, another build — and writes every figure and a thinned copy
of every curve. `simulate.test.ts` runs the port on the same inputs and
compares; `tests/unit/test_experiments_browser.py` fails the backend suite when
the engine no longer writes this file as it stands.

The runs are shorter than a visitor's: long enough to cross every branch (a
capture into the orbit, a top reached, a car trapped), short enough that both
halves of the check take seconds.

Run from `backend/`:

    uv run python ../scripts/write-experiments-cases.py

Pure arithmetic and a file write: no database, no settings, nothing random.
"""

from __future__ import annotations

import importlib
import json
import sys
from dataclasses import asdict
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
# `backend/` is not an installed package; the tests find it as their rootdir.
sys.path.insert(0, str(ROOT / "backend"))

# By module path: the barrel exports `run` under two names and the modules'
# constants are the modules' own.
sphere = importlib.import_module("staunlabor.domain.experiments.sphere")
coil = importlib.import_module("staunlabor.domain.experiments.coil")
platform = importlib.import_module("staunlabor.domain.experiments.platform")
race = importlib.import_module("staunlabor.domain.experiments.race")
pit = importlib.import_module("staunlabor.domain.experiments.pit")
elephant = importlib.import_module("staunlabor.domain.experiments.elephant")
smoke = importlib.import_module("staunlabor.domain.experiments.smoke")
cannon = importlib.import_module("staunlabor.domain.experiments.cannon")

TARGET = ROOT / "frontend/src/features/experiments/simulate/engine-cases.json"
#: Points kept per curve: enough to see a curve that went wrong, few enough that
#: the file stays a test fixture rather than a data set.
KEPT = 24


def _on_orbit() -> dict[str, Any]:
    still = sphere.Sphere(rolling_resistance=0.0)
    o = sphere.orbit(still, 2.0)
    assert o is not None
    return {
        "sphere": still,
        "drive": sphere.Drive(radius_m=0.0, sweep_s=0.0, hold_s=4.0),
        "start_angle_deg": o.angle_deg,
        "start_speed_m_s": o.speed_m_s,
    }


SPHERE_CASES: dict[str, dict[str, Any]] = {
    "a sweep carries the ball up": {
        "sphere": sphere.Sphere(),
        "drive": sphere.Drive(radius_m=0.02, start_hz=0.7, end_hz=2.0, sweep_s=12.0, hold_s=3.0),
    },
    "a jump leaves it near the bottom": {
        "sphere": sphere.Sphere(),
        "drive": sphere.Drive(radius_m=0.02, end_hz=2.5, sweep_s=0.0, hold_s=6.0),
    },
    "a hollow ball": {
        "sphere": sphere.Sphere(ball=sphere.BallKind.HOLLOW),
        "drive": sphere.Drive(radius_m=0.02, start_hz=0.6, end_hz=1.6, sweep_s=6.0, hold_s=2.0),
    },
    "back and forth along a line": {
        "sphere": sphere.Sphere(),
        "drive": sphere.Drive(radius_m=0.015, end_hz=0.95, sweep_s=0.0, hold_s=6.0, path=sphere.DrivePath.LINE),
    },
    "started on its orbit": _on_orbit(),
    "shaken hard along a line from high up: it leaves the wall": {
        "sphere": sphere.Sphere(),
        "drive": sphere.Drive(radius_m=0.05, end_hz=3.0, sweep_s=0.0, hold_s=1.0, path=sphere.DrivePath.LINE),
        "start_angle_deg": 85.0,
    },
    "a small sphere, a big ball, much resistance, a coarse step": {
        "sphere": sphere.Sphere(shell_radius_m=0.10, ball_radius_m=0.04, rolling_resistance=0.05),
        "drive": sphere.Drive(radius_m=0.03, start_hz=1.0, end_hz=2.2, sweep_s=4.0, hold_s=2.0),
        "start_angle_deg": 30.0,
        "step_s": 2e-3,
    },
}

_FAST_FROM_THE_MIDDLE = {"start_x_m": 0.0, "start_speed_m_s": 1.4}

COIL_CASES: dict[str, dict[str, Any]] = {
    "the rule": {"visitor": coil.PressRule(), "duration_s": 9.0},
    "the buttons the wrong way round": {"visitor": coil.PressRule(reversed=True), "duration_s": 4.0},
    "a hand 30 ms late": {"visitor": coil.PressRule(late_s=0.03), "duration_s": 6.0},
    "a hand 20 ms early": {"visitor": coil.PressRule(late_s=-0.02), "duration_s": 4.0},
    "an open coil": {"exhibit": coil.CoilExhibit(idle=coil.Idle.OPEN), "visitor": coil.PressRule(), "duration_s": 4.0},
    "nobody pressing": {"visitor": None, "duration_s": 4.0},
    "a recorded visitor": {
        "exhibit": coil.CoilExhibit(idle=coil.Idle.OPEN),
        "visitor": coil.Scripted(
            presses=(
                (0.30, 0.36, coil.Press.PLUS),
                (0.40, 0.47, coil.Press.MINUS),
                (1.00, 1.20, coil.Press.MINUS),
                (2.00, 2.05, coil.Press.PLUS),
            )
        ),
        "duration_s": 3.0,
    },
    "400 turns at 3 V": {
        "exhibit": coil.CoilExhibit(coil=coil.Coil(turns=400, resistance_ohm=6.6), supply_v=3.0),
        "visitor": coil.PressRule(),
        "duration_s": 6.0,
    },
    "a heavy car on short steep ramps, fast from the middle": {
        "exhibit": coil.CoilExhibit(
            track=coil.Track(car_mass_kg=0.5, ramp_length_m=0.15, ramp_radius_m=0.3, rolling_resistance=0.02)
        ),
        "visitor": coil.PressRule(window_m=0.04),
        "duration_s": 3.0,
        **_FAST_FROM_THE_MIDDLE,
    },
}

#: The timing curve the page draws: one pass at a metre a second.
TIMING_SPEED_M_S = 1.0
TIMING_LATES_S = (-0.04, -0.02, 0.0, 0.01, 0.02, 0.04, 0.06)


#: The platform: pulling in and out under the bearing's friction; hand weights
#: and a push without friction; a spin the bearing stops; and the inertia's
#: parts at postures across the range, which is what the page computes live.
PLATFORM_CASES: dict[str, dict[str, Any]] = {
    "stand_up_and_lean_out": {
        "body": platform.Body(),
        "platform": platform.Platform(),
        "start": platform.Posture(lean_m=0.3),
        "momentum": 20.0,
        "moves": (
            platform.Move(at_s=1.0, lean_m=0.0, over_s=2.0),
            platform.Move(at_s=5.0, lean_m=0.3, over_s=1.0),
        ),
        "duration_s": 8.0,
    },
    "a_push_without_friction": {
        "body": platform.Body(mass_kg=85.0, shoulder_m=0.25),
        "platform": platform.Platform(friction_n_m=0.0, mass_kg=30.0, radius_m=0.45),
        "start": platform.Posture(),
        "momentum": 0.0,
        "moves": (
            platform.Move(at_s=0.5, lean_m=0.35, over_s=0.5, push=12.0),
            platform.Move(at_s=2.0, lean_m=0.1, over_s=1.5),
        ),
        "duration_s": 5.0,
    },
    "the_bearing_stops_it": {
        "body": platform.Body(),
        "platform": platform.Platform(friction_n_m=2.0),
        "start": platform.Posture(lean_m=0.15),
        "momentum": 5.0,
        "moves": (),
        "duration_s": 4.0,
    },
}

#: Leans the inertia is written out at, part by part.
POSTURES = [0.0, 0.05, 0.13, 0.3, 0.4, 0.217]

#: The pit the race's balls jump into: the default race, hollow balls on the
#: shortest run, blocks that slide (and so do not turn) on the longest — each
#: run until the balls lie still, which crosses every contact: a side, the
#: bottom, a wall, ball on ball.
PIT_CASES: dict[str, Any] = {
    "the default race": race.Race(),
    "hollow balls, the shortest run": race.Race(drop_m=0.4, run_m=0.45, ball=race.RaceBall.HOLLOW),
    "blocks that slide, the longest run": race.Race(drop_m=0.3, run_m=1.8, ball=race.RaceBall.SLIDING),
}


#: The elephant: the ball rising from the rim to its height, a push it comes
#: back from, a tilt it cannot hold, too little air to lift it, and another build
#: whose jet is tilted once the ball has risen (tilted from the start, the rise
#: carries it out sideways: 20° below a static limit of 36° is too much there).
ELEPHANT_CASES: dict[str, dict[str, Any]] = {
    "from the rim to its height": {"elephant": elephant.Elephant(), "moves": (), "duration_s": 3.0},
    "a push it comes back from": {
        "elephant": elephant.Elephant(),
        "moves": (elephant.Move(at_s=1.5, tilt_deg=0.0, over_s=0.0, nudge_m_s=0.8),),
        "duration_s": 3.0,
    },
    "a tilt it cannot hold": {
        "elephant": elephant.Elephant(),
        "moves": (elephant.Move(at_s=1.0, tilt_deg=70.0, over_s=1.5),),
        "duration_s": 4.0,
    },
    "too little air": {
        "elephant": elephant.Elephant(jet=elephant.Jet(speed_m_s=11.0)),
        "moves": (),
        "duration_s": 1.0,
    },
    "another build, held tilted": {
        "elephant": elephant.Elephant(
            jet=elephant.Jet(opening_m=0.06, speed_m_s=18.0),
            ball=elephant.FloatingBall(diameter_m=0.12, mass_kg=0.02),
            coanda=0.6,
        ),
        "moves": (elephant.Move(at_s=1.0, tilt_deg=20.0, over_s=1.0),),
        "duration_s": 3.0,
    },
}

#: Single evaluations of the forces, where a run passes quickly or never.
ELEPHANT_POINTS = ((0.05, 0.0, 0.0), (0.3, 0.04, 0.0), (0.5, -0.1, 30.0), (1.2, 0.2, 60.0), (-0.1, 0.0, 0.0))


#: The smoke ring: presses as a hand makes them — smooth, too fast, too slow,
#: uneven with a pause and a pull back up — and a narrow hole that leaves a
#: trailing jet; and the three kinds of flight.
SMOKE_PRESSES: dict[str, dict[str, Any]] = {
    "half a second": {"exhibit": smoke.SmokeExhibit(), "push": smoke.Push(0.08, 0.5)},
    "a jab": {"exhibit": smoke.SmokeExhibit(), "push": smoke.Push(0.08, 0.1)},
    "a slow press": {"exhibit": smoke.SmokeExhibit(), "push": smoke.Push(0.06, 2.0)},
    "a narrow hole": {
        "exhibit": smoke.SmokeExhibit(drum=smoke.Drum(hole_m=0.15, ring_m=0.3)),
        "push": smoke.Push(0.08, 0.5),
    },
}
#: A hand's press as sampled, uneven: down, a pause, a little back up, down again.
SMOKE_HAND = (
    (0.0, 0.05, 0.1, 0.2, 0.3, 0.35, 0.4, 0.5, 0.6, 0.7),
    (0.0, 0.004, 0.015, 0.035, 0.035, 0.03, 0.033, 0.05, 0.07, 0.08),
)
SMOKE_FLIGHTS = {"half a second": 3.0, "a jab": 2.0, "a slow press": 4.0}

#: The ball cannon: the exhibit's stack through its impact and the start of
#: the climb, two balls with a gap, the big ball on top, one lossless ball, and
#: a stiff, soft-bouncing stack — Hertz's contacts closing, overlapping and
#: opening, a contact staying closed at the end. Short: every step of a
#: contact is fifty small ones, and the page's drops are run in the browser.
CANNON_CASES: dict[str, dict[str, Any]] = {
    "the exhibit": {"stack": cannon.BallStack(), "duration_s": 0.6},
    "cut off mid-impact": {"stack": cannon.BallStack(), "duration_s": 0.455},
    "two balls, a gap": {
        "stack": cannon.BallStack(balls=(cannon.Ball(0.10), cannon.Ball(0.05)), gap_m=0.03, drop_m=0.6),
        "duration_s": 0.5,
    },
    "upside down": {
        "stack": cannon.BallStack(balls=(cannon.Ball(0.05), cannon.Ball(0.07), cannon.Ball(0.10)), drop_m=0.3),
        "duration_s": 0.4,
    },
    "one ball, lossless": {
        "stack": cannon.BallStack(balls=(cannon.Ball(0.07),), floor_restitution=1.0, drop_m=0.5),
        "duration_s": 0.6,
    },
    "stiff and soft-bouncing": {
        "stack": cannon.BallStack(floor_restitution=0.5, ball_restitution=0.4, drop_m=0.4, youngs_mpa=40.0),
        "duration_s": 0.5,
    },
}


def thin(values: Any) -> Any:
    """A curve as its length and every so many of its points, the last always
    among them; anything else as it is, recursively."""
    if isinstance(values, (list, tuple)) and values and all(isinstance(v, (int, float)) for v in values):
        if len(values) > KEPT and any(isinstance(v, float) for v in values):
            step = max(1, len(values) // KEPT)
            at = sorted({*range(0, len(values), step), len(values) - 1})
            return {"length": len(values), "at": at, "values": [float(values[i]) for i in at]}
        if len(values) > KEPT:
            # The presses: integers, thinned the same way.
            step = max(1, len(values) // KEPT)
            at = sorted({*range(0, len(values), step), len(values) - 1})
            return {"length": len(values), "at": at, "values": [values[i] for i in at]}
        return list(values)
    if isinstance(values, dict):
        return {k: thin(v) for k, v in values.items()}
    if isinstance(values, (list, tuple)):
        return [thin(v) for v in values]
    return values


def _visitor(visitor: Any) -> Any:
    if visitor is None:
        return None
    if isinstance(visitor, coil.Scripted):
        return {"kind": "scripted", **asdict(visitor)}
    return {"kind": "rule", **asdict(visitor)}


def cases() -> dict[str, Any]:
    out: dict[str, Any] = {
        "written_by": "cd backend && uv run python ../scripts/write-experiments-cases.py",
        "constants": {
            "sphere": {
                name: getattr(sphere, name)
                for name in ("G", "SOLID", "HOLLOW", "RESISTANCE_FADE_M_S", "STEP_S", "SAMPLES_PER_S", "MAX_DURATION_S")
            },
            "coil": {
                name: getattr(coil, name)
                for name in (
                    "G",
                    "MU0",
                    "RESISTANCE_FADE_M_S",
                    "STEP_S",
                    "SAMPLES_PER_S",
                    "MAX_DURATION_S",
                    "STEEPEST_RAD",
                    "STANDING_M_S",
                )
            },
        },
        "sphere": [],
        "coil": [],
        "timing": {},
        "platform": [],
        "inertia": [],
        "pit": [],
        "elephant": [],
        "elephant_points": [],
        "smoke": [],
        "cannon": [],
    }
    out["constants"]["platform"] = {name: getattr(platform, name) for name in ("SAMPLES_PER_S", "MAX_DURATION_S")}
    out["constants"]["elephant"] = {
        name: getattr(elephant, name)
        for name in (
            "G",
            "RHO",
            "NU",
            "DRAG",
            "DECAY",
            "SPREAD",
            "RINGS",
            "SPOKES",
            "STEP_S",
            "SAMPLES_PER_S",
            "MAX_DURATION_S",
            "MAX_TILT_DEG",
        )
    }
    for name, case in ELEPHANT_CASES.items():
        result = elephant.run(case["elephant"], case["moves"], case["duration_s"])
        out["elephant"].append(
            {
                "name": name,
                "elephant": asdict(case["elephant"]),
                "moves": [asdict(m) for m in case["moves"]],
                "duration_s": case["duration_s"],
                "run": thin(asdict(result)),
            }
        )
    out["constants"]["smoke"] = {
        name: getattr(smoke, name)
        for name in (
            "RHO",
            "NU",
            "FORMATION",
            "RING_SHARE",
            "CORE_SHARE",
            "TURBULENT_GROWTH",
            "STEP_S",
            "FLIGHT_STEP_S",
            "SAMPLES_PER_S",
            "MAX_FLIGHT_S",
            "CEILING_M",
        )
    }
    for name, case in SMOKE_PRESSES.items():
        times, depths = smoke.push_samples(case["push"])
        ring = smoke.ring_of(case["exhibit"], times, depths)
        entry: dict[str, Any] = {
            "name": name,
            "exhibit": asdict(case["exhibit"]),
            "times": list(times),
            "depths": list(depths),
            "ring": asdict(ring),
            "flight": None,
        }
        if name in SMOKE_FLIGHTS:
            entry["flight_s"] = SMOKE_FLIGHTS[name]
            entry["flight"] = thin(asdict(smoke.flight(case["exhibit"], ring, SMOKE_FLIGHTS[name])))
        out["smoke"].append(entry)
    hand = smoke.SmokeExhibit()
    out["smoke"].append(
        {
            "name": "a hand, uneven",
            "exhibit": asdict(hand),
            "times": list(SMOKE_HAND[0]),
            "depths": list(SMOKE_HAND[1]),
            "ring": asdict(smoke.ring_of(hand, *SMOKE_HAND)),
            "flight": None,
        }
    )
    out["constants"]["cannon"] = {
        name: getattr(cannon, name)
        for name in (
            "G",
            "RHO",
            "CD",
            "POISSON",
            "STEP_S",
            "SUBSTEPS",
            "CONTACT_STEP_S",
            "SAMPLES_PER_S",
            "MAX_S",
            "MIN_CLOSING_M_S",
            "IMPACT_EVERY",
            "IMPACT_WINDOW_S",
            "LAUNCH_WINDOW_S",
        )
    }
    for name, case in CANNON_CASES.items():
        stack = case["stack"]
        out["cannon"].append(
            {
                "name": name,
                "stack": asdict(stack),
                "duration_s": case["duration_s"],
                "drop": thin(asdict(cannon.drop(stack, case["duration_s"]))),
                "impact_m_s": cannon.impact_speed(stack),
                "launch": asdict(cannon.launch(stack)),
            }
        )
    for s_m, e_m, tilt in ELEPHANT_POINTS:
        el = elephant.Elephant()
        x_m = s_m * elephant.axes(tilt)[0][0] + e_m * elephant.axes(tilt)[1][0]
        y_m = s_m * elephant.axes(tilt)[0][1] + e_m * elephant.axes(tilt)[1][1]
        state = (x_m, y_m, 0.3, -0.2)
        cover = elephant.cover(el, s_m, e_m)
        out["elephant_points"].append(
            {
                "elephant": asdict(el),
                "s_m": s_m,
                "e_m": e_m,
                "tilt_deg": tilt,
                "state": list(state),
                "cover": asdict(cover),
                "acceleration": list(elephant.acceleration(el, tilt, state)),
                "step": list(elephant.step(el, tilt, state)),
            }
        )
    out["constants"]["pit"] = {
        name: getattr(pit, name)
        for name in (
            "G",
            "STIFFNESS",
            "LINING_RESTITUTION",
            "BALL_RESTITUTION",
            "FRICTION",
            "SLIP_DAMPING",
            "ROLLING",
            "DT",
            "EVERY",
            "STILL_M_S",
            "STILL_FOR_S",
            "LONGEST_AFTER_S",
        )
    }
    for name, spec in PIT_CASES.items():
        answer = race.race(spec)
        entries = race.entries(answer)
        result = pit.run(answer.basin, answer.ball_radius_m, answer.inertia, entries)
        out["pit"].append(
            {
                "name": name,
                "basin": asdict(answer.basin),
                "radius_m": answer.ball_radius_m,
                "inertia": answer.inertia,
                "entries": [asdict(e) for e in entries],
                "run": thin(asdict(result)),
            }
        )
    for name, case in SPHERE_CASES.items():
        start_angle = case.get("start_angle_deg", 0.0)
        start_speed = case.get("start_speed_m_s", 0.0)
        step_s = case.get("step_s", sphere.STEP_S)
        result = sphere.run(case["sphere"], case["drive"], start_angle, start_speed, step_s)
        out["sphere"].append(
            {
                "name": name,
                "sphere": asdict(case["sphere"]),
                "drive": asdict(case["drive"]),
                "start_angle_deg": start_angle,
                "start_speed_m_s": start_speed,
                "step_s": step_s,
                "run": thin(asdict(result)),
            }
        )
    for name, case in COIL_CASES.items():
        exhibit = case.get("exhibit", coil.CoilExhibit())
        start_x = case.get("start_x_m")
        start_speed = case.get("start_speed_m_s", 0.0)
        result = coil.run(exhibit, case["visitor"], case["duration_s"], start_x, start_speed)
        out["coil"].append(
            {
                "name": name,
                "exhibit": asdict(exhibit),
                "visitor": _visitor(case["visitor"]),
                "duration_s": case["duration_s"],
                "start_x_m": start_x,
                "start_speed_m_s": start_speed,
                "run": thin(asdict(result)),
            }
        )
    for name, case in PLATFORM_CASES.items():
        result = platform.run(
            case["body"], case["platform"], case["start"], case["momentum"], case["moves"], case["duration_s"]
        )
        out["platform"].append(
            {
                "name": name,
                "body": asdict(case["body"]),
                "platform": asdict(case["platform"]),
                "start": asdict(case["start"]),
                "momentum": case["momentum"],
                "moves": [asdict(m) for m in case["moves"]],
                "duration_s": case["duration_s"],
                "run": thin(asdict(result)),
            }
        )
    body = platform.Body(shoulder_m=0.22)
    plat = platform.Platform()
    for lean in POSTURES:
        posture = platform.Posture(lean_m=lean)
        out["inertia"].append(
            {
                "body": asdict(body),
                "platform": asdict(plat),
                "posture": asdict(posture),
                "inertia": asdict(platform.inertia(body, plat, posture)),
                "pull_n_at_2pi": platform.pull_n(body, posture, 2 * 3.141592653589793),
            }
        )
    exhibit = coil.CoilExhibit()
    out["timing"] = {
        "exhibit": asdict(exhibit),
        "speed_m_s": TIMING_SPEED_M_S,
        "lates_s": list(TIMING_LATES_S),
        "points": [asdict(p) for p in coil.timing_curve(exhibit, TIMING_SPEED_M_S, TIMING_LATES_S)],
    }
    return out


def serialised() -> str:
    return json.dumps(cases(), indent=1, ensure_ascii=False) + "\n"


if __name__ == "__main__":
    TARGET.parent.mkdir(parents=True, exist_ok=True)
    TARGET.write_text(serialised(), encoding="utf-8")
    sys.stdout.write(f"wrote {TARGET}\n")
