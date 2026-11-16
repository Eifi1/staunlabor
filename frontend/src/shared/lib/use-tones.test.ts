import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useTones } from "./use-tones";

/** A stand-in for Web Audio that records what the hook builds. */
class FakeContext {
  static made: FakeContext[] = [];
  currentTime = 0;
  closed = false;
  destination = {};
  oscillators: Array<{ frequency: { value: number }; started: boolean; stopped: boolean }> = [];
  targets: number[][] = [];
  constructor() {
    FakeContext.made.push(this);
  }
  createGain() {
    const targets: number[] = [];
    this.targets.push(targets);
    return { gain: { value: 1, setTargetAtTime: (v: number) => targets.push(v) }, connect: () => undefined };
  }
  createOscillator() {
    const o = {
      type: "",
      frequency: { value: 0 },
      started: false,
      stopped: false,
      connect: () => undefined,
      start() {
        o.started = true;
      },
      stop() {
        o.stopped = true;
      },
    };
    this.oscillators.push(o);
    return o;
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

describe("the tones", () => {
  it("build nothing and make no sound while off", () => {
    vi.stubGlobal("AudioContext", FakeContext);
    const { result } = renderHook(() => useTones(false, [200, 300], [1, 1]));
    expect(result.current.available).toBe(true);
    expect(FakeContext.made).toHaveLength(0);
  });

  it("sound one sine per pitch when on, each at its level, held between none and full", () => {
    vi.stubGlobal("AudioContext", FakeContext);
    const { rerender } = renderHook(({ levels }) => useTones(true, [200, 300], levels), {
      initialProps: { levels: [0.5, 2] },
    });
    const context = FakeContext.made[0];
    expect(context.oscillators.map((o) => [o.frequency.value, o.started])).toEqual([
      [200, true],
      [300, true],
    ]);
    // The first gain is the master's; the voices' follow.
    expect(context.targets.slice(1).map((t) => t.at(-1))).toEqual([0.5, 1]);
    rerender({ levels: [-1, 0.25] });
    expect(context.targets.slice(1).map((t) => t.at(-1))).toEqual([0, 0.25]);
  });

  it("close the context when turned off, so no audio device is held", () => {
    vi.stubGlobal("AudioContext", FakeContext);
    const { rerender } = renderHook(({ on }) => useTones(on, [200], [1]), { initialProps: { on: true } });
    const context = FakeContext.made[0];
    rerender({ on: false });
    expect(context.closed).toBe(true);
    expect(context.oscillators[0].stopped).toBe(true);
  });

  it("say so where there is no Web Audio, and do nothing", () => {
    vi.stubGlobal("AudioContext", undefined);
    vi.stubGlobal("webkitAudioContext", undefined);
    const { result } = renderHook(() => useTones(true, [200], [1]));
    expect(result.current.available).toBe(false);
  });
});
