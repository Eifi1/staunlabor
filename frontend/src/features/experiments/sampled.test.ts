import { describe, expect, it } from "vitest";
import { BUILT, sampled } from "./exhibits";

/** A fixed sequence for `random`, so a draw can be named in advance. */
function sequence(...values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

describe("the front page's selection", () => {
  it("draws the asked number of different entries, in the list's order", () => {
    const letters = ["a", "b", "c", "d", "e", "f", "g", "h"];
    // 0.99 swaps the last index to the front, 0 keeps the next in place, 0.99
    // again brings index 0 (swapped back there) in: a, b and h.
    expect(sampled(letters, 3, sequence(0.99, 0, 0.99))).toEqual(["a", "b", "h"]);
  });

  it("gives every exhibit a chance, the newest as much as the first", () => {
    const counts = new Map<string, number>();
    let state = 1;
    const random = () => {
      state = (state * 48271) % 2147483647;
      return state / 2147483647;
    };
    for (let i = 0; i < 2000; i++) {
      for (const entry of sampled(BUILT, 6, random)) counts.set(entry.exhibit, (counts.get(entry.exhibit) ?? 0) + 1);
    }
    expect(counts.size).toBe(BUILT.length);
    const expected = (2000 * 6) / BUILT.length;
    for (const count of counts.values()) expect(Math.abs(count - expected) / expected).toBeLessThan(0.35);
  });

  it("gives all there are when asked for more", () => {
    expect(sampled(["a", "b"], 6, () => 0.5)).toEqual(["a", "b"]);
  });
});
