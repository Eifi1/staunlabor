/**
 * A slider with its number beside it: drag for the shape, type for the value.
 *
 * `@eifi1/ui-kit`'s `Slider` (since 0.5.0) brings the drawn track, the 24 px
 * pointer target inside a 6 px-looking bar, the logarithmic scale with its zero
 * stop, `aria-valuetext` that says the value rather than a log position, and
 * `select-none` on the label line, so a drag that strays onto the label does
 * not select its text.
 *
 * What is left is this site's pairing, and it is the reason the wrapper stays:
 * the number is the truth and the slider a view of it. The readout is a
 * `NumberField`, so typing a value outside the slider's range keeps the value
 * and pins the thumb at the end — a range is a suggestion about where the
 * interesting values are, and a coil of five thousand turns is still a coil — and its
 * commit-on-blur means typing "12.5" simulates once rather than for "1", "12"
 * and "12." on the way. The spoken value goes through the site's formatter, so
 * a screen reader hears it with the unit and in the page's language.
 */

import { FieldHint, Slider } from "@eifi1/ui-kit";
import { useLocale } from "@/shared/i18n/use-locale";
import { formatNumber, formatQuantity } from "@/shared/lib/format";
import { NumberField } from "./number-field";

export function SliderField({
  label,
  unit,
  value,
  min,
  max,
  step,
  digits,
  log = false,
  zeroStop = false,
  hint,
  disabled,
  onChange,
}: {
  label: string;
  unit: string;
  value: number;
  min: number;
  max: number;
  /** The slider's step on a linear scale, ignored on a logarithmic one. */
  step: number;
  digits: number;
  /** A logarithmic track, from `min` to `max`, for a quantity that spans
   *  orders of magnitude. */
  log?: boolean;
  /** Whether a logarithmic track has that zero stop at all. **Off here**,
   *  against the kit's default: every log slider on an exhibit is a physical
   *  quantity — a stiffness, a Reynolds number — where zero is not a setting
   *  but a different equation, and the engine's bounds refuse it, so the
   *  leftmost stop answered with an error. */
  zeroStop?: boolean;
  /** What the value is and what turning it up costs — a fact, so a
   *  `FieldHint`: the "?" beside the label on a desktop, and since ui-kit 0.34
   *  the words under the track on a touch screen and at Large, where a "?"
   *  cannot be hovered open. */
  hint?: string;
  disabled?: boolean;
  onChange: (next: number) => void;
}) {
  const locale = useLocale();
  return (
    <Slider
      label={label}
      hint={hint ? <FieldHint label={hint} /> : undefined}
      readout={
        <NumberField
          label=""
          unit={unit}
          value={value}
          digits={digits}
          disabled={disabled}
          className="w-32"
          onCommit={onChange}
        />
      }
      value={value}
      min={min}
      max={max}
      step={step}
      scale={log ? "log" : "linear"}
      zeroStop={zeroStop}
      disabled={disabled}
      formatValue={(v) => (unit ? formatQuantity(v, digits, unit, locale) : formatNumber(v, digits, locale))}
      onChange={onChange}
      className="space-y-1"
    />
  );
}
