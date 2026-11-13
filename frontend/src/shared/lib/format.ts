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
