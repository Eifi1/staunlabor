/**
 * The hand the sphere page puts between a finger and the engine's ball: smooth,
 * a hand's speed, and — through the port's own step — able to do what the
 * engine shows a hand can: carry the ball up by speeding up with it, and not by
 * jumping to the final tempo.
 */
import { describe, expect, it } from "vitest";
import {
  angleOf,
  handStep,
  startState,
  STEP_S,
  gravityShare,
  pathRadius,
  G,
  type SphereParameters,
} from "./simulate/sphere";
import {
  HAND_HZ,
  MAX_PUSH_M,
  autopilotTarget,
  clampPush,
  follow,
  leadDeg,
  MAX_TEMPO_HZ,
  perfectTarget,
  restingHand,
  SLOW_HZ_PER_S,
} from "./sphere-hand";

const SPHERE: SphereParameters = { shell_radius_m: 0.2, ball_radius_m: 0.02, ball: "solid", rolling_resistance: 0.005 };

/** The autopilot driving the ball for `seconds`, the tempo set to `setHz`. */
function drive(setHz: number, slowly: boolean, seconds: number) {
  const hand = restingHand();
  let y = startState(SPHERE);
  let highest = 0;
  const steps = Math.round(seconds / STEP_S);
  for (let n = 0; n < steps; n++) {
    const [tx, ty] = autopilotTarget(hand, setHz, slowly, STEP_S);
    const [ax, ay] = follow(hand, tx, ty, STEP_S);
    y = handStep(SPHERE, y, ax, ay);
    highest = Math.max(highest, angleOf(SPHERE, y));
  }
  return { hand, angle: angleOf(SPHERE, y), highest, y };
}

describe("the hand", () => {
  it("follows the finger smoothly and settles where it points", () => {
    const hand = restingHand();
    let largest = 0;
    for (let n = 0; n < 2000; n++) {
      const [ax] = follow(hand, 0.03, 0, STEP_S);
      largest = Math.max(largest, Math.abs(ax));
    }
    expect(hand.x).toBeCloseTo(0.03, 6);
    // A step of the finger is a bounded push, not a spike: ω²·Δx at most.
    expect(largest).toBeLessThanOrEqual((2 * Math.PI * HAND_HZ) ** 2 * 0.03 + 1e-9);
  });

  it("keeps the finger within reach", () => {
    const [x, y] = clampPush(0.3, 0.4);
    expect(Math.hypot(x, y)).toBeCloseTo(MAX_PUSH_M, 12);
    expect(clampPush(0.01, 0.02)).toEqual([0.01, 0.02]);
  });

  it("changes its tempo slowly at the engine's sweep rate, or at once", () => {
    const slow = restingHand();
    for (let n = 0; n < 10_000; n++) autopilotTarget(slow, 2.5, true, STEP_S);
    expect(slow.tempoHz).toBeCloseTo(10 * SLOW_HZ_PER_S, 9);
    const quick = restingHand();
    autopilotTarget(quick, 2.5, false, STEP_S);
    expect(quick.tempoHz).toBe(2.5);
  });

  it("measures the tempo it circles at", () => {
    const { hand } = drive(1.5, false, 6);
    expect(hand.measuredHz).toBeCloseTo(1.5, 1);
  });

  it("says a quarter turn ahead as +90°", () => {
    const hand = restingHand();
    hand.x = 0;
    hand.y = 0.02;
    expect(leadDeg(hand, 0.1, 0)).toBeCloseTo(90, 9);
  });
});

describe("the hand on the engine's ball", () => {
  it("carries the ball up by speeding up with it, and not by jumping", () => {
    // Slowly from rest to 2.5 Hz (42 s at the engine's sweep rate), then held.
    const swept = drive(2.5, true, 50);
    expect(swept.angle).toBeGreaterThan(75);
    const jumped = drive(2.5, false, 50);
    expect(jumped.highest).toBeLessThan(25);
  });
});

describe("perfect timing", () => {
  const f0 = Math.sqrt((G * gravityShare(SPHERE)) / pathRadius(SPHERE)) / (2 * Math.PI);

  function perfect(seconds: number) {
    const hand = restingHand();
    let y = startState(SPHERE);
    const angles: number[] = [];
    const leads: number[] = [];
    const steps = Math.round(seconds / STEP_S);
    for (let n = 0; n < steps; n++) {
      const [tx, ty] = perfectTarget(hand, { x: y[0], y: y[1], vx: y[3], vy: y[4] }, f0, STEP_S);
      const [ax, ay] = follow(hand, tx, ty, STEP_S);
      y = handStep(SPHERE, y, ax, ay);
      if (n % 100 === 0) {
        angles.push(angleOf(SPHERE, y));
        leads.push(leadDeg(hand, y[0], y[1]));
      }
    }
    return { hand, angles, leads, final: angleOf(SPHERE, y) };
  }

  it("climbs faster than any slow sweep, and settles where the arm gives out", () => {
    const run = perfect(30);
    // Past 75° within 15 s, where the slow sweep needs some 40.
    expect(run.angles[150]).toBeGreaterThan(75);
    // At the arm's top tempo the orbit is the engine's: depth g'/Ω².
    const capped = Math.acos((G * gravityShare(SPHERE)) / (pathRadius(SPHERE) * (2 * Math.PI * MAX_TEMPO_HZ) ** 2));
    expect(run.final).toBeGreaterThan(80);
    expect(run.final).toBeLessThan((capped * 180) / Math.PI + 2);
  });

  it("keeps the sphere about a quarter turn ahead of the ball while it climbs", () => {
    const run = perfect(10);
    const climbing = run.leads.slice(30, 90);
    const mean = climbing.reduce((a, b) => a + Math.abs(b), 0) / climbing.length;
    expect(mean).toBeGreaterThan(60);
    expect(mean).toBeLessThan(120);
  });
});
