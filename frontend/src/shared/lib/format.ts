import { formatNumber as kitFormatNumber } from "@eifi1/ui-kit";

/**
 * Number formatting for the figures and readouts.
 *
 * Everything here is a physical quantity with a unit, so the decision is only
 * ever "how many decimals" — and that is a property of the QUANTITY, not of the
 * value. The sphere's frequencies want two, its depths in centimetres one:
 * printing the cannon's 2.4 m climb as 2.4137 m would claim a precision its
 * guessed restitution does not have.
 */

/** Locale-aware fixed-decimal formatting: `@eifi1/ui-kit`'s `formatNumber`, in
 *  the positional form the call sites here use. A value that is not finite
 *  prints "—" (the kit's rule since 0.13.1), because "∞ m" is not an answer. */
export function formatNumber(value: number, digits: number, locale: string): string {
  return kitFormatNumber(value, { digits, locale });
}

/** A value with its unit, "3.400 N" — the kit's `unit`, which joins them with a
 *  narrow no-break space so a unit never wraps onto a line of its own, and
 *  leaves the unit off a value it could not format. */
export function formatQuantity(value: number, digits: number, unit: string, locale: string): string {
  return kitFormatNumber(value, { digits, unit, locale });
}

const SUPERSCRIPT: Record<string, string> = {
  "-": "⁻",
  "0": "⁰",
  "1": "¹",
  "2": "²",
  "3": "³",
  "4": "⁴",
  "5": "⁵",
  "6": "⁶",
  "7": "⁷",
  "8": "⁸",
  "9": "⁹",
};

/** A number as a power of ten, as the reader writes it: `3·10⁻⁹`, the
 *  mantissa in their locale; zero as zero. The exhibits' checks and gaps span
 *  a dozen orders of magnitude, which fixed digits cannot show. */
export function formatPowerOfTen(value: number, locale: string): string {
  if (value === 0) return formatNumber(0, 0, locale);
  const exponent = Math.floor(Math.log10(Math.abs(value)));
  const mantissa = value / 10 ** exponent;
  const power = [...String(exponent)].map((ch) => SUPERSCRIPT[ch]).join("");
  // A plain power reads as one: 10⁻⁴, not 1.0·10⁻⁴.
  if (Math.abs(mantissa - 1) < 0.05) return `10${power}`;
  return `${formatNumber(mantissa, 1, locale)}·10${power}`;
}
