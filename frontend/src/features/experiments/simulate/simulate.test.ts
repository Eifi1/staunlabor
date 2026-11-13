/**
 * The experiments' browser simulations against the engine they were ported from.
 *
 * `engine-cases.json` is the engine's own answer to a handful of cases, written
 * by `scripts/write-experiments-cases.py` and held to the engine by the
 * backend's `test_experiments_browser.py`; here the port runs the same cases
 * and must land on the same numbers — every figure, every name, and a thinned
 * copy of every curve — to a part in 10⁹ (the last bit of
 * a `pow` or a `cos`, which V8 and glibc are free to round differently).
 *
 * Then what a page does that a replay does not: step the ball by the hand's
 * acceleration frame by frame, and step the car by the buttons as held — each
 * the same arithmetic as the replay, which the last two tests show by driving
 * the frame paths with the replay's own inputs.
 */
import { describe, expect, it } from "vitest";
import cases from "./engine-cases.json";
import * as cannon from "./cannon";
import * as coil from "./coil";
import * as elephant from "./elephant";
import * as pit from "./pit";
import * as platform from "./platform";
import * as smoke from "./smoke";
import * as sphere from "./sphere";

interface Thinned {
  length: number;
  at: number[];
  values: number[];
}

/** By its own keys: `"at" in []` and `"values" in []` are true of every array. */
const isThinned = (value: unknown): value is Thinned =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  Object.keys(value).sort().join() === "at,length,values";

const close = (a: number, b: number, scale = 0) =>
  Math.abs(a - b) <= 1e-9 * Math.max(Math.abs(a), Math.abs(b), scale) + 1e-300;

/** Every place the port and the engine disagree, by path. */
function differences(engine: unknown, port: unknown, where = ""): string[] {
  if (isThinned(engine)) {
    if (!Array.isArray(port)) return [`${where}: not a curve here`];
    if (port.length !== engine.length) return [`${where}: ${port.length} points here, ${engine.length} in the engine`];
    const scale = Math.max(...engine.values.map(Math.abs));
    return engine.at.flatMap((i, k) =>
      close(port[i] as number, engine.values[k], scale)
        ? []
        : [`${where}[${i}]: ${port[i]} here, ${engine.values[k]} in the engine`],
    );
  }
  if (Array.isArray(engine)) {
    if (!Array.isArray(port) || port.length !== engine.length)
      return [`${where}: ${JSON.stringify(port)?.slice(0, 80)} here`];
    return engine.flatMap((item, i) => differences(item, port[i], `${where}[${i}]`));
  }
  if (typeof engine === "object" && engine !== null) {
    if (typeof port !== "object" || port === null) return [`${where}: ${String(port)} here`];
    const a = Object.keys(engine).sort();
    const b = Object.keys(port).sort();
    if (a.join() !== b.join()) return [`${where}: keys ${b.join(", ")} here, ${a.join(", ")} in the engine`];
    return a.flatMap((key) =>
      differences((engine as Record<string, unknown>)[key], (port as Record<string, unknown>)[key], `${where}.${key}`),
    );
  }
  if (typeof engine === "number" && typeof port === "number")
    return close(port, engine) ? [] : [`${where}: ${port} here, ${engine} in the engine`];
  return engine === port ? [] : [`${where}: ${String(port)} here, ${String(engine)} in the engine`];
}

/** The largest relative difference over every number the cases compare. */
function worst(engine: unknown, port: unknown): number {
  if (isThinned(engine)) {
    const scale = Math.max(...engine.values.map(Math.abs));
    return Math.max(
      0,
      ...engine.at.map((i, k) => {
        const a = (port as number[])[i];
        const b = engine.values[k];
        return Math.abs(a - b) / Math.max(Math.abs(a), Math.abs(b), scale, 1e-300);
      }),
    );
  }
  if (Array.isArray(engine)) return Math.max(0, ...engine.map((item, i) => worst(item, (port as unknown[])[i])));
  if (typeof engine === "object" && engine !== null)
    return Math.max(
      0,
      ...Object.keys(engine).map((key) =>
        worst((engine as Record<string, unknown>)[key], (port as Record<string, unknown>)[key]),
      ),
    );
  if (typeof engine === "number" && typeof port === "number")
    return Math.abs(engine - port) / Math.max(Math.abs(engine), Math.abs(port), 1e-300);
  return 0;
}

const visitorOf = (v: (typeof cases.coil)[number]["visitor"]): coil.Visitor => {
  if (v === null) return null;
  if (v.kind === "scripted")
    return { kind: "scripted", presses: (v as { presses: unknown }).presses as coil.Scripted["presses"] };
  const rule = v as { window_m: number; late_s: number; reversed: boolean };
  return { kind: "rule", window_m: rule.window_m, late_s: rule.late_s, reversed: rule.reversed };
};

const sphereRun = (c: (typeof cases.sphere)[number]) =>
  sphere.run(
    c.sphere as sphere.SphereParameters,
    c.drive as sphere.Drive,
    c.start_angle_deg,
    c.start_speed_m_s,
    c.step_s,
  );

const coilRun = (c: (typeof cases.coil)[number]) =>
  coil.run(c.exhibit as coil.CoilExhibit, visitorOf(c.visitor), c.duration_s, c.start_x_m, c.start_speed_m_s);

describe("the port", () => {
  it("runs on the engine's constants", () => {
    const s = cases.constants.sphere;
    expect([
      sphere.G,
      sphere.SOLID,
      sphere.HOLLOW,
      sphere.RESISTANCE_FADE_M_S,
      sphere.STEP_S,
      sphere.SAMPLES_PER_S,
      sphere.MAX_DURATION_S,
    ]).toEqual([s.G, s.SOLID, s.HOLLOW, s.RESISTANCE_FADE_M_S, s.STEP_S, s.SAMPLES_PER_S, s.MAX_DURATION_S]);
    const c = cases.constants.coil;
    expect([
      coil.G,
      coil.MU0,
      coil.RESISTANCE_FADE_M_S,
      coil.STEP_S,
      coil.SAMPLES_PER_S,
      coil.MAX_DURATION_S,
      coil.STEEPEST_RAD,
      coil.STANDING_M_S,
    ]).toEqual([
      c.G,
      c.MU0,
      c.RESISTANCE_FADE_M_S,
      c.STEP_S,
      c.SAMPLES_PER_S,
      c.MAX_DURATION_S,
      c.STEEPEST_RAD,
      c.STANDING_M_S,
    ]);
  });

  it.each(cases.sphere.map((c) => [c.name, c] as const))("runs the ball as the engine does: %s", (_name, c) => {
    expect(differences(c.run, sphereRun(c))).toEqual([]);
  });

  it.each(cases.coil.map((c) => [c.name, c] as const))("runs the car as the engine does: %s", (_name, c) => {
    expect(differences(c.run, coilRun(c))).toEqual([]);
  });

  it("draws the timing curve as the engine does", () => {
    const t = cases.timing;
    const port = coil.timingCurve(t.exhibit as coil.CoilExhibit, t.speed_m_s, t.lates_s);
    expect(differences(t.points, port)).toEqual([]);
  });

  it("runs on the pit's constants", () => {
    const c = cases.constants.pit;
    expect([pit.G, pit.STIFFNESS, pit.LINING_RESTITUTION, pit.BALL_RESTITUTION, pit.FRICTION]).toEqual([
      c.G,
      c.STIFFNESS,
      c.LINING_RESTITUTION,
      c.BALL_RESTITUTION,
      c.FRICTION,
    ]);
    expect([
      pit.SLIP_DAMPING,
      pit.ROLLING,
      pit.DT,
      pit.EVERY,
      pit.STILL_M_S,
      pit.STILL_FOR_S,
      pit.LONGEST_AFTER_S,
    ]).toEqual([c.SLIP_DAMPING, c.ROLLING, c.DT, c.EVERY, c.STILL_M_S, c.STILL_FOR_S, c.LONGEST_AFTER_S]);
  });

  // Balls knocking into balls is chaotic: a last bit rounded the other way
  // would part the two runs within a second. So the pit is held to the engine
  // exactly, every number the cases keep, to the end where they lie still.
  it.each(cases.pit.map((c) => [c.name, c] as const))(
    "lands and heaps the balls as the engine does: %s",
    (_name, c) => {
      const ran = pit.run(c.basin, c.radius_m, c.inertia, c.entries);
      expect(differences(c.run, ran)).toEqual([]);
      expect(worst(c.run, ran)).toBe(0);
      expect(ran.still).toBe(true);
    },
  );

  it("agrees with the engine far inside the margin", () => {
    // Not a second assertion of the same thing: the number the docs quote.
    const all = [
      ...cases.sphere.map((c) => worst(c.run, sphereRun(c))),
      ...cases.coil.map((c) => worst(c.run, coilRun(c))),
    ];
    expect(Math.max(...all)).toBeLessThan(1e-9);
  });
});

describe("the cases", () => {
  it("cross every branch the page can reach", () => {
    expect(cases.sphere.some((c) => c.run.left_the_wall)).toBe(true);
    expect(cases.sphere.some((c) => c.drive.path === "line")).toBe(true);
    expect(cases.sphere.some((c) => c.sphere.ball === "hollow")).toBe(true);
    expect(cases.coil.some((c) => c.run.tops > 0 && c.exhibit.coil.turns === 1600)).toBe(true);
    expect(cases.coil.some((c) => c.exhibit.idle === "open")).toBe(true);
    expect(cases.coil.some((c) => c.visitor?.kind === "scripted")).toBe(true);
  });
});

describe("a page's frames", () => {
  it("step the ball by the hand's acceleration exactly as the replay does", () => {
    // The replay's drive, handed to the frame path one step at a time: the
    // acceleration the drive gives at each Runge–Kutta stage. A page hands it
    // the finger's acceleration held over the step instead.
    const s: sphere.SphereParameters = {
      shell_radius_m: 0.2,
      ball_radius_m: 0.02,
      ball: "solid",
      rolling_resistance: 0.005,
    };
    const d: sphere.Drive = { radius_m: 0.02, start_hz: 0.7, end_hz: 2.0, sweep_s: 2.0, hold_s: 0.0, path: "circle" };
    const replay = sphere.run(s, d);
    let y = sphere.startState(s);
    const steps = 2000;
    for (let i = 0; i < steps; i++)
      y = sphere.step(s, (t) => sphere.shellAcceleration(d, t), i * sphere.STEP_S, y, sphere.STEP_S);
    expect(sphere.angleOf(s, y)).toBe(replay.final_angle_deg);
  });

  it("hold a still hand as no hand at all", () => {
    const s: sphere.SphereParameters = {
      shell_radius_m: 0.2,
      ball_radius_m: 0.02,
      ball: "solid",
      rolling_resistance: 0,
    };
    let y = sphere.startState(s, 40.0);
    for (let i = 0; i < 500; i++) y = sphere.handStep(s, y, 0, 0);
    const replay = sphere.run(
      s,
      { radius_m: 0, start_hz: 0, end_hz: 0, sweep_s: 0, hold_s: 0.5, path: "circle" },
      40.0,
    );
    expect(sphere.angleOf(s, y)).toBe(replay.final_angle_deg);
  });

  it("step the car by the buttons as held exactly as the replay does", () => {
    const c = cases.coil.find((k) => k.name === "the rule")!;
    const ex = c.exhibit as coil.CoilExhibit;
    const visitor = visitorOf(c.visitor);
    const sim = coil.start(ex);
    const steps = 5000;
    for (let n = 0; n < steps; n++) {
      const press = coil.pressOf(visitor, n * coil.STEP_S, sim.y[0], sim.y[1], sim.crossedAt);
      coil.frame(ex, sim, press);
    }
    const replay = coil.run(ex, visitor, steps * coil.STEP_S);
    expect(sim.y[0]).toBe(replay.x_m[replay.x_m.length - 1]);
    expect(coil.account(ex, sim)).toEqual(replay.energy);
  });

  it("refuse what the engine refuses", () => {
    const s: sphere.SphereParameters = {
      shell_radius_m: 0.02,
      ball_radius_m: 0.02,
      ball: "solid",
      rolling_resistance: 0,
    };
    expect(() => sphere.run(s, { radius_m: 0, start_hz: 0, end_hz: 1, sweep_s: 0, hold_s: 1, path: "circle" })).toThrow(
      RangeError,
    );
    const ex = cases.coil[0].exhibit as coil.CoilExhibit;
    expect(() => coil.run({ ...ex, supply_v: 0 }, null, 1)).toThrow(RangeError);
    expect(() => coil.run(ex, null, 1, 5.0)).toThrow(RangeError);
  });
});

describe("the platform's port", () => {
  it("runs on the engine's constants", () => {
    const c = cases.constants.platform;
    expect([platform.SAMPLES_PER_S, platform.MAX_DURATION_S]).toEqual([c.SAMPLES_PER_S, c.MAX_DURATION_S]);
  });

  it.each(cases.platform.map((c) => [c.name, c] as const))("replays %s as the engine does", (_name, c) => {
    const port = platform.run(c.body, c.platform, c.start, c.momentum, c.moves, c.duration_s);
    expect(differences(c.run, port)).toEqual([]);
  });

  it("sums a posture's inertia, part by part, and its pull as the engine does", () => {
    for (const c of cases.inertia) {
      expect(differences(c.inertia, platform.inertia(c.body, c.platform, c.posture))).toEqual([]);
      expect(differences(c.pull_n_at_2pi, platform.pullN(c.body, c.posture, 2 * Math.PI))).toEqual([]);
    }
  });

  it("stops at zero and never turns back", () => {
    expect(platform.frictionStep(0.2, 0.5, 1)).toBe(0);
    expect(platform.frictionStep(-0.2, 0.5, 1)).toBe(0);
    expect(platform.frictionStep(-1, 0.5, 1)).toBe(-0.5);
  });
});

describe("the elephant's port", () => {
  it("runs on the engine's constants", () => {
    const c = cases.constants.elephant;
    expect([
      elephant.G,
      elephant.RHO,
      elephant.DRAG,
      elephant.DECAY,
      elephant.RINGS,
      elephant.SPOKES,
      elephant.STEP_S,
      elephant.SAMPLES_PER_S,
      elephant.MAX_DURATION_S,
      elephant.MAX_TILT_DEG,
    ]).toEqual([
      c.G,
      c.RHO,
      c.DRAG,
      c.DECAY,
      c.RINGS,
      c.SPOKES,
      c.STEP_S,
      c.SAMPLES_PER_S,
      c.MAX_DURATION_S,
      c.MAX_TILT_DEG,
    ]);
    expect(differences(c.SPREAD, elephant.SPREAD)).toEqual([]);
  });

  it.each(cases.elephant.map((c) => [c.name, c] as const))("replays %s as the engine does", (_name, c) => {
    expect(differences(c.run, elephant.run(c.elephant, c.moves, c.duration_s))).toEqual([]);
  });

  it("sums the cross-section, pushes the ball and steps it as the engine does, behind the opening too", () => {
    for (const c of cases.elephant_points) {
      expect(differences(c.cover, elephant.cover(c.elephant, c.s_m, c.e_m))).toEqual([]);
      const state = c.state as elephant.State;
      expect(differences(c.acceleration, elephant.acceleration(c.elephant, c.tilt_deg, state))).toEqual([]);
      expect(differences(c.step, elephant.step(c.elephant, c.tilt_deg, state))).toEqual([]);
    }
  });

  it("refuses what the engine refuses", () => {
    const el = cases.elephant[0].elephant;
    expect(() => elephant.run({ ...el, jet: { ...el.jet, opening_m: 0.2 } }, [], 1)).toThrow(/wider than the opening/);
    expect(() => elephant.run({ ...el, ball: { ...el.ball, mass_kg: 0.001 } }, [], 1)).toThrow(/rises on its own/);
    expect(() => elephant.run(el, [], 61)).toThrow(/a run lasts/);
  });
});

describe("the smoke ring's port", () => {
  it("runs on the engine's constants", () => {
    const c = cases.constants.smoke;
    expect([
      smoke.RHO,
      smoke.NU,
      smoke.FORMATION,
      smoke.RING_SHARE,
      smoke.CORE_SHARE,
      smoke.TURBULENT_GROWTH,
      smoke.FLIGHT_STEP_S,
      smoke.SAMPLES_PER_S,
      smoke.MAX_FLIGHT_S,
      smoke.CEILING_M,
    ]).toEqual([
      c.RHO,
      c.NU,
      c.FORMATION,
      c.RING_SHARE,
      c.CORE_SHARE,
      c.TURBULENT_GROWTH,
      c.FLIGHT_STEP_S,
      c.SAMPLES_PER_S,
      c.MAX_FLIGHT_S,
      c.CEILING_M,
    ]);
  });

  it.each(cases.smoke.map((c) => [c.name, c] as const))("makes the ring of %s as the engine does", (_name, c) => {
    const exhibit = c.exhibit as smoke.SmokeExhibit;
    const ring = smoke.ringOf(exhibit, c.times, c.depths);
    expect(differences(c.ring, ring)).toEqual([]);
    if (c.flight && "flight_s" in c) {
      expect(differences(c.flight, smoke.flight(exhibit, ring, c.flight_s as number))).toEqual([]);
    }
  });

  it("presses as smoothly as the engine samples a press", () => {
    const c = cases.smoke.find((x) => x.name === "half a second")!;
    expect(
      differences(
        c.depths,
        c.times.map((t) => smoke.pressDepth(0.08, 0.5, t)),
      ),
    ).toEqual([]);
  });

  it("refuses what the engine refuses", () => {
    const exhibit = cases.smoke[0].exhibit as smoke.SmokeExhibit;
    expect(() => smoke.ringOf(exhibit, [0, 1], [0, 0.2])).toThrow(/goes down between/);
    expect(() => smoke.ringOf(exhibit, [0], [0])).toThrow(/at least two samples/);
  });
});

describe("the ball cannon's port", () => {
  it("runs on the engine's constants", () => {
    const c = cases.constants.cannon;
    expect([
      cannon.G,
      cannon.RHO,
      cannon.CD,
      cannon.POISSON,
      cannon.STEP_S,
      cannon.SUBSTEPS,
      cannon.CONTACT_STEP_S,
      cannon.SAMPLES_PER_S,
      cannon.MAX_S,
      cannon.MIN_CLOSING_M_S,
      cannon.IMPACT_EVERY,
      cannon.IMPACT_WINDOW_S,
      cannon.LAUNCH_WINDOW_S,
    ]).toEqual([
      c.G,
      c.RHO,
      c.CD,
      c.POISSON,
      c.STEP_S,
      c.SUBSTEPS,
      c.CONTACT_STEP_S,
      c.SAMPLES_PER_S,
      c.MAX_S,
      c.MIN_CLOSING_M_S,
      c.IMPACT_EVERY,
      c.IMPACT_WINDOW_S,
      c.LAUNCH_WINDOW_S,
    ]);
  });

  it.each(cases.cannon.map((c) => [c.name, c] as const))("drops %s as the engine does", (_name, c) => {
    const stack = c.stack as cannon.BallStack;
    expect(differences(c.drop, cannon.drop(stack, c.duration_s))).toEqual([]);
    expect(differences(c.impact_m_s, cannon.impactSpeed(stack))).toEqual([]);
    expect(differences(c.launch, cannon.launch(stack))).toEqual([]);
  });

  it("refuses what the engine refuses", () => {
    const stack = cases.cannon[0].stack as cannon.BallStack;
    expect(() => cannon.drop({ ...stack, balls: [] })).toThrow(/one, two or three/);
    expect(() => cannon.drop({ ...stack, drop_m: 5 })).toThrow(/dropped from/);
    expect(() => cannon.drop({ ...stack, youngs_mpa: 1000 })).toThrow(/Young/);
    expect(() => cannon.drop(stack, 30)).toThrow(/drop lasts/);
  });
});
