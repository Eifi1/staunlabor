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
import * as chaos from "./chaos";
import * as coil from "./coil";
import * as cone from "./cone";
import * as coupled from "./coupled";
import * as elephant from "./elephant";
import * as foucault from "./foucault";
import * as harmonograph from "./harmonograph";
import * as maxwell from "./maxwell";
import * as parabola from "./parabola";
import * as peg from "./peg";
import * as pendulum from "./pendulum";
import * as pit from "./pit";
import * as platform from "./platform";
import * as smoke from "./smoke";
import * as sphere from "./sphere";
import * as waterwheel from "./waterwheel";
import * as wave from "./wave";

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

describe("the pendulum's port", () => {
  it("runs on the engine's constants", () => {
    const c = cases.constants.pendulum;
    expect([pendulum.G, pendulum.STEP_S, pendulum.SAMPLES_PER_S, pendulum.MAX_DURATION_S]).toEqual([
      c.G,
      c.STEP_S,
      c.SAMPLES_PER_S,
      c.MAX_DURATION_S,
    ]);
  });

  it("computes Jacobi's functions as the engine does", () => {
    for (const p of cases.jacobi) expect(differences(p.sncndn, pendulum.jacobi(p.u, p.m))).toEqual([]);
  });

  it("puts the exact pendulum where the engine does, a minute in as well", () => {
    for (const p of cases.pendulum_angles) {
      expect(differences(p.angle_deg, pendulum.angleDeg(p.length_m, p.amplitude_deg, p.t))).toEqual([]);
      expect(differences(p.period_s, pendulum.periodS(p.length_m, p.amplitude_deg))).toEqual([]);
    }
  });

  it.each(cases.swing.map((c) => [c.name, c] as const))("steps %s as the engine does", (_name, c) => {
    const step = "step_s" in c ? c.step_s : undefined;
    const damping = "damping_per_s" in c ? c.damping_per_s : undefined;
    const port = pendulum.swing(c.length_m, c.amplitude_deg, c.duration_s, damping, step);
    expect(differences(c.run, port)).toEqual([]);
  });

  it("refuses what the engine refuses", () => {
    expect(() => pendulum.smallPeriodS(0)).toThrow(RangeError);
    expect(() => pendulum.periodFactor(180)).toThrow(RangeError);
    expect(() => pendulum.swing(1, 10, 1000)).toThrow(RangeError);
    expect(() => pendulum.swing(1, 10, 1, -1)).toThrow(RangeError);
    expect(() => pendulum.jacobi(1, 1.5)).toThrow(RangeError);
    expect(() => pendulum.ellipk(1)).toThrow(RangeError);
    expect(() => pendulum.lengthFor(0)).toThrow(RangeError);
    expect(() => pendulum.agm(0, 1)).toThrow(RangeError);
  });
});

describe("the pendulum wave's port", () => {
  it.each(cases.wave.map((c) => [c.name, c] as const))("tunes and lags %s as the engine does", (_name, c) => {
    expect(differences(c.lengths_m, wave.lengthsM(c.wave))).toEqual([]);
    expect(differences(c.lag_deg, wave.lagDeg(c.wave))).toEqual([]);
    expect(differences(c.spread_deg, wave.spreadDeg(c.wave))).toEqual([]);
  });
});

describe("the harmonograph's port", () => {
  it.each(cases.harmonograph.map((c) => [c.name, c] as const))("draws %s as the engine does", (_name, c) => {
    const h = c.h as harmonograph.Harmonograph;
    expect(differences(c.start, [harmonograph.start(h.pen), harmonograph.start(h.board)])).toEqual([]);
    expect(differences(c.figures, harmonograph.figures(h))).toEqual([]);
    expect(differences(c.run, harmonograph.draw(h, c.duration_s, c.step_s))).toEqual([]);
  });

  it("draws frame by frame what it draws in one go", () => {
    const h = cases.harmonograph[0].h as harmonograph.Harmonograph;
    const whole = harmonograph.draw(h, 2);
    const state = harmonograph.startDrawing(h);
    const points: Array<[number, number]> = [harmonograph.penAt(h, state)];
    // Frames of uneven length, as a browser's are.
    for (const steps of [7, 300, 13, 680, 1000]) {
      harmonograph.advance(h, state, steps, undefined, (s) => {
        if (s.i % 20 === 0) points.push(harmonograph.penAt(h, s));
      });
    }
    expect(points.map((p) => p[0])).toEqual(whole.x_m);
    expect(points.map((p) => p[1])).toEqual(whole.y_m);
  });

  it("refuses what the engine refuses", () => {
    const h = cases.harmonograph[0].h as harmonograph.Harmonograph;
    expect(() => harmonograph.draw(h, 1000)).toThrow(RangeError);
    expect(() => harmonograph.draw(h, 1, 0.02)).toThrow(RangeError);
  });
});

describe("the double cone's port", () => {
  it.each(cases.cone.map((c) => [c.name, c] as const))("rolls %s as the engine does", (_name, c) => {
    const ex = c.ex as cone.ConeExhibit;
    expect(differences(c.slope, cone.axisSlope(ex))).toEqual([]);
    expect(differences(c.contact_factor, cone.contactFactor(ex))).toEqual([]);
    expect(differences(c.threshold_deg, cone.thresholdDeg(ex))).toEqual([]);
    const points = c.points.map((p) => ({
      x_m: p.x_m,
      axis_m: cone.axisHeightM(ex, p.x_m),
      rail_m: cone.railHeightM(ex, p.x_m),
      contact_radius_m: cone.contactRadiusM(ex, p.x_m),
      acceleration: cone.acceleration(ex, p.x_m, 0.4),
    }));
    expect(differences(c.points, points)).toEqual([]);
    expect(differences(c.run, cone.roll(ex, c.start_x_m, c.duration_s, c.step_s))).toEqual([]);
  });

  it("lays the cone where it can roll from, and says when the rails would let it fall through", () => {
    const ex = cases.cone[0].ex as cone.ConeExhibit;
    expect(cone.startFor(ex)).toBe(0);
    expect(cone.startFor({ ...ex, rails: { ...ex.rails, slope_deg: 10 } })).toBe(ex.rails.length_m);
    expect(cone.refusal(ex)).toBeNull();
    expect(cone.refusal({ ...ex, rails: { ...ex.rails, length_m: 0.5 } })).toBe("fall_through");
    expect(() => cone.roll(ex, 0.5, 1)).toThrow(RangeError);
  });
});

describe("the water parabola's port", () => {
  it("shapes the surface as the engine does, wet, dry, spilling and at rest", () => {
    for (const c of cases.parabola_surfaces) {
      expect(differences(c.dry_rate, parabola.dryRate(c.v))).toEqual([]);
      expect(differences(c.spill_rate, parabola.spillRate(c.v))).toEqual([]);
      const rates = c.surfaces.map((s) => s.rate_rad_s);
      expect(
        differences(
          c.surfaces,
          rates.map((r) => parabola.surface(c.v, r)),
        ),
      ).toEqual([]);
      expect(
        differences(
          c.profiles,
          rates.map((r) => parabola.profile(c.v, r)),
        ),
      ).toEqual([]);
      expect(
        differences(
          c.spin_up_s,
          rates.map((r) => parabola.spinUpTimeS(c.v, r)),
        ),
      ).toEqual([]);
    }
  });

  it.each(cases.parabola_spins.map((c) => [c.name, c] as const))("lets the water follow, %s", (_name, c) => {
    const run = parabola.spin(c.v, c.vessel_rate, c.duration_s, c.start_rate, c.step_s);
    expect(differences(c.run, run)).toEqual([]);
  });

  it("steps frame by frame as the replay does", () => {
    const v = cases.parabola_spins[0].v;
    const whole = parabola.spin(v, 10, 1);
    let rate = 0;
    for (let i = 0; i < 100; i++) rate = parabola.spinStep(v, 10, rate, i * parabola.SPIN_STEP_S);
    expect(rate).toBe(whole.water_rate[whole.water_rate.length - 1]);
  });
});

describe("the coupled pendulums' port", () => {
  it.each(cases.coupled.map((c) => [c.name, c] as const))("swings %s as the engine does", (_name, c) => {
    const cp = c.cp as coupled.CoupledPendulums;
    expect(differences(c.mode_rates, coupled.modeRates(cp))).toEqual([]);
    expect(differences(c.beat_s, coupled.beatS(cp))).toEqual([]);
    expect(differences(c.exchange_share, coupled.exchangeShare(cp))).toEqual([]);
    const run = coupled.swing(cp, c.start as coupled.Start, c.amplitude_deg, 4.0, c.step_s);
    expect(differences(c.run, run)).toEqual([]);
  });

  it("refuses what the engine refuses", () => {
    expect(() => coupled.startState("one", 80)).toThrow(RangeError);
    expect(() => coupled.swing(cases.coupled[0].cp as coupled.CoupledPendulums, "one", 5, 1000)).toThrow(RangeError);
  });
});

describe("Galileo's pendulum's port", () => {
  it.each(cases.peg.map((c) => [c.name, c] as const))("swings %s as the engine does", (_name, c) => {
    expect(peg.outcome(c.p)).toBe(c.outcome);
    expect(differences(c.slack_height_m, peg.slackHeightM(c.p))).toEqual([]);
    expect(differences(c.run, peg.run(c.p, c.duration_s, c.step_s))).toEqual([]);
  });

  it("refuses what the engine refuses", () => {
    expect(peg.refusal({ length_m: 1, peg_depth_m: 1.2, start_deg: 30 })).toBe("peg");
    expect(() => peg.run(cases.peg[0].p, 1000)).toThrow(RangeError);
  });
});

describe("Maxwell's wheel's port", () => {
  it.each(cases.maxwell.map((c) => [c.name, c] as const))("rolls %s as the engine does", (_name, c) => {
    const w = c.w as maxwell.MaxwellWheel;
    expect(differences(c.bounces, maxwell.bounces(w, 4))).toEqual([]);
    expect(differences(c.run, maxwell.run(w, c.duration_s, c.samples))).toEqual([]);
  });

  it("refuses what the engine refuses", () => {
    const w = cases.maxwell[0].w as maxwell.MaxwellWheel;
    expect(maxwell.refusal({ ...w, axle_radius_m: 0.1 })).toBe("axle");
    expect(() => maxwell.stateAt(w, -1)).toThrow(RangeError);
  });
});

describe("the chaotic pendulum's port", () => {
  it.each(cases.chaos.map((c) => [c.name, c] as const))("swings %s as the engine does", (_name, c) => {
    const dp = c.dp as chaos.DoublePendulum;
    const [a, b] = c.start;
    expect(differences(c.mode_rates, chaos.modeRates(dp))).toEqual([]);
    expect(differences(c.lyapunov, chaos.lyapunov(dp, a, b, 3.0, 1e-4, undefined, c.step_s))).toEqual([]);
    const port = chaos.run(dp, a, b, c.duration_s, c.nudge_deg, c.step_s);
    // The drift is a difference of two energies a few hundred millionths apart:
    // its last digits are rounding, so it is held absolutely, the rest exactly.
    expect(differences({ ...c.run, energy_drift: 0 }, { ...port, energy_drift: 0 })).toEqual([]);
    expect(Math.abs(port.energy_drift - c.run.energy_drift)).toBeLessThan(1e-12);
  });

  it("refuses what the engine refuses", () => {
    const dp = cases.chaos[0].dp as chaos.DoublePendulum;
    expect(() => chaos.run(dp, 200, 10, 1)).toThrow(RangeError);
    expect(() => chaos.run(dp, 10, 10, 1, 0)).toThrow(RangeError);
  });
});

describe("the waterwheel's port", () => {
  it.each(cases.waterwheel.map((c) => [c.name, c] as const))("turns %s as the engine does", (_name, c) => {
    const w = c.w as waterwheel.WaterWheel;
    expect(waterwheel.regime(w)).toBe(c.regime);
    expect(differences(c.hopf_rho, waterwheel.hopfRho(w))).toEqual([]);
    const levels = Array.from({ length: 8 }, (_, k) => waterwheel.cupLevel(w, 3.0, 20.0, k * 0.785));
    expect(differences(c.levels, levels)).toEqual([]);
    expect(differences(c.run, waterwheel.run(w, c.duration_s, c.step_tau))).toEqual([]);
  });

  it("steps frame by frame as the replay does", () => {
    const w = cases.waterwheel[2].w as waterwheel.WaterWheel;
    const whole = waterwheel.run(w, 5);
    const state = waterwheel.startWheel();
    for (let i = 0; i < Math.round((5 * w.leak_per_s) / waterwheel.STEP_TAU); i++) waterwheel.stepWheel(w, state);
    expect(state.y[0]).toBe(whole.x[whole.x.length - 1]);
    expect(state.angle / (2 * Math.PI)).toBe(whole.turns[whole.turns.length - 1]);
  });
});

describe("Foucault's pendulum's port", () => {
  it("swings and turns as the engine does, from the pole to the south", () => {
    const times = [0.0, 1.3, 3600.0, 86400.0];
    for (const c of cases.foucault) {
      expect(differences(c.degrees_per_hour, foucault.degreesPerHour(c.p))).toEqual([]);
      expect(differences(c.full_turn_h, foucault.fullTurnH(c.p))).toEqual([]);
      expect(differences(c.period_s, foucault.periodS(c.p))).toEqual([]);
      // A day in, the angle's last digits are rounding; held a part in 10⁸.
      times.forEach((t, i) => {
        const [x, y] = foucault.position(c.p, t);
        expect(Math.abs(x - c.positions[i][0])).toBeLessThan(1e-8 * c.p.amplitude_m);
        expect(Math.abs(y - c.positions[i][1])).toBeLessThan(1e-8 * c.p.amplitude_m);
      });
      expect(
        differences(
          c.planes,
          times.map((t) => foucault.planeDeg(c.p, t)),
        ),
      ).toEqual([]);
      expect(differences(c.curve, foucault.latitudeCurve(c.p))).toEqual([]);
    }
  });
});
