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
import * as diver from "./diver";
import * as ship from "./ship";
import * as colour from "./colour";
import * as rainbow from "./rainbow";
import * as sky from "./sky";
import * as slits from "./slits";
import * as polarizer from "./polarizer";
import * as jet from "./jet";
import * as beats from "./beats";
import * as coil from "./coil";
import * as shared from "./constants";
import * as numerics from "./numerics";
import { TO_DEG, TO_RAD, roundHalfEven } from "./python";
import * as cone from "./cone";
import * as coriolis from "./coriolis";
import * as coupled from "./coupled";
import * as cradle from "./cradle";
import * as well from "./well";
import * as resonance from "./resonance";
import * as gyroscope from "./gyroscope";
import * as arch from "./arch";
import * as bounce from "./bounce";
import * as levitation from "./levitation";
import * as circuit from "./circuit";
import * as vessel from "./vessel";
import * as chladni from "./chladni";
import * as elephant from "./elephant";
import * as film from "./film";
import * as foucault from "./foucault";
import * as galton from "./galton";
import * as harmonograph from "./harmonograph";
import * as kapitza from "./kapitza";
import * as maxwell from "./maxwell";
import * as metronomes from "./metronomes";
import * as overhang from "./overhang";
import * as parabola from "./parabola";
import * as peg from "./peg";
import * as pendulum from "./pendulum";
import * as pit from "./pit";
import * as platform from "./platform";
import * as plates from "./plates";
import * as smoke from "./smoke";
import * as sphere from "./sphere";
import * as spring from "./spring";
import * as string from "./string";
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

/** A number (or a name) the engine answered, where it stands, the port's
 *  value there, and the scale of the curve it is a point of (0 off a curve). */
interface Leaf {
  where: string;
  engine: unknown;
  port: unknown;
  scale: number;
}

/** The engine's answer and the port's walked together: every leaf to
 *  compare, and every place the two differ in shape (a missing key, a curve
 *  of another length), which no leaf can show. One walk for `differences` and
 *  `worst`, so a curve is scaled the same way in both. */
function compared(engine: unknown, port: unknown): { leaves: Leaf[]; shape: string[] } {
  const leaves: Leaf[] = [];
  const shape: string[] = [];
  const walk = (e: unknown, p: unknown, where: string) => {
    if (isThinned(e)) {
      if (!Array.isArray(p)) return void shape.push(`${where}: not a curve here`);
      if (p.length !== e.length) return void shape.push(`${where}: ${p.length} points here, ${e.length} in the engine`);
      const scale = Math.max(...e.values.map(Math.abs));
      e.at.forEach((i, k) => leaves.push({ where: `${where}[${i}]`, engine: e.values[k], port: p[i], scale }));
    } else if (Array.isArray(e)) {
      if (!Array.isArray(p) || p.length !== e.length)
        return void shape.push(`${where}: ${JSON.stringify(p)?.slice(0, 80)} here`);
      e.forEach((item, i) => walk(item, p[i], `${where}[${i}]`));
    } else if (typeof e === "object" && e !== null) {
      if (typeof p !== "object" || p === null) return void shape.push(`${where}: ${String(p)} here`);
      const a = Object.keys(e).sort();
      const b = Object.keys(p).sort();
      if (a.join() !== b.join())
        return void shape.push(`${where}: keys ${b.join(", ")} here, ${a.join(", ")} in the engine`);
      for (const key of a)
        walk((e as Record<string, unknown>)[key], (p as Record<string, unknown>)[key], `${where}.${key}`);
    } else {
      leaves.push({ where, engine: e, port: p, scale: 0 });
    }
  };
  walk(engine, port, "");
  return { leaves, shape };
}

/** Every place the port and the engine disagree, by path. */
function differences(engine: unknown, port: unknown): string[] {
  const { leaves, shape } = compared(engine, port);
  return [
    ...shape,
    ...leaves.flatMap(({ where, engine: e, port: p, scale }) => {
      const same = typeof e === "number" && typeof p === "number" ? close(p, e, scale) : e === p;
      return same ? [] : [`${where}: ${String(p)} here, ${String(e)} in the engine`];
    }),
  ];
}

/** The largest relative difference over every number the cases compare. */
function worst(engine: unknown, port: unknown): number {
  return compared(engine, port).leaves.reduce(
    (most, { engine: e, port: p, scale }) =>
      typeof e === "number" && typeof p === "number"
        ? Math.max(most, Math.abs(e - p) / Math.max(Math.abs(e), Math.abs(p), scale, 1e-300))
        : most,
    0,
  );
}

/**
 * Every constant the engine wrote for a module against the port's of the
 * same name: the port's own, else the first of the shared modules named
 * after it that has one (`constants.ts`, `numerics.ts`), as the engine's
 * module imports it from `constants.py` or `numerics.py`. Keyed
 * by what the engine wrote, so a constant the engine gains is compared
 * without a line here; one the port does without (it is only the server's)
 * is named in `notPorted`, and stays unported.
 */
function expectEngineConstants(ports: object[], engine: Record<string, unknown>, notPorted: string[] = []) {
  const sources = ports as Record<string, unknown>[];
  for (const [name, value] of Object.entries(engine)) {
    const source = sources.find((s) => name in s);
    if (notPorted.includes(name)) {
      expect(source, `${name} is ported after all: take it out of notPorted`).toBeUndefined();
      continue;
    }
    expect(source, `${name}: not in the port`).toBeDefined();
    expect(differences(value, source![name]), name).toEqual([]);
  }
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
    expectEngineConstants([sphere, shared], cases.constants.sphere);
    expectEngineConstants([coil, shared], cases.constants.coil);
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
    expectEngineConstants([pit, shared], cases.constants.pit);
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
    expectEngineConstants([platform], cases.constants.platform);
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
    // ν is the server's alone: the figures the page fetches (`elephant.py`).
    expectEngineConstants([elephant, shared], cases.constants.elephant, ["NU"]);
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
    // The press's sampling step is the server's alone: the page samples its own presses.
    expectEngineConstants([smoke], cases.constants.smoke, ["STEP_S"]);
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
    expectEngineConstants([cannon, shared], cases.constants.cannon);
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
    expectEngineConstants([pendulum, shared, numerics], cases.constants.pendulum);
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
    // Where its contact first lies on the rails, as the engine lays it: 3 mm up.
    expect(cone.startFor(ex)).toBe(cases.cone[0].start_x_m);
    expect(cone.startFor(ex)).toBeCloseTo(0.0031, 4);
    expect(cone.startFor({ ...ex, rails: { ...ex.rails, slope_deg: 10 } })).toBeCloseTo(0.2996, 4);
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

describe("the metronomes' port", () => {
  it.each(cases.metronomes.map((c) => [c.name, c] as const))("swings %s as the engine does", (_name, c) => {
    const mt = c.mt as metronomes.Metronomes;
    const start = c.start as metronomes.Start;
    expect(differences(c.detunings, metronomes.detunings(mt))).toEqual([]);
    expect(differences(c.moving_kg, metronomes.movingKg(mt))).toEqual([]);
    expect(differences(c.board_scale_m, metronomes.boardScaleM(mt))).toEqual([]);
    expect(differences(c.coupling, metronomes.coupling(mt))).toEqual([]);
    expect(differences(c.start_state, metronomes.startState(start, mt.count))).toEqual([]);
    expect(differences(c.run, metronomes.run(mt, start, 4.0, c.step_s))).toEqual([]);
  });

  it("steps three started and two held as the engine does, the hand's way, and finds them in step when it does", () => {
    const hand = cases.metronomes_hand;
    const mt = cases.metronomes[0].mt as metronomes.Metronomes;
    const running = hand.running;
    const f = metronomes.rhs(mt, running);
    let y = metronomes.startState("scattered", 5).map((v, i) => (running[i % 5] ? v : 0.0));
    expect(differences(hand.first_rates, f(0.0, y))).toEqual([]);
    const h = metronomes.STEP_S * metronomes.RATE_PER_S;
    for (let k = 0; k < roundHalfEven(2.0 / metronomes.STEP_S); k++) y = numerics.rk4(f, k * h, y, h);
    expect(differences(hand.last, y)).toEqual([]);
    expect(differences(hand.order, metronomes.order(y, running))).toEqual([]);
    expect(differences(hand.board_m, metronomes.boardM(mt, y))).toEqual([]);
    expect(
      differences(
        hand.phase,
        [0, 1, 2, 3, 4].map((i) => metronomes.phase(y[i], y[5 + i])),
      ),
    ).toEqual([]);
    const long = metronomes.run(mt, "scattered", 70.0);
    expect(differences(hand.long_order, long.order)).toEqual([]);
    expect(metronomes.inStepS(long)).toBe(hand.in_step_s);
    expect(metronomes.inStepS(long, 0.95)).toBe(hand.in_step_95_s);
  });

  it("lets a metronome go from its full swing and holds a stopped one upright", () => {
    const y = metronomes.release(new Array<number>(4).fill(0), 1);
    expect(y).toEqual([0, 2 * metronomes.THETA0_RAD, 0, 0]);
    expect(metronomes.hold(y, 1)).toEqual([0, 0, 0, 0]);
  });

  it("refuses what the engine refuses", () => {
    expect(() => metronomes.startState("together", 8)).toThrow(RangeError);
    expect(() => metronomes.rhs(cases.metronomes[0].mt as metronomes.Metronomes, [true])).toThrow(RangeError);
    expect(() => metronomes.run(cases.metronomes[0].mt as metronomes.Metronomes, "scattered", 1000)).toThrow(
      RangeError,
    );
  });
});

describe("the Wilberforce spring's port", () => {
  it.each(cases.spring.map((c) => [c.name, c] as const))("bobs and twists %s as the engine does", (_name, c) => {
    const s = c.s as spring.WilberforceSpring;
    expect(differences(c.inertia_kg_m2, spring.inertiaKgM2(s))).toEqual([]);
    expect(differences(c.alone_rates, spring.aloneRates(s))).toEqual([]);
    expect(differences(c.mode_rates, spring.modeRates(s))).toEqual([]);
    expect(differences(c.beat_s, spring.beatS(s))).toEqual([]);
    expect(differences(c.exchange_share, spring.exchangeShare(s))).toEqual([]);
    expect(differences(c.tuned_radius_m, spring.tunedRadiusM(s))).toEqual([]);
    if (c.start !== null) {
      const [pull, twist] = spring.startState(s, c.start as spring.Start);
      expect(differences([c.pull_m, c.twist_rad], [pull, twist])).toEqual([]);
    }
    const run = spring.run(s, c.pull_m, c.twist_rad, 4.0, c.step_s);
    expect(differences(c.run, run)).toEqual([]);
  });

  it("refuses what the engine refuses", () => {
    const s = cases.spring[0].s as spring.WilberforceSpring;
    expect(() => spring.run(s, 0.07, 0, 1)).toThrow(RangeError);
    expect(() => spring.run(s, 0, 4, 1)).toThrow(RangeError);
    expect(() => spring.run(s, 0.02, 0, 1000)).toThrow(RangeError);
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
    expect(differences(c.step_for, chaos.stepFor(dp, a, b))).toEqual([]);
    expect(differences(c.lyapunov, chaos.lyapunov(dp, a, b, c.lyapunov_s, 1e-4, undefined, c.step_s))).toEqual([]);
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

/** The engine's `kapitza.run`, built from the port's `advance`, the page's
 *  frame loop: let go at rest, sampled as the engine samples. */
function runFrom(k: kapitza.KapitzaPendulum, startDeg: number, durationS: number, stepS: number) {
  const steps = roundHalfEven(durationS / stepS);
  const every = numerics.sampleEvery(stepS);
  const out = { t: [] as number[], theta_deg: [] as number[], pivot_m: [] as number[] };
  let y = kapitza.startState(startDeg);
  for (let i = 0; i <= steps; i += every) {
    out.t.push(i * stepS);
    out.theta_deg.push(y[0] * TO_DEG);
    out.pivot_m.push(kapitza.pivotM(k, i * stepS));
    y = kapitza.advance(k, y, i, Math.min(every, steps - i), stepS);
  }
  return out;
}

describe("Kapitza's pendulum's port", () => {
  it.each(cases.kapitza.map((c) => [c.name, c] as const))("shakes %s as the engine does", (_name, c) => {
    const k = c.k as kapitza.KapitzaPendulum;
    // What the case was asked, as it was asked; the rest the port's answers.
    const port = {
      name: c.name,
      k: c.k,
      start_deg: c.start_deg,
      duration_s: c.duration_s,
      step_s: c.step_s,
      step_for: kapitza.stepFor(k),
      kapitza_hz: kapitza.kapitzaFrequencyHz(k),
      own_hz: kapitza.ownFrequencyHz(k),
      slow_top: kapitza.slowRateTop(k),
      stable_top: kapitza.stable(k, "top"),
      stable_bottom: kapitza.stable(k, "bottom"),
      potential: cases.inputs.kapitza_angles.map((a) => kapitza.effectivePotential(k, a * TO_RAD)),
      floquet:
        c.floquet === null
          ? null
          : {
              monodromy_top: kapitza.monodromy(k, "top"),
              multipliers_top: kapitza.multipliers(k, "top"),
              multipliers_bottom: kapitza.multipliers(k, "bottom"),
              least_hz: kapitza.leastFrequencyHz(k),
              band_hz: kapitza.swingUpBandHz(k),
            },
      run: runFrom(k, c.start_deg, c.duration_s, c.step_s),
    };
    expect(differences(c, port)).toEqual([]);
  });

  it("refuses what the engine refuses", () => {
    const k = cases.kapitza[0].k as kapitza.KapitzaPendulum;
    expect(kapitza.refusal({ ...k, amplitude_m: 0.07 })).not.toBeNull();
    expect(kapitza.refusal({ ...k, frequency_hz: 250 })).not.toBeNull();
    expect(() => kapitza.startState(190)).toThrow(RangeError);
    expect(() => kapitza.monodromy({ ...k, frequency_hz: 0 })).toThrow(RangeError);
  });
});

describe("the waterwheel's port", () => {
  it.each(cases.waterwheel.map((c) => [c.name, c] as const))("turns %s as the engine does", (_name, c) => {
    const w = c.w as waterwheel.WaterWheel;
    expect(waterwheel.regime(w)).toBe(c.regime);
    expect(waterwheel.behaviour(w, waterwheel.run(w, c.duration_s, c.step_tau))).toBe(c.behaviour);
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
    const times = cases.inputs.foucault_times;
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

describe("the Coriolis carousel's port", () => {
  it("throws, turns and finds the lead as the engine does", () => {
    for (const c of cases.coriolis) {
      const th = c.throw as coriolis.Throw;
      expect(differences(c.lead_deg, coriolis.leadDeg(c.c, th.speed_m_s, th.body))).toEqual([]);
      expect(differences(c.path, coriolis.path(c.c, th))).toEqual([]);
    }
  });
});

/** The engine's `run`, sampled from the port's steps as the engine samples
 *  its own (every `every` steps, as the case says), each ball's angle in degrees. */
function cradleRun(c: (typeof cases.cradle)[number]) {
  let [th, w] = cradle.start(c.cr, c.pull);
  const steps = roundHalfEven(c.duration_s / cradle.STEP_S);
  const out = { t: [] as number[], angles_deg: th.map(() => [] as number[]) };
  for (let i = 0; i <= steps; i++) {
    if (i % c.every === 0) {
      out.t.push(i * cradle.STEP_S);
      th.forEach((a, b) => out.angles_deg[b].push(a * TO_DEG));
    }
    if (i < steps) [th, w] = cradle.step(c.cr, th, w);
  }
  return out;
}

describe("Newton's cradle's port", () => {
  it("meets and swings as the engine does", () => {
    for (const c of cases.cradle) {
      expect(differences(c.impact, cradle.impact(c.cr, c.pull))).toEqual([]);
      expect(differences(c.run, cradleRun(c))).toEqual([]);
    }
  });
});

/** The engine's `run`, sampled from the port's steps as the engine samples its
 *  own: every `every` steps, and the moment the ride ends. */
function wellRun(c: (typeof cases.well)[number]) {
  const f = c.f;
  let ride = well.begin(f, c.launch);
  const steps = roundHalfEven(c.duration_s / well.STEP_S);
  const out = { t: [] as number[], r_m: [] as number[], phi_rad: [] as number[], laps: [] as well.Lap[] };
  for (let i = 0; i <= steps; i++) {
    if (i % c.every === 0) {
      out.t.push(ride.t);
      out.r_m.push(ride.y[0]);
      out.phi_rad.push(ride.y[2]);
    }
    if (ride.outcome !== "rolling" || i === steps) break;
    const [next, lap] = well.advance(f, ride);
    ride = next;
    if (lap) out.laps.push(lap);
  }
  if (out.t[out.t.length - 1] !== ride.t) {
    out.t.push(ride.t);
    out.r_m.push(ride.y[0]);
    out.phi_rad.push(ride.y[2]);
  }
  return { ...out, outcome: ride.outcome, end_s: ride.t };
}

describe("the gravity well's port", () => {
  it("rolls, laps and ends as the engine does", () => {
    for (const c of cases.well) {
      const circular = c.circular.map(([r]: number[]) => [r, well.circularSpeed(c.f, r), well.circularPeriod(c.f, r)]);
      expect(differences(c.circular, circular)).toEqual([]);
      expect(differences(c.run, wellRun(c))).toEqual([]);
    }
  });
});

/** The engine's `run`, sampled from the port's steps as the engine samples its
 *  own: every `every` steps, the drive moving by the sweep. */
function resonanceRun(c: (typeof cases.resonance)[number]) {
  const { rack, drive_hz: driveHz, sweep_hz_per_s: sweep } = c;
  let s = resonance.start(rack);
  const steps = roundHalfEven(c.duration_s / resonance.STEP_S);
  const out = { t: [] as number[], drive_hz: [] as number[], tips_m: rack.lengths_m.map(() => [] as number[]) };
  for (let i = 0; i <= steps; i++) {
    const f = driveHz + sweep * i * resonance.STEP_S;
    if (i % c.every === 0) {
      out.t.push(s.t);
      out.drive_hz.push(f);
      s.q.forEach((q, rod) => out.tips_m[rod].push(q));
    }
    if (i < steps) s = resonance.step(rack, s, f);
  }
  return out;
}

describe("the resonance rods' port", () => {
  it("has the engine's mode, frequencies and swings", () => {
    const k = cases.resonance_constants;
    expect(
      differences(k, {
        BETA1: resonance.BETA1,
        GAMMA: resonance.GAMMA,
        LAMBDA: resonance.LAMBDA,
        G: shared.G,
        shape: k.shape.map((_: number, i: number) => resonance.shape(i / 10)),
      }),
    ).toEqual([]);
    for (const c of cases.resonance) {
      const lengths: number[] = c.rack.lengths_m;
      expect(
        differences(
          c.natural_hz,
          lengths.map((L) => resonance.naturalHz(c.rack, L)),
        ),
      ).toEqual([]);
      expect(
        differences(
          c.steady_m,
          lengths.map((L) => resonance.steadyM(c.rack, L, c.drive_hz)),
        ),
      ).toEqual([]);
      expect(differences(c.run, resonanceRun(c))).toEqual([]);
    }
  });
});

/** The engine's `run`, sampled from the port's steps as the engine samples its
 *  own: every `every` steps, stopping where the axle hangs down. */
function gyroscopeRun(c: (typeof cases.gyroscope)[number]) {
  const w = c.wheel;
  const started = gyroscope.start(w, c.release);
  let y = started[0];
  const m = started[1];
  const steps = roundHalfEven(c.duration_s / gyroscope.STEP_S);
  const out = {
    t: [] as number[],
    tilt_deg: [] as number[],
    turn_deg: [] as number[],
    dropped_s: null as number | null,
  };
  for (let i = 0; i <= steps; i++) {
    if (i % c.every === 0) {
      out.t.push(i * gyroscope.STEP_S);
      out.tilt_deg.push(gyroscope.tiltDeg(y));
      out.turn_deg.push(y[2] * TO_DEG);
    }
    if (gyroscope.tiltDeg(y) >= gyroscope.HANGING_DEG) {
      out.dropped_s = i * gyroscope.STEP_S;
      break;
    }
    if (i < steps) y = gyroscope.step(w, m, y);
  }
  return out;
}

describe("the gyroscope wheel's port", () => {
  it("starts, turns, nods and drops as the engine does", () => {
    for (const c of cases.gyroscope) {
      const [y, m] = gyroscope.start(c.wheel, c.release);
      expect(differences({ start: c.start, motion: c.motion }, { start: y, motion: m })).toEqual([]);
      if (c.rates.length) {
        const rates = [
          gyroscope.precessionRadS(c.wheel),
          gyroscope.nutationRadS(c.wheel),
          gyroscope.suitcaseTorqueNM(c.wheel, 90.0),
        ];
        expect(differences(c.rates, rates)).toEqual([]);
      }
      expect(differences(c.run, gyroscopeRun(c))).toEqual([]);
    }
  });
});

describe("the floating top's port", () => {
  it("finds the field, the window and the balance as the engine does", () => {
    const heights = cases.inputs.levitation_heights;
    for (const c of cases.levitation) {
      expect(
        differences(
          c.field,
          heights.map((z) => levitation.axisField(c.base, z)),
        ),
      ).toEqual([]);
      expect(
        differences(
          c.lift_kg,
          heights.map((z) => levitation.liftKg(c.base, c.top, z, c.warming_k)),
        ),
      ).toEqual([]);
      expect(heights.map((z) => levitation.holds(c.base, z))).toEqual(c.holds);
      expect(differences(c.hover, levitation.hover(c.base, c.top, c.warming_k))).toEqual([]);
    }
    expect(new Set(cases.levitation.map((c) => c.hover.state))).toEqual(new Set(["hovers", "lands", "slides"]));
  });

  it("finds no window over a ring that holds no top, as the engine refuses it", () => {
    expect(() =>
      levitation.window({ inner_radius_m: 0.3, outer_radius_m: 0.5, height_m: 0.015, magnetisation_a_m: 3.2e5 }),
    ).toThrow(RangeError);
  });
});

describe("the slow LC circuit's port", () => {
  it("swings, creeps or stands between as the engine does, charge, current, energies and figures", () => {
    const times = cases.inputs.circuit_times;
    for (const c of cases.circuit) {
      expect(circuit.regime(c.circuit)).toBe(c.regime);
      expect(differences(c.rates, circuit.rates(c.circuit))).toEqual([]);
      expect(
        differences(
          c.states,
          times.map((t) => circuit.state(c.circuit, t)),
        ),
      ).toEqual([]);
      expect(
        differences(
          c.energies,
          times.map((t) => circuit.energies(c.circuit, t)),
        ),
      ).toEqual([]);
      expect(differences(c.figures, circuit.figures(c.circuit))).toEqual([]);
    }
    expect(new Set(cases.circuit.map((c) => c.regime))).toEqual(new Set(["swings", "critical", "creeps"]));
  });

  it("holds the charged capacitor before the switch is thrown", () => {
    const build = cases.circuit[0].circuit;
    expect(circuit.state(build, -1)).toEqual(circuit.state(build, 0));
    expect(circuit.state(build, 0)[1]).toBe(0);
  });
});

describe("the draining vessel's port", () => {
  /** The engine's `run`, replayed through the page's own clock: every hole
   *  plugged, each plug at the first step that starts at or after its moment,
   *  one `advance` a step, a sample every so many steps. */
  function replay(c: (typeof cases.vessel)[number]) {
    const v = c.vessel;
    const pending = [...c.plugs].sort((a, b) => a.at_s - b.at_s);
    const opened = v.holes_m.map(() => false);
    const steps = Math.ceil(c.duration_s / vessel.STEP_S - 1e-9);
    const every = Math.max(1, Math.round(1 / (cases.inputs.vessel.samples_per_s * vessel.STEP_S)));
    const out = { t_s: [] as number[], level_m: [] as number[], outflow_l_min: [] as number[] };
    const ranges: number[][] = v.holes_m.map(() => []);
    let state = vessel.filled(v);
    for (let n = 0; n <= steps; n++) {
      const t = n * vessel.STEP_S;
      while (pending.length && pending[0].at_s <= t) {
        const plug = pending.shift()!;
        opened[plug.hole] = plug.opened;
      }
      if (n % every === 0 || n === steps) {
        out.t_s.push(t);
        out.level_m.push(state.level_m);
        out.outflow_l_min.push(vessel.outflow(v, state.level_m, opened));
        v.holes_m.forEach((y, i) => ranges[i].push(opened[i] ? vessel.jetRange(v, state.level_m, y) : 0.0));
      }
      if (n < steps) state = vessel.advance(v, state, opened, (n + 1) * vessel.STEP_S);
    }
    return { ...out, ranges_m: ranges };
  }

  it("drains as the engine does under the hand's plugs: the level, the outflow, the jets and the figures", () => {
    const { levels, times } = cases.inputs.vessel;
    for (const c of cases.vessel) {
      const v = c.vessel;
      expect(differences(c.figures, vessel.figures(v))).toEqual([]);
      expect(
        differences(
          c.ranges,
          levels.map((h) => v.holes_m.map((y) => vessel.jetRange(v, h, y))),
        ),
      ).toEqual([]);
      expect(
        differences(
          c.exact,
          v.holes_m.map((y) => times.map((t) => vessel.levelExact(v, y, t))),
        ),
      ).toEqual([]);
      expect(
        differences(
          c.drain_s,
          v.holes_m.map((y) => vessel.drainTime(v, y)),
        ),
      ).toEqual([]);
      expect(differences(c.run, replay(c))).toEqual([]);
    }
  });

  it("steps by frames of any length to the bit of whole steps, a frame never splitting a step", () => {
    const v = cases.vessel[0].vessel;
    const opened = [true, false, true];
    let framed = vessel.filled(v);
    let stepped = vessel.filled(v);
    // Frames of 1/60 s, every seventh a dropped one of 50 ms, as a browser gives them.
    let clock = 0;
    for (let frame = 0; clock < 20; frame++) {
      clock = Math.min(20, clock + (frame % 7 === 3 ? 0.05 : 1 / 60));
      framed = vessel.advance(v, framed, opened, clock);
    }
    for (let n = 0; n < 4000; n++)
      stepped = { steps: n + 1, level_m: vessel.step(v, stepped.level_m, opened, vessel.STEP_S) };
    expect(framed).toEqual(stepped);
  });
});

describe("the falling plates' port", () => {
  it("brakes, falls and draws the currents as the engine does", () => {
    const { times, depths, points, terms } = cases.inputs.plates;
    for (const c of cases.plates) {
      const column = c.column as plates.MagnetColumn;
      const plate = c.plate as plates.Plate;
      expect(differences(c.teeth, plates.teeth(plate))).toEqual([]);
      expect(differences(c.mass_kg, plates.massKg(plate))).toEqual([]);
      expect(differences(c.brake, plates.brake(column, plate))).toEqual([]);
      expect(
        differences(
          c.brake_at,
          depths.map((s) => plates.brakeAt(column, plate, s)),
        ),
      ).toEqual([]);
      expect(
        differences(
          c.motion,
          times.map((t) => plates.motion(column, plate, t)),
        ),
      ).toEqual([]);
      expect(differences(c.figures, plates.figures(column, plate))).toEqual([]);
      expect(
        differences(
          c.stream,
          depths.flatMap((s) => points.map(([x, y]) => plates.stream(column, plate, s, 0.3, x, y, terms))),
        ),
      ).toEqual([]);
    }
  });

  it("holds the plate at the top before it is let go", () => {
    const { column, plate } = cases.plates[0] as { column: plates.MagnetColumn; plate: plates.Plate };
    expect(plates.motion(column, plate, -1)).toEqual([0, 0]);
  });
});

describe("the bouncing ball's port", () => {
  it("strikes, flies and comes to rest as the engine does", () => {
    const times = cases.inputs.bounce_times;
    for (const c of cases.bounce) {
      const ball = c.ball as bounce.BouncingBall;
      const run = bounce.bounces(ball, c.height_m);
      expect(differences(c.terminal_m_s, bounce.terminalSpeed(ball))).toEqual([]);
      expect(differences(c.run, run)).toEqual([]);
      expect(
        differences(
          c.states,
          times.map((t) => bounce.state(ball, c.height_m, run, t)),
        ),
      ).toEqual([]);
      expect(differences(c.figures, bounce.figures(ball, c.height_m))).toEqual([]);
    }
  });

  it("holds the ball over the plate before it is let go", () => {
    const { ball, height_m } = cases.bounce[0] as { ball: bounce.BouncingBall; height_m: number };
    expect(bounce.state(ball, height_m, bounce.bounces(ball, height_m), -1)).toEqual([height_m, 0]);
  });
});

describe("the overhang's port", () => {
  it("finds each layer's footing, the furthest and the even stacks and the blocks a reach takes as the engine does", () => {
    const c = cases.overhang;
    expect(
      differences(
        c.harmonic,
        c.harmonic.map((_, i) => overhang.harmonic(i + 1)),
      ),
    ).toEqual([]);
    expect(
      differences(
        c.even,
        c.even.map((_, i) => overhang.even(i + 1)),
      ),
    ).toEqual([]);
    for (const s of c.stacks) {
      expect(differences(s.layers, overhang.layers(s.lefts))).toEqual([]);
      expect(overhang.holds(s.lefts)).toBe(s.holds);
      expect(differences(s.overhang, overhang.overhang(s.lefts))).toEqual([]);
    }
    for (const [reach, blocks] of c.blocks_for) expect(overhang.blocksFor(reach)).toBe(blocks);
  });
});

describe("the Cartesian diver's port", () => {
  it("shrinks the bubble, finds the hover depth and steps as the engine does", () => {
    const { squeezes, depths } = cases.inputs.diver;
    for (const c of cases.diver) {
      const d = c.diver as diver.Diver;
      const b = c.bottle as diver.Bottle;
      // The engine's run: let go at rest, a steady squeeze, every step's depth and speed.
      const steps: [number, number][] = [[c.start_m, 0]];
      for (let i = 0; i < 1500; i++) steps.push(diver.step(d, b, ...steps[i], c.squeeze_pa));
      expect(
        differences(c.run, {
          depth_m: steps.map((s) => s[0]),
          speed_m_s: steps.map((s) => s[1]),
        }),
      ).toEqual([]);
      expect(
        differences(
          c.hover_m,
          squeezes.map((s) => diver.hoverDepthM(d, s)),
        ),
      ).toEqual([]);
      expect(
        differences(
          c.bubble_m3,
          squeezes.map((s) => depths.map((z) => diver.bubbleM3(d, z, s))),
        ),
      ).toEqual([]);
      expect(
        differences(
          c.lift_n,
          squeezes.map((s) => depths.map((z) => diver.liftN(d, z, s))),
        ),
      ).toEqual([]);
      expect(differences(c.figures, diver.figures(d, b))).toEqual([]);
    }
  });
});

describe("the ship's port", () => {
  it("floats, finds the centre of buoyancy, rolls and draws the curve as the engine does", () => {
    const { steps, angles_deg: angles } = cases.inputs.ship;
    for (const c of cases.ship) {
      const hull = c.hull as ship.Hull;
      const weight = c.weight as ship.Weight;
      // The engine's run: let go at rest at the start's heel, every step's heel and rate.
      const states: [number, number][] = [[c.start_deg * (Math.PI / 180), 0]];
      for (let i = 0; i < steps; i++) states.push(ship.step(hull, weight, c.damping_per_s, ...states[i]));
      expect(differences(c.run, { phi: states.map((s) => s[0]), rate: states.map((s) => s[1]) })).toEqual([]);
      const rad = angles.map((a) => a * (Math.PI / 180));
      expect(differences(c.arm_m, ship.curveM(hull, weight, angles))).toEqual([]);
      expect(
        differences(
          c.centre,
          rad.map((a) => ship.buoyancyCentre(hull, weight, a)),
        ),
      ).toEqual([]);
      expect(
        differences(
          c.waterline,
          rad.map((a) => ship.waterline(ship.section(hull), ship.displacedM2(hull, weight), a)),
        ),
      ).toEqual([]);
      expect(differences(c.gravity_m, ship.gravityM(hull, weight))).toEqual([]);
      expect(differences(c.inertia_kg_m2, ship.inertiaKgM2(hull, weight))).toEqual([]);
      expect(differences(c.figures, ship.figures(hull, weight))).toEqual([]);
    }
  });
});

describe("the colour port", () => {
  it("weighs a spectrum by the observer and shows it as the engine does", () => {
    const c = cases.colour;
    const wavelengths = cases.inputs.colour_wavelengths;
    expect(
      differences(
        c.matching,
        wavelengths.map((nm) => colour.matching(nm)),
      ),
    ).toEqual([]);
    const filters: Record<string, number[]> = {
      red: colour.WAVELENGTHS_NM.map((nm) => 1 / (1 + Math.exp(-(nm - 600) / 15))),
      rayleigh: colour.WAVELENGTHS_NM.map((nm) => (450 / nm) ** 4),
      line: colour.WAVELENGTHS_NM.map((nm) => (nm === 520 ? 1.0 : 0.0)),
    };
    for (const l of c.lamps) {
      const spectrum = colour.lamp(l.kelvin);
      const xyz = colour.tristimulus(spectrum);
      expect(
        differences(l, {
          kelvin: l.kelvin,
          spectrum,
          xyz,
          rgb: colour.linearRgb(xyz),
          seen: Object.fromEntries(Object.entries(filters).map(([name, f]) => [name, colour.seen(spectrum, f)])),
        }),
      ).toEqual([]);
    }
    for (const s of c.screen) expect(differences(s.shown, colour.onScreen(s.rgb))).toEqual([]);
  });
});

describe("the glass-bead rainbow's port", () => {
  it("traces the rays, spreads their light and colours the ring as the engine does", () => {
    const { impacts, wavelengths } = cases.inputs.rainbow;
    for (const c of cases.rainbow) {
      const bead = c.bead as rainbow.Bead;
      const n = rainbow.indexAt(bead, rainbow.SODIUM_NM);
      const ring = rainbow.ring(bead);
      expect(
        differences(c, {
          bead: c.bead,
          index: wavelengths.map((nm) => rainbow.indexAt(bead, nm)),
          exit: impacts.map((b) => rainbow.exitAngle(n, b)),
          share: impacts.map((b) => rainbow.rayShare(n, b)),
          paths: impacts.map((b) => rainbow.trace(n, b)),
          rainbow: [rainbow.rainbowImpact(n), rainbow.rainbowAngle(n)],
          profiles: wavelengths.map((nm) => rainbow.profile(bead, nm)),
          ring: { r: ring.map((x) => x[0]), g: ring.map((x) => x[1]), b: ring.map((x) => x[2]) },
          figures: rainbow.figures(bead),
        }),
      ).toEqual([]);
    }
  });
});

describe("the blue sky's port", () => {
  it("scatters the lamp's light along the tube and the sun's through the air and its ozone as the engine does", () => {
    const lamp = colour.lamp(sky.LAMP_K);
    const sun = colour.lamp(sky.SUN_K);
    for (const c of cases.sky.tubes) {
      const tube = c.tube as sky.Tube;
      const places = [0.0, tube.length_m / 4, tube.length_m / 2, tube.length_m];
      expect(
        differences(c, {
          tube: c.tube,
          side: places.map((at) => sky.sideLight(tube, at)),
          side_hue: places.map((at) => sky.hue(lamp, sky.sideLight(tube, at))),
          side_brightness: places.map((at) => sky.brightness(lamp, sky.sideLight(tube, at))),
          end: sky.endLight(tube),
          end_hue: sky.hue(lamp, sky.endLight(tube)),
          figures: sky.figures(tube),
        }),
      ).toEqual([]);
    }
    for (const c of cases.sky.sun) {
      const h = c.height_deg;
      const ozone = c.ozone;
      expect(
        differences(c, {
          height_deg: h,
          ozone,
          air_mass: sky.airMass(h),
          ozone_light: sky.ozoneLight(h),
          sun: sky.sunLight(h, ozone),
          sun_hue: sky.hue(sun, sky.sunLight(h, ozone)),
          sun_brightness: sky.brightness(sun, sky.sunLight(h, ozone)),
          sky: sky.skyLight(h, ozone),
          sky_hue: sky.hue(sun, sky.skyLight(h, ozone)),
        }),
      ).toEqual([]);
    }
    // Without the argument, the sky has its ozone, as in the engine.
    expect(sky.skyLight(0)).toEqual(sky.skyLight(0, true));
    for (const c of cases.sky.down) expect(differences(c.light, sky.scatteredDown(c.tau, c.m))).toEqual([]);
  });
});

describe("the soap film's port", () => {
  it("finds the tear, the equal areas and both catenoids where the engine does, a hair either side of each", () => {
    const c = cases.film;
    expect(
      differences(c.constants, {
        tangent_t: film.TANGENT_T,
        tear_ratio: film.TEAR_RATIO,
        equal_t: film.EQUAL_T,
        equal_ratio: film.EQUAL_RATIO,
      }),
    ).toEqual([]);
    expect(
      differences(
        c.spans,
        c.spans.map(([t]) => [t, film.span(t)]),
      ),
    ).toEqual([]);
    for (const k of c.cases) {
      const both = film.catenoids(k.rings);
      expect(differences(k.catenoids, both)).toEqual([]);
      expect(film.tears(k.rings)).toBe(k.tears);
      expect(differences(k.figures, film.figures(k.rings))).toEqual([]);
      const profile =
        both && both.map((cat) => c.zs.map((z) => film.radiusAt(cat.neck_m, (z * k.rings.distance_m) / 2)));
      expect(differences(k.profile, profile)).toEqual([]);
    }
  });
});

describe("the double slit's port", () => {
  it("lights the wall behind two slits, and one, under a laser and white light as the engine does", () => {
    const nms = cases.inputs.slits_nm;
    for (const c of cases.slits) {
      const s = c.slits as slits.Slits;
      const span = (1.5 * 700e-9 * s.distance_m) / s.width_m;
      const ys = Array.from({ length: 81 }, (_, k) => span * ((2 * k) / 80 - 1));
      const channels = (pattern: number[][]) => ({
        r: pattern.map((p) => p[0]),
        g: pattern.map((p) => p[1]),
        b: pattern.map((p) => p[2]),
      });
      expect(
        differences(c, {
          slits: c.slits,
          both: nms.map((nm) => ys.map((y) => slits.intensity(s, nm, y))),
          one: nms.map((nm) => ys.map((y) => slits.intensity(s, nm, y, false))),
          dark: nms.map((nm) => [0, 1, 2, 3].map((k) => slits.darkM(s, nm, k))),
          laser: nms.map((nm) => slits.laserColour(nm)),
          laser_both: channels(slits.laserPattern(s, 532.0, ys)),
          laser_one: channels(slits.laserPattern(s, 650.0, ys, false)),
          white_both: channels(slits.whitePattern(s, ys)),
          white_one: channels(slits.whitePattern(s, ys, false)),
          figures: nms.map((nm) => slits.figures(s, nm)),
        }),
      ).toEqual([]);
    }
  });
});

describe("the third polarising filter's port", () => {
  it("lets each filter of a stack, ideal or real, pass the light the engine does", () => {
    for (const c of cases.polarizer) {
      const sheet = c.sheet as polarizer.Sheet;
      expect(
        differences(c, {
          sheet: c.sheet,
          stacks: c.stacks.map((s) => ({ angles: s.angles, through: polarizer.through(s.angles, sheet) })),
          three: c.three.map((t) => ({
            last_deg: t.last_deg,
            middles: t.middles,
            light: t.middles.map((m) => polarizer.three(m, sheet, t.last_deg)),
          })),
          between: c.between.map((b) => ({
            between: b.between,
            angles: polarizer.evenly(b.between),
            light: polarizer.stacked(b.between, sheet),
          })),
          figures: polarizer.figures(sheet),
        }),
      ).toEqual([]);
    }
  });

  it("keeps the engine's sheets", () => {
    expect(cases.polarizer.map((c) => c.sheet).slice(0, 2)).toEqual([polarizer.IDEAL, polarizer.POLAROID]);
  });
});

describe("the water jet's port", () => {
  it("bends the jet, traces the beam through it and lets its light out as the engine does", () => {
    const { along, cosines } = cases.inputs.jet;
    for (const c of cases.jet) {
      const j = c.jet as jet.Jet;
      const land = jet.landingM(j);
      expect(
        differences(c, {
          jet: c.jet,
          speed_m_s: jet.speedMS(j),
          bend_radius_m: jet.bendRadiusM(j),
          landing_m: land,
          critical: jet.criticalAngle(j.index),
          axis: along.map((s) => jet.axisY(j, s * land)),
          normal: along.map((s) => jet.axisNormal(j, s * land)),
          reflectance: cosines.map((cos) => jet.reflectance(j.index, cos)),
          beams: c.beams.map(({ tilt_deg }) => {
            const b = jet.beam(j, tilt_deg);
            return { tilt_deg, beam: b, figures: jet.figuresOf(j, b) };
          }),
        }),
      ).toEqual([]);
    }
  });
});

describe("the standing string's port", () => {
  it("answers the cord's tones, its steady swing and its stepped modes as the engine does", () => {
    const c = cases.string;
    expect(c.constants).toEqual({
      MODES: string.MODES,
      VIBRATOR_HZ: string.VIBRATOR_HZ,
      MAX_DRIVE_HZ: string.MAX_DRIVE_HZ,
      MAX_STEP_S: string.MAX_STEP_S,
    });
    for (const k of c.cords) {
      const cord = k.cord as string.Cord;
      const f1 = string.modeHz(cord, 1);
      const drives = [0.3, 1.0, 1.5, 3.0, 4.6].map((share) => share * f1);
      const xs = c.points.map((p) => cord.length_m * p);
      let s = string.start();
      const frames = k.run.frames.map((frame) => {
        for (let i = 0; i < frame.count; i++) s = string.step(cord, s, frame.drive_hz, frame.dt);
        return {
          drive_hz: frame.drive_hz,
          dt: frame.dt,
          count: frame.count,
          t: s.t,
          theta: s.theta,
          q: s.q,
          v: s.v,
          place_m: xs.map((x) => string.placeM(cord, s, x)),
          rate_m_s: xs.map((x) => string.rateMS(cord, s, frame.drive_hz, x)),
          swing_m: xs.map((x) => string.swingM(cord, s, frame.drive_hz, x)),
          strobe_m: xs.map((x) => string.strobeM(cord, s, frame.drive_hz, x, c.phase)),
        };
      });
      expect(
        differences(k, {
          cord: k.cord,
          wave_speed_m_s: string.waveSpeedMS(cord),
          modes_hz: [1, 2, 3, 4, 5, 6].map((n) => string.modeHz(cord, n)),
          drives_hz: drives,
          half_waves: drives.map((f) => string.halfWaves(cord, f)),
          pulls_n: [0.5, 1, 2.5, 3].map((n) => string.pullN(cord, string.VIBRATOR_HZ, n)),
          wavenumber: drives.map((f) => [...string.wavenumber(cord, f)]),
          widest_m: drives.map((f) => string.widestM(cord, f)),
          run: { frames },
        }),
      ).toEqual([]);
    }
  });

  it("refuses a drive past its range and a step longer than a frame", () => {
    const cord = cases.string.cords[0].cord as string.Cord;
    expect(() => string.step(cord, string.start(), 0, 0.01)).toThrow();
    expect(() => string.step(cord, string.start(), 10, 0.06)).toThrow();
    expect(() => string.modeHz(cord, 0)).toThrow();
  });
});

describe("the beats' port", () => {
  it("detunes a fork with its rider and sounds the pair as the engine does", () => {
    const c = cases.beats;
    expect(
      differences(
        c.shape,
        Array.from({ length: 11 }, (_, k) => beats.modeShape(k / 10)),
      ),
    ).toEqual([]);
    const { span_s: span, steps } = cases.inputs.beats_times;
    const times = Array.from({ length: steps + 1 }, (_, k) => (span * k) / steps);
    for (const f of c.forks) {
      const fork = f.fork as beats.Fork;
      const second = beats.frequencyHz(fork, f.riders[2].rider as beats.Rider);
      expect(
        differences(f, {
          fork: f.fork,
          riders: f.riders.map((r) => ({
            rider: r.rider,
            hz: beats.frequencyHz(fork, r.rider as beats.Rider),
            figures: beats.figures(fork, r.rider as beats.Rider),
          })),
          loudness: times.map((t) => beats.loudness(fork.frequency_hz, second, fork.decay_s, t)),
          sound: times.map((t) => beats.sound(fork.frequency_hz, second, fork.decay_s, t)),
        }),
      ).toEqual([]);
    }
  });
});

describe("the arch's port", () => {
  it("cuts the stones and finds the thrust line as the engine does", () => {
    for (const c of cases.arch) {
      const stone = c.arch as arch.Arch;
      expect(differences(c.joints, arch.joints(stone))).toEqual([]);
      expect(differences(c.blocks, arch.blocks(stone))).toEqual([]);
      expect(differences(c.thrust, arch.thrust(stone, c.load))).toEqual([]);
    }
  });
});

describe("the Chladni plate's port", () => {
  it("evaluates the route's modes, the tones and the plate's answer as the engine does", () => {
    const c = cases.chladni;
    const { points, tones_hz: tones } = cases.inputs.chladni;
    const modes: chladni.Mode[] = c.modes.map((mode: { lam: number; terms: number[][] }) => ({
      lam: mode.lam,
      m: mode.terms.map((t) => t[0]),
      n: mode.terms.map((t) => t[1]),
      c: mode.terms.map((t) => t[2]),
    }));
    expect(
      differences(
        c.legendre,
        points.map((x) => chladni.legendre(c.degree, x)),
      ),
    ).toEqual([]);
    const values = modes
      .slice(0, 3)
      .map((mode) => points.map((x) => points.map((y) => chladni.modeValue(mode, c.degree, x, y))));
    expect(differences(c.values, values)).toEqual([]);
    expect(
      differences(
        c.frequencies_hz,
        modes.map((mode) => chladni.frequencyHz(c.plate, mode.lam)),
      ),
    ).toEqual([]);
    const responses = tones.map((f) => points.map((x) => chladni.response(c.plate, modes, c.degree, f, x, 0.2)));
    expect(differences(c.responses, responses)).toEqual([]);
    // The grid is the same sum, its polynomials worked out once a line.
    const grid = chladni.modeGrids(modes.slice(0, 1), c.degree, 5)[0];
    const across = [-1, -0.5, 0, 0.5, 1];
    across.forEach((x, i) =>
      across.forEach((y, j) => expect(grid[i * 5 + j]).toBeCloseTo(chladni.modeValue(modes[0], c.degree, x, y), 12)),
    );
  });
});

describe("the Galton board's port", () => {
  const c = cases.galton;
  it("builds every board's shares, figures and normal curve as the engine does", () => {
    for (const b of c.boards) {
      expect(differences(b.shares, galton.shares(b.rows, b.p))).toEqual([]);
      expect(differences(b.figures, galton.figures(b.rows, b.p))).toEqual([]);
      if (b.normal)
        expect(
          differences(
            b.normal,
            b.normal.map((_, k) => galton.normal(b.rows, b.p, k)),
          ),
        ).toEqual([]);
    }
    c.paths.forEach((row, i) => expect(galton.paths(i + 1)).toEqual(row));
  });

  it("draws the engine's numbers from every seed, to the last bit", () => {
    for (const u of c.uniforms) expect(galton.uniforms(u.seed, u.draws.length)).toEqual(u.draws);
  });

  it("drops every run's balls into the engine's bins", () => {
    for (const r of c.runs) {
      const run = galton.drop(r.rows, r.p, r.balls, r.seed);
      expect(run.counts).toEqual(r.counts);
      expect(run.bins.slice(0, r.first_bins.length)).toEqual(r.first_bins);
      expect(run.turns.slice(0, r.turns.length)).toEqual(r.turns);
      expect(differences([r.mean, r.variance], [run.mean, run.variance])).toEqual([]);
    }
  });
});
