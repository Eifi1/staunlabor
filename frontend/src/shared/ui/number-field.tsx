import {
  FieldHint,
  IntegerField as KitIntegerField,
  NumberField as KitNumberField,
  type CommitScope,
} from "@eifi1/ui-kit";

interface FieldProps {
  label: string;
  unit: string;
  value: number;
  /** A sentence explaining the field, shown behind the "?" on its own label
   *  line — which is where every other field in this app puts one. */
  hint?: string;
  /** Width for the field, when it stands in a **row** rather than in a grid
   *  column. A row of these sizes each box to its own longest label otherwise,
   *  which is what wraps a four-field row onto two lines. */
  className?: string;
  /** A field that is present but has nothing to say in the build as it
   *  stands. Shown rather than hidden, so the layout around it does not reflow
   *  every time a neighbouring toggle is touched. */
  disabled?: boolean;
  /** This field IS its own save — it commits on blur — so under a locked
   *  `WriteLockProvider` it is locked the way the kit's commit controls are:
   *  focusable, read only and `aria-disabled`, nothing can be typed, the step
   *  keys and the calculator off, and the lock's reason in the field's
   *  description — a line under it at Large and on a touch screen, the kit
   *  Tooltip otherwise. The kit's `NumberField` and `IntegerField` take
   *  `commit` themselves since 0.33.1. No provider, or an unlocked one: no
   *  effect — and this site mounts none, so here the prop only passes through.
   *
   *  The kit's `CommitScope` (ui-kit 0.33): `true` is every lock,
   *  `{ except: [...] }` every lock but the ones it names.
   *
   *  Deliberately apart from `disabled`. A save in flight is a moment and must
   *  not disable the field — the commit of one field is what a tab to the next
   *  one fires, and a field disabled under the caret swallows the keystrokes
   *  meant for it. A lock is not a moment. */
  commit?: CommitScope;
  onCommit: (next: number) => void;
}

/** The site's two habits, as the props either of the kit's fields takes. */
function kitProps({ label, unit, value, hint, className, disabled, commit, onCommit }: FieldProps) {
  return {
    label,
    // An empty unit is "no unit", not "Label ()".
    unit: unit || undefined,
    unitPlacement: "label" as const,
    // Only when there is one: a field handed `hint` at all, even undefined,
    // sits in a box of its own (ui-kit 0.22), and a `className` sizing it in
    // a row then sizes the inside of that box instead.
    ...(hint ? { hint: <FieldHint label={hint} /> } : {}),
    className,
    value: Number.isFinite(value) ? value : null,
    disabled,
    commit,
    // Not `nullable`, so the kit never commits null here; the guard is for
    // the type rather than for a case that happens.
    onCommit: (next: number | null) => {
      if (next !== null) onCommit(next);
    },
  };
}

/**
 * The site's number field: `@eifi1/ui-kit`'s `NumberField`, with the two habits
 * every call site here shares written once.
 *
 * The field itself — a draft string while typing, one commit on blur or Enter,
 * snapping back rather than sending NaN, an emptied field never read as zero —
 * is the kit's (since 0.5.0). What is left is the site's rather than the kit's:
 *
 * * **The unit goes in the label** (`unitPlacement="label"`). These fields
 *   stand in narrow boxes — a slider's readout is one — and a suffix eats the
 *   digits a narrow box has room for.
 * * **A hint is a sentence, shown behind the "?" on the label line** — never a
 *   paragraph under the field, which puts a row of fields on several
 *   baselines, and never absolutely positioned where the calculator button
 *   lives. The kit takes the node; this takes the string every call site has.
 * * **A field that saves on blur says so with `commit`**, so that a page's
 *   write lock, where there is one, reaches it as it reaches a Save button —
 *   rather than the field taking a number, sending it on blur and going on
 *   showing it after it was refused.
 *
 * Two things the kit's field does, both towards the field saying what it
 * holds. The committed number is rounded to `digits`, so what is sent is what
 * is shown — a typed 0.0015 in a three-digit field would otherwise display
 * 0.002 and send 0.0015. And the decimal mark is the locale's: a German page
 * shows and takes "1,5". A blur that did not change the number commits nothing.
 *
 * It stays a wrapper in `shared/ui/` rather than a re-export because the
 * habits are the point of it. {@link IntegerField} is the same habits on the
 * kit's field for whole numbers.
 */
export function NumberField({ digits, ...props }: FieldProps & { digits: number }) {
  return <KitNumberField {...kitProps(props)} digits={digits} />;
}

/**
 * A count — turns, balls, steps: the kit's `IntegerField`, which is its
 * `NumberField` with no decimals and no calculator. A whole number of things is
 * typed, not worked out. A quantity that is merely *shown* without decimals — a
 * length in mm — is a {@link NumberField} with `digits={0}`, because there the
 * calculator is worth its button.
 */
export function IntegerField(props: FieldProps) {
  return <KitIntegerField {...kitProps(props)} />;
}
