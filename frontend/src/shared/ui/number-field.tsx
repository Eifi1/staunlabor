import { NumberField as KitNumberField } from "@eifi1/ui-kit";

/**
 * The site's number field: `@eifi1/ui-kit`'s `NumberField`, with the two habits
 * every call site here shares written once.
 *
 * The field itself — a draft string while typing, one commit on blur or Enter,
 * snapping back rather than sending NaN, an emptied field never read as zero —
 * is the kit's (since 0.5.0). The committed number is rounded to `digits`, so
 * what is sent is what is shown, and the decimal mark is the locale's. What is
 * left is the site's:
 *
 * * **The unit goes in the label** (`unitPlacement="label"`). These fields
 *   stand in narrow boxes — a slider's readout is one — and a suffix eats the
 *   digits a narrow box has room for. An empty unit is "no unit", not
 *   "Label ()".
 * * **No NaN reaches the field**: a value that is not finite shows as empty.
 *
 * No write lock is passed on (`commit`): the site mounts no
 * `WriteLockProvider`, so there is none to reach the field.
 */
export function NumberField({
  label,
  unit,
  value,
  digits,
  className,
  disabled,
  onCommit,
}: {
  label: string;
  unit: string;
  value: number;
  digits: number;
  /** Width for the field, when it stands in a **row** rather than in a grid
   *  column. A row of these sizes each box to its own longest label otherwise,
   *  which is what wraps a four-field row onto two lines. */
  className?: string;
  /** A field that is present but has nothing to say in the build as it
   *  stands. Shown rather than hidden, so the layout around it does not reflow
   *  every time a neighbouring toggle is touched. */
  disabled?: boolean;
  onCommit: (next: number) => void;
}) {
  return (
    <KitNumberField
      label={label}
      unit={unit || undefined}
      unitPlacement="label"
      className={className}
      value={Number.isFinite(value) ? value : null}
      digits={digits}
      disabled={disabled}
      // Not `nullable`, so the kit never commits null here; the guard is for
      // the type rather than for a case that happens.
      onCommit={(next: number | null) => {
        if (next !== null) onCommit(next);
      }}
    />
  );
}
