import { formatNumber as kitFormatNumber, formatWithMinus } from "@eifi1/ui-kit";

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

/** A number as a reader would write it: up to four significant digits, the
 *  reader's separators, no trailing zeros — and a negative's minus the one the
 *  rest of the site prints (U+2212, ui-kit 0.49), which a bare `Intl` writes as a
 *  hyphen; the course's `parseEntry` reads either back. */
export function formatSig(value: number, locale: string, significant = 4): string {
  return formatWithMinus(new Intl.NumberFormat(locale, { maximumSignificantDigits: significant }), value);
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

/** A whole number in superscript digits, the exponent of a power of ten:
 *  `⁻¹⁷`. One table for every power the site prints, so a check, a gap and a
 *  chart's decade write the same signs. */
export function superscript(exponent: number): string {
  return [...String(exponent)].map((ch) => SUPERSCRIPT[ch] ?? ch).join("");
}

/** A number split into a mantissa in [1, 10) and the power of ten it is
 *  multiplied by; the sign stays with the mantissa. */
export function powerOfTen(value: number): { mantissa: number; exponent: number } {
  const exponent = Math.floor(Math.log10(Math.abs(value)));
  return { mantissa: value / 10 ** exponent, exponent };
}

/** A number as a power of ten, as the reader writes it: `3·10⁻⁹`, the
 *  mantissa in their locale; zero as zero. The exhibits' gaps span a dozen
 *  orders of magnitude, which fixed digits cannot show. */
export function formatPowerOfTen(value: number, locale: string): string {
  if (value === 0) return formatNumber(0, 0, locale);
  const { mantissa, exponent } = powerOfTen(value);
  // A plain power reads as one: 10⁻⁴, not 1.0·10⁻⁴.
  if (Math.abs(mantissa - 1) < 0.05) return `10${superscript(exponent)}`;
  return `${formatNumber(mantissa, 1, locale)}·10${superscript(exponent)}`;
}
