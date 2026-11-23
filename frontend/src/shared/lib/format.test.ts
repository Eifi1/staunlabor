import { describe, expect, it } from "vitest";
import { formatPowerOfTen, formatSig, powerOfTen, superscript } from "./format";

describe("the site's numbers", () => {
  it("writes significant digits with the site's minus, not a hyphen", () => {
    expect(formatSig(0.0020485, "en-GB")).toBe("0.002049");
    expect(formatSig(-12.345, "en-GB")).toBe("−12.35");
    expect(formatSig(-0.5, "de-CH", 7)).toBe("−0.5");
  });

  it("writes an exponent in superscript digits, its sign too", () => {
    expect(superscript(-17)).toBe("⁻¹⁷");
    expect(superscript(308)).toBe("³⁰⁸");
  });

  it("splits a number into a mantissa and a power of ten, the sign kept with the mantissa", () => {
    const { mantissa, exponent } = powerOfTen(-6.2e-17);
    expect(exponent).toBe(-17);
    expect(mantissa).toBeCloseTo(-6.2, 12);
  });

  it("writes a plain power as one, and any other with its mantissa", () => {
    expect(formatPowerOfTen(1e-4, "en-GB")).toBe("10⁻⁴");
    expect(formatPowerOfTen(3.2e-9, "en-GB")).toBe("3.2·10⁻⁹");
    expect(formatPowerOfTen(0, "en-GB")).toBe("0");
  });
});
