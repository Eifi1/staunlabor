import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Eye } from "lucide-react";
import { AlertBanner, Button, Chip, LoadingState, Switch } from "@eifi1/ui-kit";
import { apiErrorMessage } from "@/shared/api/client";
import { useLocale } from "@/shared/i18n/use-locale";
import { formatNumber } from "@/shared/lib/format";
import { SliderField } from "@/shared/ui/slider-field";
import { Figures, WidgetCard } from "@/shared/ui/widget";
import { OrbitView, frameOf } from "./chair-views";
import { Equation } from "./equation";
import { ExhibitFrame } from "./exhibit-frame";
import { PreviewPending, type PreviewProps } from "./preview-mode";
import { SIDE, STAGE } from "./stage";
import { useChair } from "./use-experiments";

/** The auto mode's turn: two seconds at the hole, then once round in twelve,
 *  tilting a little on the way so the depth shows, and back to the hole. */
const HOLD_S = 2;
const ROUND_S = 12;

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
 *  the hole. Held still, it is the page's first view, from where the three
 *  are plainly three different things. */
export function ChairPreview({ paused }: PreviewProps) {
  const { t } = useTranslation();
  const chair = useChair();
  const [view, setView] = useState({ yaw: 35, pitch: 15 });
  const data = chair.data;
  const half = useMemo(() => (data ? frameOf(data.boxes[0]) : 1), [data]);
  useEffect(() => {
    if (paused) return;
    let raf = 0;
    const began = performance.now();
    const tick = (now: number) => {
      setView(autoView((now - began) / 1000));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [paused]);
  if (!data) return <PreviewPending />;
  return (
    <div className="grid grid-cols-3 gap-2">
      {data.boxes.map((box) => (
        <OrbitView
          key={box.figure.kind}
          peephole={box}
          yaw={view.yaw}
          pitch={view.pitch}
          half={half}
          onTurn={() => {}}
          label={t("experiments.chair.views.view", { name: t(`experiments.chair.kinds.${box.figure.kind}`) })}
        />
      ))}
    </div>
  );
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
  const locale = useLocale();
  const chair = useChair();
  const [yaw, setYaw] = useState(35);
  const [pitch, setPitch] = useState(15);
  const [auto, setAuto] = useState(false);
  const data = chair.data;
  const half = useMemo(() => (data ? frameOf(data.boxes[0]) : 1), [data]);

  // The auto mode: the views go once round every fourteen seconds, resting at
  // the hole for two. A slider or a drag by the reader stops it.
  useEffect(() => {
    if (!auto) return;
    let raf = 0;
    const began = performance.now();
    const tick = (now: number) => {
      const view = autoView((now - began) / 1000);
      setYaw(view.yaw);
      setPitch(view.pitch);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [auto]);
  const turn = (nextYaw: number, nextPitch: number) => {
    setAuto(false);
    setYaw(nextYaw);
    setPitch(nextPitch);
  };
  const atTheHole = Math.abs(yaw) < 0.5 && Math.abs(pitch) < 0.5;

  const tolerance = data ? formatNumber(data.tolerance_m * 1000, 2, locale) : "…";
  const binocular = data ? formatNumber((data.binocular_gap_rad * 180) / Math.PI, 1, locale) : "…";
  const baseline = data ? formatNumber(data.eye_baseline_m * 1000, 0, locale) : "…";

  return (
    <ExhibitFrame
      exhibit="chair"
      atTheExhibit={
        <>
          <p>{t("experiments.chair.at.boxes")}</p>
          <p>{t("experiments.chair.at.round")}</p>
        </>
      }
      whatHappens={
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
      }
      sweetSpot={
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
      }
    >
      {chair.isPending ? (
        <LoadingState className="py-10" label={t("common.loading")} />
      ) : chair.isError || !data ? (
        <AlertBanner tone="danger">{apiErrorMessage(chair.error, t("experiments.failed"))}</AlertBanner>
      ) : (
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
            <div
              className={`grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_16rem] 2xl:grid-cols-1 ${SIDE.column}`}
            >
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
              <Switch
                label={t("experiments.chair.auto")}
                description={t("experiments.chair.auto_hint")}
                checked={auto}
                onCheckedChange={setAuto}
              />
            </div>
          </div>
        </WidgetCard>
      )}
    </ExhibitFrame>
  );
}
