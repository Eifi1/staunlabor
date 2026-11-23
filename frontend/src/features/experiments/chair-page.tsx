import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Eye } from "lucide-react";
import { Button, Chip, Switch } from "@eifi1/ui-kit";
import { useLocale } from "@/shared/i18n/use-locale";
import { formatNumber } from "@/shared/lib/format";
import { SliderField } from "@/shared/ui/slider-field";
import { Figures, WidgetCard } from "@/shared/ui/widget";
import { useCheckSetting, settingNumber } from "./check-setting";
import { OrbitView, frameOf } from "./chair-views";
import { Equation } from "./equation";
import { ExhibitFrame } from "./exhibit-frame";
import { BuildPending } from "./build-pending";
import { PreviewPending, type PreviewMode, type PreviewProps } from "./preview-mode";
import { useFrameLoop } from "./play";
import { SIDE, STAGE } from "./stage";
import type { ChairAnalysis } from "@/shared/types";
import { useChair } from "./use-experiments";

/** The auto mode's turn: two seconds at the hole, then once round in twelve,
 *  tilting a little on the way so the depth shows, and back to the hole. */
const HOLD_S = 2;
const ROUND_S = 12;
/** Where the views start, on the page and in a preview held still: turned
 *  off the hole, from where the three are plainly three different things. */
const START_VIEW = { yaw: 35, pitch: 15 } as const;

/** The auto mode's viewpoint `t` seconds in. */
export function autoView(t: number): { yaw: number; pitch: number } {
  const c = t % (HOLD_S + ROUND_S);
  if (c < HOLD_S) return { yaw: 0, pitch: 0 };
  const f = (c - HOLD_S) / ROUND_S;
  const turned = f * 360;
  return { yaw: turned > 180 ? turned - 360 : turned, pitch: 20 * Math.sin(Math.PI * f) ** 2 };
}

/** The exhibit's auto mode alone, for the overview's previews
 *  (`preview-mode.tsx`): the three views going round together and resting at
 *  the hole. Held still, it is the page's first view. */
export function ChairPreview({ paused }: PreviewProps) {
  const chair = useChair();
  return chair.data ? <ChairPlay data={chair.data} preview paused={paused} /> : <PreviewPending />;
}

/**
 * The chair that is three things (`experiments.perspective`): one chamber,
 * three peepholes, one picture — and, from anywhere else, three very
 * different objects. Plato's cave in a box: the hole shows the shadow, the
 * turned view the thing.
 *
 * Every number in the prose is the engine's (`GET /experiments/chair`, held by
 * `tests/unit/test_experiments.py`); the browser turns the viewpoint, with the
 * same projection the engine uses.
 */
export function ChairPage() {
  const { t } = useTranslation();
  const chair = useChair();
  const data = chair.data;

  return (
    <ExhibitFrame
      exhibit="chair"
      atTheExhibit={
        <>
          <p>{t("experiments.chair.at.boxes")}</p>
          <p>{t("experiments.chair.at.round")}</p>
        </>
      }
      whatHappens={<ChairModel />}
      sweetSpot={<ChairTrick data={data ?? null} />}
    >
      {chair.isPending || chair.isError || !data ? (
        <BuildPending pending={chair.isPending} error={chair.error} />
      ) : (
        <ChairPlay data={data} />
      )}
    </ExhibitFrame>
  );
}

/**
 * The three peepholes and their viewpoint: turned by a drag or the sliders,
 * the eye moved off the hole, or the auto mode going round. In a preview only
 * the views, in the auto mode, its clock held by `paused`.
 */
function ChairPlay({ data, preview = false, paused = false }: { data: ChairAnalysis } & PreviewMode) {
  const { t } = useTranslation();
  const [yaw, setYaw] = useState<number>(START_VIEW.yaw);
  const [pitch, setPitch] = useState<number>(START_VIEW.pitch);
  const [autoHere, setAutoHere] = useState(false);
  const [eyeMm, setEyeMm] = useState(0);
  const auto = preview ? !paused : autoHere;
  // A check case's "Set it up": the view and how far the eye is moved.
  useCheckSetting("chair", (setting) => {
    if (preview) return false;
    setAutoHere(false);
    setYaw(settingNumber(setting, "yaw_deg", 0));
    setPitch(settingNumber(setting, "pitch_deg", 0));
    setEyeMm(settingNumber(setting, "eye_mm", 0));
    return true;
  });
  const half = useMemo(() => frameOf(data.boxes[0]), [data]);

  // The auto mode: the views go once round every fourteen seconds, resting at
  // the hole for two. A slider or a drag by the reader stops it; switched on,
  // it starts at the hole. Its time is the frames' time, so a preview held
  // off screen goes on from where it was.
  const elapsed = useRef(0);
  useFrameLoop(auto, (dt) => {
    elapsed.current += dt;
    const view = autoView(elapsed.current);
    setYaw(view.yaw);
    setPitch(view.pitch);
  });
  const setAuto = (on: boolean) => {
    if (on) elapsed.current = 0;
    setAutoHere(on);
  };
  const turn = (nextYaw: number, nextPitch: number) => {
    setAuto(false);
    setYaw(nextYaw);
    setPitch(nextPitch);
  };

  if (preview) {
    return (
      <div className="grid grid-cols-3 gap-2">
        {data.boxes.map((box) => (
          <OrbitView
            key={box.figure.kind}
            peephole={box}
            yaw={yaw}
            pitch={pitch}
            half={half}
            onTurn={() => {}}
            label={t("experiments.chair.views.view", { name: t(`experiments.chair.kinds.${box.figure.kind}`) })}
          />
        ))}
      </div>
    );
  }

  // One picture only at the hole and with the eye moved less than the engine's
  // tolerance: past it a joint of the scattered rods opens to a minute of arc.
  const atTheHole = Math.abs(yaw) < 0.5 && Math.abs(pitch) < 0.5 && eyeMm / 1000 < data.tolerance_m;
  return (
    <WidgetCard
      title={t("experiments.chair.views.title")}
      hint={t("experiments.chair.views.hint")}
      actions={
        <Button variant="secondary" size="sm" onClick={() => turn(0, 0)}>
          <Eye className="size-4" aria-hidden />
          {t("experiments.chair.views.align")}
        </Button>
      }
    >
      <div className={`${SIDE.grid} ${STAGE.threeWithSide}`}>
        <div className={SIDE.views}>
          {/* Side by side at every width: comparing the three is the point. */}
          <div className={`grid grid-cols-3 gap-2 sm:gap-4 ${STAGE.three}`}>
            {data.boxes.map((box) => (
              <figure key={box.figure.kind} className="space-y-2">
                <OrbitView
                  peephole={box}
                  yaw={yaw}
                  pitch={pitch}
                  eye={eyeMm / 1000}
                  half={half}
                  onTurn={turn}
                  label={t("experiments.chair.views.view", {
                    name: t(`experiments.chair.kinds.${box.figure.kind}`),
                  })}
                />
                <figcaption className="text-center text-sm text-secondary">
                  {t(`experiments.chair.kinds.${box.figure.kind}`)}
                </figcaption>
              </figure>
            ))}
          </div>
          <div className="flex justify-center">
            <Chip tone={atTheHole ? "success" : "neutral"}>
              {atTheHole ? t("experiments.chair.views.aligned") : t("experiments.chair.views.apart")}
            </Chip>
          </div>
        </div>
        <div className={`grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-1 ${SIDE.column}`}>
          <SliderField
            label={t("experiments.chair.views.turn")}
            unit="°"
            value={yaw}
            min={-180}
            max={180}
            step={0.5}
            digits={1}
            onChange={(v) => turn(v, pitch)}
          />
          <SliderField
            label={t("experiments.chair.views.tilt")}
            unit="°"
            value={pitch}
            min={-60}
            max={60}
            step={0.5}
            digits={1}
            onChange={(v) => turn(yaw, v)}
          />
          <SliderField
            label={t("experiments.chair.views.eye")}
            unit="mm"
            value={eyeMm}
            min={0.01}
            max={70}
            step={0.01}
            digits={2}
            log
            zeroStop
            hint={t("experiments.chair.views.eye_hint")}
            onChange={(v) => {
              setAuto(false);
              setEyeMm(v);
            }}
          />
          <Switch
            label={t("experiments.chair.auto")}
            description={t("experiments.chair.auto_hint")}
            checked={auto}
            onCheckedChange={setAuto}
          />
        </div>
      </div>
    </WidgetCard>
  );
}

/** What happens: the directions from the eye, and what keeps a picture. */
function ChairModel() {
  const { t } = useTranslation();
  return (
    <>
      <p>{t("experiments.chair.model.directions")}</p>
      <Equation
        tex={String.raw`P' = E + \lambda\,(P - E), \qquad \lambda > 0`}
        reads={t("experiments.chair.equations.slide")}
        symbols={[
          { tex: "P", meaning: t("experiments.chair.symbols.p") },
          { tex: "P'", meaning: t("experiments.chair.symbols.p_moved") },
          { tex: "E", meaning: t("experiments.chair.symbols.eye") },
          { tex: String.raw`\lambda`, meaning: t("experiments.chair.symbols.lambda") },
        ]}
      />
      <p>{t("experiments.chair.model.skewed")}</p>
      <Equation
        tex={String.raw`P' - E = \frac{P - E}{1 + \mathbf{w}\cdot(P - E)}`}
        reads={t("experiments.chair.equations.skew")}
        symbols={[
          { tex: String.raw`\mathbf{w}`, meaning: t("experiments.chair.symbols.w"), unit: "1/m" },
          { tex: String.raw`\mathbf{w}\cdot(P - E)`, meaning: t("experiments.chair.symbols.dot") },
        ]}
      />
      <p>{t("experiments.chair.model.scattered")}</p>
      <p className="border-l-2 border-subtle pl-3 italic">{t("experiments.chair.model.cave")}</p>
    </>
  );
}

/** The sweet spot: how far the eye may move before the one picture parts. */
function ChairTrick({ data }: { data: ChairAnalysis | null }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const tolerance = data ? formatNumber(data.tolerance_m * 1000, 2, locale) : "…";
  const binocular = data ? formatNumber((data.binocular_gap_rad * 180) / Math.PI, 1, locale) : "…";
  const baseline = data ? formatNumber(data.eye_baseline_m * 1000, 0, locale) : "…";
  return (
    <>
      <p>{t("experiments.chair.sweet.question")}</p>
      <Equation
        tex={String.raw`\Delta\alpha \approx \delta\,\left|\frac{1}{d_1} - \frac{1}{d_2}\right|`}
        reads={t("experiments.chair.equations.gap")}
        symbols={[
          { tex: String.raw`\Delta\alpha`, meaning: t("experiments.chair.symbols.gap"), unit: "rad" },
          { tex: String.raw`\delta`, meaning: t("experiments.chair.symbols.delta"), unit: "m" },
          { tex: "d_1, d_2", meaning: t("experiments.chair.symbols.distances"), unit: "m" },
        ]}
      />
      <p>{t("experiments.chair.sweet.tolerance", { tolerance, binocular, baseline })}</p>
      <p>{t("experiments.chair.sweet.brain")}</p>
      {data && (
        <Figures
          tiles={[
            {
              key: "tolerance",
              label: t("experiments.chair.figures.tolerance"),
              value: data.tolerance_m * 1000,
              digits: 2,
              unit: "mm",
            },
            {
              key: "binocular",
              label: t("experiments.chair.figures.binocular"),
              value: (data.binocular_gap_rad * 180) / Math.PI,
              digits: 1,
              unit: "°",
            },
            {
              key: "acuity",
              label: t("experiments.chair.figures.acuity"),
              value: (data.acuity_rad * 180 * 60) / Math.PI,
              digits: 0,
              unit: "′",
            },
            {
              key: "joints",
              label: t("experiments.chair.figures.joints"),
              value: data.joint_count,
              digits: 0,
            },
          ]}
        />
      )}
    </>
  );
}
