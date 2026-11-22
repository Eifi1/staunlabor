import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Shuffle } from "lucide-react";
import { Button } from "@eifi1/ui-kit";
import { useLocale } from "@/shared/i18n/use-locale";
import { formatNumber } from "@/shared/lib/format";
import { useTones } from "@/shared/lib/use-tones";
import type { ChladniModes } from "@/shared/types/experiments";
import { SliderField } from "@/shared/ui/slider-field";
import { Figures, WidgetCard } from "@/shared/ui/widget";
import { Equation } from "./equation";
import { ExhibitFrame } from "./exhibit-frame";
import { BuildPending } from "./build-pending";
import { PreviewPending, type PreviewMode, type PreviewProps } from "./preview-mode";
import { useFrameLoop, useRunning } from "./play";
import { RunPauseButton, SoundSwitch } from "./play-controls";
import { settingNumber, useCheckSetting } from "./check-setting";
import { frequencyHz, modeGrids, response, responseFrom, type Mode, type Plate } from "./simulate/chladni";
import { SIDE } from "./stage";
import { useChladniModes, useExperimentsDefaults } from "./use-experiments";

/** The plate's answer is worked out on this many points a side; the sand
 *  reads between them. */
const GRID = 81;
const GRAINS = 2500;
/** How far a grain drifts down the swing's slope, and how far it is thrown
 *  where the plate swings, per frame, in plate half-widths. A drawing rule:
 *  real sand bounces, and these make it settle in a second or two. */
const DRIFT = 0.004;
const TOSS = 0.02;
/** The drive's range, Hz, and the tone the preview rings. */
const LOWEST_HZ = 50;
const HIGHEST_HZ = 3000;
const PREVIEW_MODE = 3;

interface Grain {
  x: number;
  y: number;
}

function strew(count: number): Grain[] {
  return Array.from({ length: count }, () => ({ x: Math.random() * 2 - 1, y: Math.random() * 2 - 1 }));
}

/** The plate's swing on the grid at `driveHz`, scaled to 1 at its largest. */
function swingGrid(plate: Plate, modes: Mode[], grids: Float64Array[], driveHz: number): Float64Array {
  const centre = Math.floor(GRID / 2) * GRID + Math.floor(GRID / 2);
  const middle = grids.map((g) => g[centre]);
  const out = new Float64Array(GRID * GRID);
  let most = 0;
  for (let p = 0; p < GRID * GRID; p++) {
    out[p] = responseFrom(
      plate,
      modes,
      driveHz,
      grids.map((g) => g[p]),
      middle,
    );
    most = Math.max(most, out[p]);
  }
  for (let p = 0; p < out.length; p++) out[p] /= most || 1;
  return out;
}

/** Bilinear: the swing between the grid's points. */
function at(swing: Float64Array, x: number, y: number): number {
  const fx = ((x + 1) / 2) * (GRID - 1);
  const fy = ((y + 1) / 2) * (GRID - 1);
  const i = Math.min(GRID - 2, Math.max(0, Math.floor(fx)));
  const j = Math.min(GRID - 2, Math.max(0, Math.floor(fy)));
  const u = fx - i;
  const v = fy - j;
  const s = (a: number, b: number) => swing[a * GRID + b];
  return (1 - u) * (1 - v) * s(i, j) + u * (1 - v) * s(i + 1, j) + (1 - u) * v * s(i, j + 1) + u * v * s(i + 1, j + 1);
}

/**
 * Chladni figures (`experiments.chladni`): a square plate shaken at its middle,
 * its modes from the engine (`GET /experiments/chladni`), summed and scaled in
 * the browser (`simulate/chladni.ts`, held to the engine by `simulate.test.ts`).
 * The sand is a drawing rule. The second page that can sound, muted until the
 * reader turns the tone on.
 */
export function ChladniPage() {
  const { t } = useTranslation();
  const defaults = useExperimentsDefaults();
  const modes = useChladniModes();
  const plate = defaults.data?.chladni ?? null;
  const failed = defaults.error ?? modes.error;
  return (
    <ExhibitFrame
      exhibit="chladni"
      atTheExhibit={
        <>
          <p>{t("experiments.chladni.at.plate")}</p>
          <p>{t("experiments.chladni.at.sand")}</p>
        </>
      }
      whatHappens={<ChladniModel />}
      computed={<ChladniComputed />}
      sweetSpot={<ChladniTrick />}
    >
      {defaults.isPending || modes.isPending || !plate || !modes.data ? (
        <BuildPending pending={defaults.isPending || modes.isPending} error={failed} />
      ) : (
        <ChladniPlay plate={plate} data={modes.data} />
      )}
    </ExhibitFrame>
  );
}

/** One tone's figure gathering, for the overview. Silent. */
export function ChladniPreview({ paused }: PreviewProps) {
  const defaults = useExperimentsDefaults();
  const modes = useChladniModes();
  const plate = defaults.data?.chladni;
  return plate && modes.data ? (
    <ChladniPlay plate={plate} data={modes.data} preview paused={paused} />
  ) : (
    <PreviewPending />
  );
}

function SandView({ grains, label }: { grains: Grain[]; label: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext?.("2d");
    if (!el || !ctx) return;
    const size = el.width;
    const style = getComputedStyle(el);
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = style.getPropertyValue("--plate") || "#9a9a9a";
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = style.color;
    for (const g of grains) ctx.fillRect(((g.x + 1) / 2) * size - 1, ((1 - g.y) / 2) * size - 1, 2.2, 2.2);
  }, [grains]);
  return (
    <canvas
      ref={canvas}
      width={480}
      height={480}
      role="img"
      aria-label={label}
      className="aspect-square w-full rounded-lg border border-subtle bg-surface-2 text-primary [--plate:color-mix(in_oklab,currentColor_12%,transparent)]"
    />
  );
}

function ChladniPlay({
  plate,
  data,
  preview = false,
  paused = false,
}: { plate: Plate; data: ChladniModes } & PreviewMode) {
  const { t } = useTranslation();
  const locale = useLocale();
  const modes = data.modes as Mode[];
  const tones = useMemo(() => modes.map((mode) => frequencyHz(plate, mode.lam)), [modes, plate]);
  const [driveHere, setDrive] = useState(() => Math.round(tones[0]));
  const drive = preview ? tones[Math.min(PREVIEW_MODE, tones.length - 1)] : driveHere;
  const [sound, setSound] = useState(false);
  const grids = useMemo(() => modeGrids(modes, data.degree, GRID), [modes, data.degree]);
  const swing = useMemo(() => swingGrid(plate, modes, grids, drive), [plate, modes, grids, drive]);
  // How hard the middle swings against the lowest tone's: the sound's level.
  const share = useMemo(
    () => response(plate, modes, data.degree, drive, 0, 0) / response(plate, modes, data.degree, tones[0], 0, 0),
    [plate, modes, data.degree, tones, drive],
  );
  // Loud at a tone, soft between: the square root keeps the soft audible.
  const tone = useTones(sound && !preview, [drive], [Math.sqrt(Math.min(1, share))]);
  const sand = useRef(strew(GRAINS));
  const [grains, setGrains] = useState<Grain[]>(() => strew(GRAINS));
  const { running, setRunning } = useRunning({ preview, paused });

  // The sand moves by a nudge a frame, not by a time step: it shows where the
  // plate rests, and how fast it gets there is not the exhibit's.
  useFrameLoop(running, () => {
    for (const g of sand.current) {
      const here = at(swing, g.x, g.y);
      const h = 2 / (GRID - 1);
      const gx = (at(swing, g.x + h, g.y) - at(swing, g.x - h, g.y)) / (2 * h);
      const gy = (at(swing, g.x, g.y + h) - at(swing, g.x, g.y - h)) / (2 * h);
      g.x += -DRIFT * gx + TOSS * here * (Math.random() * 2 - 1);
      g.y += -DRIFT * gy + TOSS * here * (Math.random() * 2 - 1);
      g.x = Math.max(-1, Math.min(1, g.x));
      g.y = Math.max(-1, Math.min(1, g.y));
    }
    setGrains([...sand.current]);
  });

  // A check case's "Set it up": the shaker at the case's tone, to the hundredth
  // of a hertz the slider's whole hertz cannot reach, and the sand moving.
  useCheckSetting("chladni", (setting) => {
    if (preview) return false;
    setDrive(settingNumber(setting, "drive_hz", drive));
    setRunning(true);
    return true;
  });
  const view = <SandView grains={grains} label={t("experiments.chladni.view")} />;
  if (preview) return view;
  const nearest = tones.reduce((best, f) =>
    Math.abs(Math.log(f / drive)) < Math.abs(Math.log(best / drive)) ? f : best,
  );
  const restrew = () => {
    sand.current = strew(GRAINS);
    setGrains([...sand.current]);
    setRunning(true);
  };
  /** A tone, or fresh sand, is the reader asking to see the sand move: paused
   *  (reduced motion), it starts the clock. */
  const ring = (hz: number) => {
    setDrive(hz);
    setRunning(true);
  };
  return (
    <WidgetCard
      title={t("experiments.chladni.play.title")}
      hint={t("experiments.chladni.play.hint")}
      actions={
        <>
          <RunPauseButton running={running} onToggle={() => setRunning(!running)} />
          <Button variant="secondary" size="sm" onClick={restrew}>
            <Shuffle className="size-4" aria-hidden />
            {t("experiments.chladni.play.restrew")}
          </Button>
        </>
      }
    >
      <div className={`${SIDE.grid} ${SIDE.cap.md}`}>
        <div className={`${SIDE.top} space-y-2`}>
          <p className="text-sm font-medium text-primary">{t("experiments.chladni.play.tones")}</p>
          <div className="flex flex-wrap gap-2">
            {tones.map((f) => (
              <Button
                key={f}
                variant={Math.abs(f - drive) < 0.5 ? "accent" : "secondary"}
                size="sm"
                onClick={() => ring(Math.round(f * 10) / 10)}
              >
                {`${formatNumber(f, 0, locale)} Hz`}
              </Button>
            ))}
          </div>
        </div>
        <div className={`${SIDE.views} mx-auto w-full max-w-md`}>{view}</div>
        <div className={SIDE.column}>
          <SliderField
            label={t("experiments.chladni.play.drive")}
            unit="Hz"
            value={drive}
            min={LOWEST_HZ}
            max={HIGHEST_HZ}
            step={1}
            digits={0}
            log
            hint={t("experiments.chladni.play.drive_hint")}
            onChange={ring}
          />
          <SoundSwitch
            checked={sound}
            onChange={setSound}
            available={tone.available}
            hint={t("experiments.chladni.play.sound_hint")}
          />
          <Figures
            tiles={[
              { key: "nearest", label: t("experiments.chladni.play.nearest"), value: nearest, digits: 0, unit: "Hz" },
              {
                key: "swing",
                label: t("experiments.chladni.play.swing"),
                value: share * 100,
                digits: 1,
                unit: "%",
              },
            ]}
          />
          <p className="text-sm text-secondary">{t("experiments.chladni.play.swing_hint")}</p>
        </div>
      </div>
    </WidgetCard>
  );
}

function ChladniModel() {
  const { t } = useTranslation();
  const s = (key: string) => t(`experiments.chladni.symbols.${key}`);
  return (
    <>
      <p>{t("experiments.chladni.model.intro")}</p>
      <Equation
        tex={String.raw`D\,\nabla^4 w = \rho h\,\omega^2 w`}
        reads={t("experiments.chladni.model.plate")}
        symbols={[
          { tex: "w", meaning: s("w"), unit: "m" },
          { tex: String.raw`D = \frac{E h^3}{12(1-\nu^2)}`, meaning: s("d"), unit: "N·m" },
          { tex: String.raw`\rho`, meaning: s("rho"), unit: "kg/m³" },
          { tex: "h", meaning: s("h"), unit: "m" },
          { tex: String.raw`\omega`, meaning: s("omega"), unit: "1/s" },
          { tex: "E", meaning: s("e"), unit: "Pa" },
          { tex: String.raw`\nu`, meaning: s("nu") },
        ]}
      />
      <Equation
        tex={String.raw`f = \frac{\lambda}{2\pi a^2}\sqrt{\frac{D}{\rho h}}`}
        reads={t("experiments.chladni.model.tones")}
        symbols={[
          { tex: "f", meaning: s("f"), unit: "Hz" },
          { tex: String.raw`\lambda`, meaning: s("lambda") },
          { tex: "a", meaning: s("a"), unit: "m" },
        ]}
      />
      <Equation
        tex={String.raw`w = \sum_k \frac{\varphi_k\,\varphi_k(0)}{\omega_k^2 - \Omega^2 + 2i\zeta\omega_k\Omega}`}
        reads={t("experiments.chladni.model.driven")}
        symbols={[
          { tex: String.raw`\varphi_k`, meaning: s("phi") },
          { tex: String.raw`\Omega`, meaning: s("big_omega"), unit: "1/s" },
          { tex: String.raw`\zeta`, meaning: s("zeta") },
        ]}
      />
    </>
  );
}

function ChladniTrick() {
  const { t } = useTranslation();
  return (
    <>
      <p>{t("experiments.chladni.sweet.still")}</p>
      <p>{t("experiments.chladni.sweet.tones")}</p>
      <p>{t("experiments.chladni.sweet.middle")}</p>
      <p>{t("experiments.chladni.sweet.history")}</p>
    </>
  );
}

function ChladniComputed() {
  const { t } = useTranslation();
  return (
    <>
      <p>{t("experiments.chladni.computed.system")}</p>
      <p>{t("experiments.chladni.computed.left_out")}</p>
    </>
  );
}
