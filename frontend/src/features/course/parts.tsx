/**
 * The pieces every lesson is built from: a widget's card, its figures, its
 * sliders, the list of what a model leaves out, and the logarithmic axes the
 * kit's charts do not have.
 *
 * One file rather than one per piece because each is a few lines and they are
 * always used together; anything with behaviour of its own (the exercise, the
 * pole plane, the chain animation) has its own module.
 */

import { useTranslation } from "react-i18next";
import { AlertBanner, Disclosure, type SeriesChartAxis } from "@eifi1/ui-kit";
import { apiErrorMessage } from "@/shared/api/client";
import { formatNumber } from "@/shared/lib/format";

export { Figures, Param, WidgetBody, WidgetCard } from "@/shared/ui/widget";

/** What the model deliberately leaves out — every lesson says, folded away so
 *  it does not stand between the reader and the experiment. */
export function Assumptions({ items }: { items: string[] }) {
  const { t } = useTranslation();
  return (
    <Disclosure title={t("course.frame.assumptions")} hint={t("course.frame.assumptions_hint")}>
      <ul className="list-disc space-y-1 pl-5 text-sm text-secondary">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </Disclosure>
  );
}

/** A request that failed, in the server's words; nothing while it is fine. */
export function Failed({ error }: { error: unknown }) {
  const { t } = useTranslation();
  if (error == null) return null;
  return <AlertBanner tone="danger">{apiErrorMessage(error, t("course.failed"))}</AlertBanner>;
}

// ── logarithmic axes ─────────────────────────────────────────────────────────

/** The kit's charts draw linear axes only, so a logarithmic one is drawn as a
 *  linear axis over `log₁₀` of the values, ticked at whole decades and labelled
 *  with the decade's value. A value at or below zero has no logarithm and is
 *  left out of the row (a gap, not a dive to −∞). */
export function log10(value: number): number | undefined {
  return value > 0 && Number.isFinite(value) ? Math.log10(value) : undefined;
}

/** Whole decades across a domain given in `log₁₀`, and the halfway ticks
 *  (2 and 5 times a decade) where the domain is narrow enough for them. */
export function decadeTicks([lo, hi]: [number, number]): number[] {
  const from = Math.floor(lo);
  const to = Math.ceil(hi);
  const ticks: number[] = [];
  for (let d = from; d <= to; d++) {
    ticks.push(d);
    if (to - from <= 3) ticks.push(d + Math.log10(2), d + Math.log10(5));
  }
  return ticks.filter((v) => v >= lo - 1e-9 && v <= hi + 1e-9);
}

/** A decade's label: the value itself between 0.001 and 10 000, a power of ten
 *  outside — "10⁻⁶" reads, "0.000001" has to be counted. */
export function formatDecade(exponent: number, locale: string): string {
  const value = 10 ** exponent;
  const rounded = Math.round(exponent);
  if (Math.abs(exponent - rounded) < 1e-9 && (rounded < -3 || rounded > 4)) {
    const sup = String(rounded)
      .split("")
      .map((c) => "⁰¹²³⁴⁵⁶⁷⁸⁹"[Number(c)] ?? (c === "-" ? "⁻" : c))
      .join("");
    return `10${sup}`;
  }
  const digits = Math.max(0, -Math.floor(exponent + 1e-9));
  return formatNumber(value, digits, locale);
}

/** A y axis over `log₁₀` values, with its title. */
export function logAxis(
  id: string,
  title: string,
  locale: string,
  extra: Partial<SeriesChartAxis> = {},
): SeriesChartAxis {
  return {
    id,
    title,
    tickValues: decadeTicks,
    format: (v: number) => formatDecade(v, locale),
    ...extra,
  } as SeriesChartAxis;
}

/** An x axis over `log₁₀` values. */
export function logX(title: string, locale: string, valueDigits = 2) {
  return {
    key: "x",
    title,
    tickValues: decadeTicks as (domain: [number, number]) => number[],
    format: (v: number) => formatDecade(v, locale),
    label: (v: number) => formatNumber(10 ** v, valueDigits, locale),
  };
}
