/**
 * The controls every twin's play card shares: Run/Pause, Restart, the sound
 * switch and the speed choice, on the shared `experiments.play.*` keys.
 *
 * Each exhibit used to write these out with keys of its own, and the copies
 * drifted: the same Pause was "Anhalten" on most pages and "Pause" on two, a
 * quarter speed was "Zeitlupe (¼)", "¼" or "4× langsamer", and four schemes
 * turned a factor into a catalogue key. One control per job, one wording per
 * control. What stays per exhibit is what is said only there: a sound's hint,
 * a restart that redraws, Foucault's time-lapse.
 */

import { useTranslation } from "react-i18next";
import { Pause, Play, RotateCcw } from "lucide-react";
import { Button, Switch, ToggleGroup } from "@eifi1/ui-kit";

/** The header's Run/Pause: one button whose icon and label say what a press
 *  does next. */
export function RunPauseButton({
  running,
  onToggle,
  disabled = false,
}: {
  running: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <Button variant="secondary" size="sm" disabled={disabled} onClick={onToggle}>
      {running ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
      {running ? t("experiments.play.pause") : t("experiments.play.run")}
    </Button>
  );
}

/** The header's restart: the twin from its start. `label` only where the
 *  restart is something else as well (the harmonograph's, which redraws). */
export function RestartButton({
  onClick,
  label,
  disabled = false,
}: {
  onClick: () => void;
  label?: string;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <Button variant="secondary" size="sm" disabled={disabled} onClick={onClick}>
      <RotateCcw className="size-4" aria-hidden />
      {label ?? t("experiments.play.restart")}
    </Button>
  );
}

/** The sound switch: off until the reader turns it on, and greyed out, with
 *  the reason in place of the hint, where the browser cannot make a sound. */
export function SoundSwitch({
  checked,
  onChange,
  available,
  hint,
}: {
  checked: boolean;
  onChange: (on: boolean) => void;
  available: boolean;
  /** What the sound is, on this exhibit. */
  hint: string;
}) {
  const { t } = useTranslation();
  return (
    <Switch
      label={t("experiments.play.sound")}
      description={available ? hint : t("experiments.play.no_sound")}
      checked={checked}
      disabled={!available}
      onCheckedChange={onChange}
    />
  );
}

/** A speed's catalogue key: the factor with its point written as `_`, which
 *  i18next would read as a nesting (0.25 → `0_25`). */
function speedKey(speed: number): string {
  return String(speed).replace(".", "_");
}

/**
 * How fast the twin's clock runs against real time, as factors. The labels
 * are the shared `experiments.play.speeds.<factor>` set, so a factor reads
 * the same on every exhibit; `labelOf` and `label` only where an exhibit says
 * something else (Foucault's time-lapse, a minute a second).
 */
export function SpeedToggle<S extends number>({
  speeds,
  value,
  onChange,
  label,
  labelOf,
}: {
  speeds: readonly S[];
  value: S;
  onChange: (speed: S) => void;
  label?: string;
  labelOf?: (speed: S) => string;
}) {
  const { t } = useTranslation();
  return (
    <ToggleGroup
      label={label ?? t("experiments.play.speed")}
      labelPlacement="above"
      size="sm"
      overflow="wrap"
      value={String(value)}
      onChange={(v: string) => onChange(speeds.find((s) => String(s) === v) ?? value)}
      options={speeds.map((s) => ({
        value: String(s),
        label: labelOf ? labelOf(s) : t(`experiments.play.speeds.${speedKey(s)}`),
      }))}
    />
  );
}
