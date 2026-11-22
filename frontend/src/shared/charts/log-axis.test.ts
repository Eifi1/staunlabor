import { describe, expect, it } from "vitest";
import { decadeTicks, formatDecade, log10, logAxis } from "./log-axis";

describe("a logarithmic axis", () => {
  it("ticks at decades and names them readably", () => {
    // Two decades or fewer: the 2 and 5 between them too.
    expect(decadeTicks([0.1, 1.9])).toEqual([Math.log10(2), Math.log10(5), 1, 1 + Math.log10(2), 1 + Math.log10(5)]);
    expect(decadeTicks([-6, 3])).toEqual([-6, -5, -4, -3, -2, -1, 0, 1, 2, 3]);
    expect(formatDecade(-6, "en-GB")).toBe("10⁻⁶");
    expect(formatDecade(-2, "en-GB")).toBe("0.01");
    expect(formatDecade(3, "en-GB")).toBe("1,000");
    expect(log10(0)).toBeUndefined();
    expect(log10(100)).toBe(2);
  });

  it("ticks a wide domain at every second decade, so its labels do not run into one another", () => {
    // The chaos exhibit's gap, from its floor of 10⁻¹⁶ up to a metre or so.
    expect(decadeTicks([-16, 0.3])).toEqual([-16, -14, -12, -10, -8, -6, -4, -2, 0]);
  });

  it("names a decade once, never two ticks the same one", () => {
    const axis = logAxis("y", "Gap", "en-GB");
    const ticks = decadeTicks([-0.4, 1.2]);
    const labels = ticks.map((v) => axis.format!(v));
    expect(new Set(labels).size).toBe(labels.length);
  });
});
