/**
 * The drum's press as the smoke page steps it a frame at a time: a button
 * press follows the port's `pressDepth` and lets go at its end with the ring
 * the port makes of its samples, a hand's press is sampled where the drag
 * holds the skin, the skin springs back once let go, and the auto mode
 * presses too fast, just right and too slow in turn.
 */
import { describe, expect, it } from "vitest";
import type { SmokeExhibitRequest } from "@/shared/types";
import { pressDepth, ringOf } from "./simulate/smoke";
import { AUTO_GAP_S, RETURN_S, dragDepth, release, restingDrum, startPress, stepDrum } from "./smoke-press";
import fixtures from "./test-fixtures.json";

const EXHIBIT = fixtures.defaults.smoke as SmokeExhibitRequest;
const FRAME_S = 1 / 60;
const OFF = { on: false, presses: [0.1, 0.5, 2] as const, exhibit: EXHIBIT };

describe("the drum's press", () => {
  it("pushes the skin in as the button's press says and lets go at its end with the port's ring", () => {
    const drum = restingDrum();
    startPress(drum, "button", 10, 0.5, 0.06, EXHIBIT);
    let made = null;
    let now = 10;
    const times: number[] = [0];
    const depths: number[] = [0];
    while (!made) {
      now += FRAME_S;
      made = stepDrum(drum, now, FRAME_S, OFF);
      times.push(now - 10);
      depths.push(pressDepth(0.06, 0.5, now - 10));
      if (!made) expect(drum.depth).toBeCloseTo(pressDepth(0.06, 0.5, now - 10), 12);
    }
    expect(now - 10).toBeGreaterThanOrEqual(0.5);
    expect(drum.press).toBeNull();
    expect(made.exhibit).toBe(EXHIBIT);
    expect(made.ring).toEqual(ringOf(EXHIBIT, times, depths));
  });

  it("samples a hand's press where the drag holds the skin, once per moment", () => {
    const drum = restingDrum();
    startPress(drum, "drag", 3, 0, 0, EXHIBIT);
    // A frame on the instant the press began adds no second sample at that time.
    stepDrum(drum, 3, 0, OFF);
    expect(drum.press?.times).toEqual([3]);
    drum.depth = dragDepth(0, -0.225, EXHIBIT.drum.stroke_m);
    expect(drum.depth).toBeCloseTo(EXHIBIT.drum.stroke_m / 2, 12);
    stepDrum(drum, 3.1, 0.1, OFF);
    expect(drum.press?.depths).toEqual([0, drum.depth]);
    expect(release(drum)?.ring.duration_s).toBeCloseTo(0.1, 12);
  });

  it("makes no ring of a press too short to have a pace", () => {
    const drum = restingDrum();
    startPress(drum, "drag", 1, 0, 0, EXHIBIT);
    expect(release(drum)).toBeNull();
    expect(release(restingDrum())).toBeNull();
  });

  it("presses the skin no deeper than its stroke, and not at all for a drag upwards", () => {
    expect(dragDepth(0, -5, 0.08)).toBe(0.08);
    expect(dragDepth(0, 0.3, 0.08)).toBe(0);
  });

  it("lets the skin spring back to rest once let go", () => {
    const drum = restingDrum();
    startPress(drum, "drag", 0, 0, 0, EXHIBIT);
    drum.depth = 0.04;
    release(drum);
    stepDrum(drum, 1, RETURN_S / 2, OFF);
    expect(drum.depth).toBeCloseTo(0.02, 12);
    stepDrum(drum, 2, RETURN_S, OFF);
    expect(drum.depth).toBe(0);
  });

  it("presses on its own in auto mode, too fast, just right and too slow in turn, a pause between", () => {
    const drum = restingDrum();
    const auto = { ...OFF, on: true };
    const started: { at: number; duration: number }[] = [];
    for (let now = 0; now < 16; now += FRAME_S) {
      const before = drum.press;
      stepDrum(drum, now, FRAME_S, auto);
      if (drum.press && drum.press !== before) started.push({ at: now, duration: drum.press.duration });
    }
    expect(started.map((s) => s.duration)).toEqual([0.1, 0.5, 2, 0.1]);
    expect(started[1].at - started[0].at).toBeCloseTo(0.1 + AUTO_GAP_S, 1);
    expect(started[2].at - started[1].at).toBeCloseTo(0.5 + AUTO_GAP_S, 1);
  });
});
