import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useClicks } from "./use-clicks";

/** A stand-in for Web Audio that records the knocks the hook makes. */
class FakeContext {
  static made: FakeContext[] = [];
  currentTime = 2;
  closed = false;
  destination = {};
  knocks: Array<{ type: string; frequency: { value: number }; start?: number; stop?: number }> = [];
  levels: Array<{ set: number; at: number; ramp?: [number, number] }> = [];
  constructor() {
    FakeContext.made.push(this);
  }
  createGain() {
    const level: { set: number; at: number; ramp?: [number, number] } = { set: 1, at: -1 };
    this.levels.push(level);
    return {
      gain: {
        value: 1,
        setValueAtTime: (v: number, at: number) => Object.assign(level, { set: v, at }),
        exponentialRampToValueAtTime: (v: number, at: number) => Object.assign(level, { ramp: [v, at] }),
      },
      connect: () => undefined,
    };
  }
  createOscillator() {
    const knock: { type: string; frequency: { value: number }; start?: number; stop?: number } = {
      type: "",
      frequency: { value: 0 },
    };
    this.knocks.push(knock);
    return {
      ...knock,
      set type(v: string) {
        knock.type = v;
      },
      frequency: knock.frequency,
      connect: () => undefined,
      start: (at: number) => (knock.start = at),
      stop: (at: number) => (knock.stop = at),
    };
  }
  close() {
    this.closed = true;
    return Promise.resolve();
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
  FakeContext.made = [];
});

describe("the clicks", () => {
  it("build nothing and make no sound while off", () => {
    vi.stubGlobal("AudioContext", FakeContext);
    const { result } = renderHook(() => useClicks(false));
    result.current.click(1, 2000);
    expect(result.current.available).toBe(true);
    expect(FakeContext.made).toHaveLength(0);
  });

  it("knock once per click when on, at its pitch, as loud as asked and held to full, and fade at once", () => {
    vi.stubGlobal("AudioContext", FakeContext);
    const { result } = renderHook(() => useClicks(true));
    result.current.click(0.5, 2800);
    result.current.click(3, 1200);
    const context = FakeContext.made[0];
    expect(context.knocks.map((k) => [k.type, k.frequency.value, k.start])).toEqual([
      ["triangle", 2800, 2],
      ["triangle", 1200, 2],
    ]);
    expect(context.knocks.every((k) => k.stop !== undefined && k.stop > 2 && k.stop < 2.1)).toBe(true);
    // The first gain is the master's; each knock has its own, set and faded.
    expect(context.levels.slice(1).map((l) => l.set)).toEqual([0.5, 1]);
    expect(context.levels.slice(1).every((l) => l.ramp !== undefined && l.ramp[0] < 0.001)).toBe(true);
  });

  it("close the context when turned off, so no audio device is held, and click no more", () => {
    vi.stubGlobal("AudioContext", FakeContext);
    const { result, rerender } = renderHook(({ on }) => useClicks(on), { initialProps: { on: true } });
    const context = FakeContext.made[0];
    rerender({ on: false });
    result.current.click(1, 2000);
    expect(context.closed).toBe(true);
    expect(context.knocks).toHaveLength(0);
  });

  it("say so where there is no Web Audio", () => {
    vi.stubGlobal("AudioContext", undefined);
    vi.stubGlobal("webkitAudioContext", undefined);
    const { result } = renderHook(() => useClicks(true));
    expect(result.current.available).toBe(false);
  });
});
