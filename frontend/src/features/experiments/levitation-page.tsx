import { useDeferredValue, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertBanner, LoadingState } from "@eifi1/ui-kit";
import { apiErrorMessage } from "@/shared/api/client";
import { useLocale } from "@/shared/i18n/use-locale";
import { formatNumber } from "@/shared/lib/format";
import { useChartHex } from "@/shared/state/palette-store";
import { SeriesChart } from "@/shared/charts/series-chart";
import { SliderField } from "@/shared/ui/slider-field";
import { Figures, WidgetCard } from "@/shared/ui/widget";
import { Equation } from "./equation";
import { ExhibitFrame } from "./exhibit-frame";
import { PreviewPending, type PreviewMode } from "./preview-mode";
import { hover, liftKg, type Base, type Hover, type Top } from "./simulate/levitation";
import { SIDE } from "./stage";
import { useExperimentsDefaults } from "./use-experiments";

const LIFT_HUE = 0;
/** The chart's heights over the ring's face, in centimetres. */
const CHART_FROM_CM = 3;
const CHART_TO_CM = 8;
const CHART_POINTS = 101;
/** The chart's lift axis, in grams: from under the lowest point at 3 cm to over the
 *  heaviest top the slider allows. */
const LIFT_DOMAIN_G: [number, number] = [5, 26];
/** The top as drawn, in centimetres: the magnet's disc, the spindle above it and the tip below. */
const DISC_HALF_CM = 1.5;
const DISC_THICK_CM = 0.35;
const SPINDLE_CM = 1.4;
const TIP_CM = 0.45;
/** How far the drawing reaches up the axis, in centimetres. */
const TOP_OF_VIEW_CM = 7;
/** Where a top that slides off is drawn: past the ring's rim. */
const SLID_CM = 4.2;

/**
 * The floating top (`experiments.levitation`): a spinning top over a ring
 * magnet, its window and its balance from the browser port
 * (`simulate/levitation.ts`, held to the engine by `simulate.test.ts`). No route.
 */
export function LevitationPage() {
  const { t } = useTranslation();
  const defaults = useExperimentsDefaults();
  const build = defaults.data?.levitation ?? null;
  return (
    <ExhibitFrame
      exhibit="levitation"
      atTheExhibit={
        <>
          <p>{t("experiments.levitation.at.top")}</p>
          <p>{t("experiments.levitation.at.weight")}</p>
        </>
      }
      whatHappens={<LevitationModel />}
      computed={<LevitationComputed />}
      sweetSpot={<LevitationTrick />}
    >
      {defaults.isPending ? (
        <LoadingState className="py-10" label={t("common.loading")} />
      ) : !build ? (
        <AlertBanner tone="danger">{apiErrorMessage(defaults.error, t("experiments.failed"))}</AlertBanner>
      ) : (
        <LevitationPlay base={build.base} top={build.top} />
      )}
    </ExhibitFrame>
  );
}

/** The exhibit's top hovering in its window, for the overview. It does not move. */
export function LevitationPreview() {
  const defaults = useExperimentsDefaults();
  const build = defaults.data?.levitation;
  return build ? <LevitationPlay base={build.base} top={build.top} preview /> : <PreviewPending />;
}

function LevitationView({ base, state }: { base: Base; state: Hover }) {
  const { t } = useTranslation();
  const hex = useChartHex();
  const cm = (m: number) => m * 100;
  const r1 = cm(base.inner_radius_m);
  const r2 = cm(base.outer_radius_m);
  const h = cm(base.height_m);
  const wide = r2 + 2;
  const z = state.state === "lands" ? DISC_THICK_CM / 2 + TIP_CM : cm(state.height_m ?? 0);
  const x = state.state === "slides" ? Math.min(SLID_CM, wide - DISC_HALF_CM) : 0;
  const tilt = state.state === "lands" ? 18 : 0;
  return (
    <svg
      viewBox={`${-wide} ${-TOP_OF_VIEW_CM} ${2 * wide} ${TOP_OF_VIEW_CM + h + 0.6}`}
      role="img"
      aria-label={t("experiments.levitation.view")}
      className="w-full rounded-lg border border-subtle bg-surface-2 text-muted"
    >
      {/* The window: the heights where the top can hover. */}
      <rect
        x={-wide + 0.4}
        y={-cm(state.head_m)}
        width={2 * wide - 0.8}
        height={cm(state.head_m - state.foot_m)}
        fill={hex[LIFT_HUE % hex.length]}
        fillOpacity={0.22}
      />
      <line
        x1={0}
        y1={-TOP_OF_VIEW_CM}
        x2={0}
        y2={h}
        stroke="currentColor"
        strokeDasharray="3 3"
        vectorEffect="non-scaling-stroke"
      />
      {/* The ring magnet, cut through its axis. */}
      {[-1, 1].map((side) => (
        <rect
          key={side}
          x={side < 0 ? -r2 : r1}
          y={0}
          width={r2 - r1}
          height={h}
          className="fill-current text-secondary"
          fillOpacity={0.5}
          stroke="currentColor"
          vectorEffect="non-scaling-stroke"
        />
      ))}
      <g
        transform={`translate(${x} ${-z}) rotate(${tilt})`}
        className={state.state === "hovers" ? "text-primary" : "text-danger"}
        opacity={state.state === "slides" ? 0.6 : 1}
      >
        <line
          x1={0}
          y1={-DISC_THICK_CM / 2}
          x2={0}
          y2={-DISC_THICK_CM / 2 - SPINDLE_CM}
          stroke="currentColor"
          strokeWidth={2.5}
          vectorEffect="non-scaling-stroke"
        />
        <polygon
          points={`${-DISC_HALF_CM * 0.25},${DISC_THICK_CM / 2} ${DISC_HALF_CM * 0.25},${DISC_THICK_CM / 2} 0,${DISC_THICK_CM / 2 + TIP_CM}`}
          className="fill-current"
        />
        <rect
          x={-DISC_HALF_CM}
          y={-DISC_THICK_CM / 2}
          width={2 * DISC_HALF_CM}
          height={DISC_THICK_CM}
          rx={0.12}
          className="fill-current"
        />
      </g>
    </svg>
  );
}

function LevitationPlay({ base, top, preview = false }: { base: Base; top: Top } & PreviewMode) {
  const { t } = useTranslation();
  const locale = useLocale();
  const hex = useChartHex();
  const [massG, setMassG] = useState(top.mass_kg * 1000);
  const [warmingK, setWarmingK] = useState(0);
  const tuned = useMemo<Top>(() => ({ ...top, mass_kg: massG / 1000 }), [top, massG]);
  // Dragged, the mass asks for a new balance at every notch: the slider must not wait.
  const shownTop = useDeferredValue(tuned);
  const shownWarming = useDeferredValue(warmingK);
  const state = useMemo(() => hover(base, shownTop, shownWarming), [base, shownTop, shownWarming]);
  const view = <LevitationView base={base} state={state} />;
  const rows = useMemo(
    () =>
      Array.from({ length: CHART_POINTS }, (_, k) => {
        const zCm = CHART_FROM_CM + ((CHART_TO_CM - CHART_FROM_CM) * k) / (CHART_POINTS - 1);
        return { cm: zCm, lift: liftKg(base, shownTop, zCm / 100, shownWarming) * 1000 };
      }),
    [base, shownTop, shownWarming],
  );
  if (preview) return view;
  const status = {
    hovers: t("experiments.levitation.play.hovers"),
    lands: t("experiments.levitation.play.lands"),
    slides: t("experiments.levitation.play.slides"),
  }[state.state];
  const hovering = state.state === "hovers";
  return (
    <div className="space-y-6">
      <WidgetCard title={t("experiments.levitation.play.title")} hint={t("experiments.levitation.play.hint")}>
        <div className={SIDE.grid}>
          <div className={`${SIDE.views} mx-auto w-full max-w-xl space-y-2`}>
            {view}
            <p className={`text-sm font-medium ${hovering ? "text-primary" : "text-danger"}`} role="status">
              {status}
            </p>
          </div>
          <div className={SIDE.column}>
            <SliderField
              label={t("experiments.levitation.play.mass")}
              unit="g"
              value={massG}
              min={22.5}
              max={24.5}
              step={0.01}
              digits={2}
              hint={t("experiments.levitation.play.mass_hint")}
              onChange={setMassG}
            />
            <SliderField
              label={t("experiments.levitation.play.warming")}
              unit="K"
              value={warmingK}
              min={-10}
              max={10}
              step={0.5}
              digits={1}
              hint={t("experiments.levitation.play.warming_hint")}
              onChange={setWarmingK}
            />
            <Figures
              tiles={[
                {
                  key: "height",
                  label: t("experiments.levitation.play.height"),
                  value: hovering && state.height_m !== null ? state.height_m * 100 : null,
                  digits: 2,
                  unit: "cm",
                },
                {
                  key: "lightest",
                  label: t("experiments.levitation.play.lightest"),
                  value: state.lightest_kg * 1000,
                  digits: 2,
                  unit: "g",
                },
                {
                  key: "heaviest",
                  label: t("experiments.levitation.play.heaviest"),
                  value: state.heaviest_kg * 1000,
                  digits: 2,
                  unit: "g",
                },
                {
                  key: "bob",
                  label: t("experiments.levitation.play.bob"),
                  value: state.bob_hz,
                  digits: 2,
                  unit: "Hz",
                },
                {
                  key: "drift",
                  label: t("experiments.levitation.play.drift"),
                  value: state.drift_hz,
                  digits: 2,
                  unit: "Hz",
                },
              ]}
            />
          </div>
        </div>
      </WidgetCard>
      <WidgetCard title={t("experiments.levitation.chart.title")} hint={t("experiments.levitation.chart.hint")}>
        <SeriesChart
          rows={rows}
          series={[{ key: "lift", label: t("experiments.levitation.chart.lift"), color: hex[LIFT_HUE % hex.length] }]}
          axes={[
            {
              id: "y",
              title: `${t("experiments.levitation.chart.lift")} (g)`,
              format: (v) => formatNumber(v, 1, locale),
              // Room above the lift's peak for the weight's line, ten kelvin colder included.
              domain: LIFT_DOMAIN_G,
            },
          ]}
          x={{
            key: "cm",
            title: `${t("experiments.levitation.chart.height")} (cm)`,
            format: (v) => formatNumber(v, 1, locale),
          }}
          references={[
            { key: "weight", value: massG, label: t("experiments.levitation.chart.weight") },
            { key: "foot", axis: "x", value: state.foot_m * 100, label: t("experiments.levitation.chart.window") },
            { key: "head", axis: "x", value: state.head_m * 100 },
          ]}
          markers={hovering && state.height_m !== null ? [{ key: "balance", x: state.height_m * 100, y: massG }] : []}
        />
      </WidgetCard>
    </div>
  );
}

function LevitationModel() {
  const { t } = useTranslation();
  const s = (key: string) => t(`experiments.levitation.symbols.${key}`);
  return (
    <>
      <p>{t("experiments.levitation.model.intro")}</p>
      <Equation
        tex={String.raw`U = m\,g\,z + \mu\,|B|`}
        reads={t("experiments.levitation.model.energy")}
        symbols={[
          { tex: "U", meaning: s("u"), unit: "J" },
          { tex: "m", meaning: s("m"), unit: "kg" },
          { tex: "g", meaning: s("g"), unit: "m/s²" },
          { tex: "z", meaning: s("z"), unit: "m" },
          { tex: String.raw`\mu`, meaning: s("mu"), unit: "A·m²" },
          { tex: "B", meaning: s("b"), unit: "T" },
        ]}
      />
      <Equation
        tex={String.raw`B = \tfrac{\mu_0 M}{2}\,\bigl[F_{r_2} - F_{r_1}\bigr]`}
        reads={t("experiments.levitation.model.field")}
        symbols={[
          { tex: String.raw`\mu_0`, meaning: s("mu0"), unit: "T·m/A" },
          { tex: "M", meaning: s("magnetisation"), unit: "A/m" },
          { tex: String.raw`r_1, r_2`, meaning: s("radii"), unit: "m" },
        ]}
      />
      <Equation
        tex={String.raw`F_a = \tfrac{z+t}{\sqrt{(z+t)^2+a^2}} - \tfrac{z}{\sqrt{z^2+a^2}}`}
        reads={t("experiments.levitation.model.solenoid")}
        symbols={[
          { tex: "t", meaning: s("t"), unit: "m" },
          { tex: "a", meaning: s("a"), unit: "m" },
        ]}
      />
      <Equation
        tex={String.raw`m\,g = -\mu\,B'`}
        reads={t("experiments.levitation.model.balance")}
        symbols={[{ tex: String.raw`B'`, meaning: s("slope"), unit: "T/m" }]}
      />
      <Equation
        tex={String.raw`B'' > 0, \qquad B'^2 > 2\,B\,B''`}
        reads={t("experiments.levitation.model.window")}
        symbols={[{ tex: String.raw`B''`, meaning: s("bend"), unit: "T/m²" }]}
      />
      <Equation
        tex={String.raw`f_z = \frac{1}{2\pi}\sqrt{\frac{\mu\,B''}{m}}`}
        reads={t("experiments.levitation.model.bob")}
        symbols={[{ tex: "f_z", meaning: s("fz"), unit: "Hz" }]}
      />
    </>
  );
}

function LevitationTrick() {
  const { t } = useTranslation();
  return (
    <>
      <p>{t("experiments.levitation.sweet.window")}</p>
      <p>{t("experiments.levitation.sweet.warmth")}</p>
      <p>{t("experiments.levitation.sweet.earnshaw")}</p>
    </>
  );
}

function LevitationComputed() {
  const { t } = useTranslation();
  return (
    <>
      <p>{t("experiments.levitation.computed.system")}</p>
      <p>{t("experiments.levitation.computed.left_out")}</p>
    </>
  );
}
