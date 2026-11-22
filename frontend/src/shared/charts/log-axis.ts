/**
 * Logarithmic axes for the kit's charts, which draw linear axes only: a
 * logarithmic one is drawn as a linear axis over `log₁₀` of the values, ticked
 * at whole decades and labelled with the decade's value. The course's
 * magnification and decay charts and the chaos exhibit's gap use it, so a
 * decade is ticked and written the same way wherever the site draws one.
 *
 * It does not thin a row or pick a domain: the chart does that, as for any
 * other axis.
 */

import type { SeriesChartAxis, SeriesChartX } from "@eifi1/ui-kit";
import { formatNumber, superscript } from "@/shared/lib/format";

/** The most whole decades an axis is ticked at: across sixteen decades (the
 *  chaos exhibit's gap, from 10⁻¹⁶ up), a tick at each crowded the labels
 *  into one another, so a wide domain is ticked every second or third. */
const MOST_DECADES = 10;

/** A value's `log₁₀`, the row's coordinate on a logarithmic axis. A value at
 *  or below zero has no logarithm and is left out of the row (a gap, not a dive
 *  to −∞). */
export function log10(value: number): number | undefined {
  return value > 0 && Number.isFinite(value) ? Math.log10(value) : undefined;
}

/** Whole decades across a domain given in `log₁₀` (every one, or every n-th on
 *  a wide domain), and the halfway ticks (2 and 5 times a decade) where the
 *  domain is narrow enough for them. */
export function decadeTicks([lo, hi]: [number, number]): number[] {
  const from = Math.floor(lo);
  const to = Math.ceil(hi);
  const step = Math.max(1, Math.ceil((to - from) / MOST_DECADES));
  const ticks: number[] = [];
  for (let d = Math.floor(from / step) * step; d <= to; d += step) {
    ticks.push(d);
    if (to - from <= 3) ticks.push(d + Math.log10(2), d + Math.log10(5));
  }
  return ticks.filter((v) => v >= lo - 1e-9 && v <= hi + 1e-9);
}

/** A decade's label: the value itself between 0.001 and 10 000, a power of ten
 *  outside — "10⁻⁶" reads, "0.000001" has to be counted. */
export function formatDecade(exponent: number, locale: string): string {
  const rounded = Math.round(exponent);
  if (Math.abs(exponent - rounded) < 1e-9 && (rounded < -3 || rounded > 4)) return `10${superscript(rounded)}`;
  const digits = Math.max(0, -Math.floor(exponent + 1e-9));
  return formatNumber(10 ** exponent, digits, locale);
}

/** A y axis over `log₁₀` values, with its title. */
export function logAxis(id: string, title: string, locale: string): SeriesChartAxis {
  return { id, title, tickValues: decadeTicks, format: (v) => formatDecade(v, locale) };
}

/** An x axis over `log₁₀` values, its tooltip heading the value itself. */
export function logX(title: string, locale: string, valueDigits = 2): SeriesChartX {
  return {
    key: "x",
    title,
    tickValues: decadeTicks,
    format: (v) => formatDecade(v, locale),
    label: (v) => formatNumber(10 ** v, valueDigits, locale),
  };
}
