import { useDeferredValue, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Switch, ToggleGroup } from "@eifi1/ui-kit";
import { useChartHex } from "@/shared/state/palette-store";
import { SliderField } from "@/shared/ui/slider-field";
import { Figures, WidgetCard } from "@/shared/ui/widget";
import { Equation } from "./equation";
import { ExhibitFrame } from "./exhibit-frame";
import { BuildPending } from "./build-pending";
import { PreviewPending, type PreviewMode } from "./preview-mode";
import {
  blocks,
  catenaryAForRise,
  loadPoint,
  riseM,
  thrust,
  type Arch,
  type Load,
  type Shape,
  type Thrust,
} from "./simulate/arch";
import { SIDE } from "./stage";
import { useExperimentsDefaults } from "./use-experiments";

const SHAPES: readonly Shape[] = ["semicircle", "pointed", "catenary"];
const LINE_HUE = 0;
const CHAIN_HUE = 3;
/** A joint the line comes this near to the edge, as a share of its widest
 *  reach, is where the arch would open first. */
const HINGE_SHARE = 0.98;
/** Below this reach no joint is marked: the line runs down the middle. */
const MARK_FROM = 0.5;

/**
 * The chain and the arch (`experiments.arch`): a stone arch and its thrust
 * line, from the browser port (`simulate/arch.ts`, held to the engine by
 * `simulate.test.ts`). No route.
 */
export function ArchPage() {
  const { t } = useTranslation();
  const defaults = useExperimentsDefaults();
  const [build, setBuild] = useState<Arch | null>(null);
  const arch = build ?? defaults.data?.arch ?? null;
  return (
    <ExhibitFrame
      exhibit="arch"
      atTheExhibit={
        <>
          <p>{t("experiments.arch.at.stones")}</p>
          <p>{t("experiments.arch.at.chain")}</p>
        </>
      }
      whatHappens={<ArchModel />}
      computed={<ArchComputed />}
      sweetSpot={<ArchTrick />}
    >
      {defaults.isPending || !arch ? (
        <BuildPending pending={defaults.isPending} error={defaults.error} />
      ) : (
        <ArchPlay arch={arch} onChange={setBuild} />
      )}
    </ExhibitFrame>
  );
}

/** The semicircle and its thrust line, for the overview. It does not move. */
export function ArchPreview() {
  const defaults = useExperimentsDefaults();
  const arch = defaults.data?.arch;
  return arch ? <ArchPlay arch={arch} preview /> : <PreviewPending />;
}

function ArchView({ arch, load, line, chain }: { arch: Arch; load: Load; line: Thrust; chain: boolean }) {
  const { t } = useTranslation();
  const hex = useChartHex();
  const stones = useMemo(() => blocks(arch), [arch]);
  const c = arch.span_m / 2;
  const h = riseM(arch);
  const pad = arch.thickness_m + arch.span_m * 0.08;
  const width = 2 * (c + pad);
  const top = h + arch.thickness_m / 2 + pad;
  const half = arch.thickness_m / 2;
  const widest = Math.max(...line.offsets_m.map(Math.abs));
  const marked =
    line.reach >= MARK_FROM ? line.offsets_m.flatMap((e, j) => (Math.abs(e) >= HINGE_SHARE * widest ? [j] : [])) : [];
  const chainA = catenaryAForRise(c, h);
  const chainPoints = Array.from({ length: 61 }, (_, k) => {
    const x = -c + (2 * c * k) / 60;
    return `${x},${-(h - chainA * (Math.cosh(x / chainA) - 1))}`;
  }).join(" ");
  const [, where] = load.weight_n > 0 ? loadPoint(arch, load) : [0, [0, 0] as [number, number]];
  const arrow = arch.span_m * 0.12;
  return (
    <svg
      viewBox={`${-c - pad} ${-top} ${width} ${top + pad * 0.6}`}
      role="img"
      aria-label={t("experiments.arch.view")}
      className="w-full rounded-lg border border-subtle bg-surface-2 text-muted"
    >
      {/* The abutments the arch springs from. */}
      {[-1, 1].map((side) => (
        <rect
          key={side}
          x={side < 0 ? -c - pad : c - half}
          y={0}
          width={pad + half}
          height={pad * 0.6}
          className="fill-current"
          opacity={0.35}
        />
      ))}
      {stones.map((stone, i) => (
        <polygon
          key={i}
          points={stone.corners.map(([x, y]) => `${x},${-y}`).join(" ")}
          className="fill-current text-secondary"
          fillOpacity={0.18}
          stroke="currentColor"
          vectorEffect="non-scaling-stroke"
        />
      ))}
      {chain && (
        <polyline
          points={chainPoints}
          fill="none"
          stroke={hex[CHAIN_HUE % hex.length]}
          strokeWidth={2}
          strokeDasharray="5 4"
          vectorEffect="non-scaling-stroke"
        />
      )}
      <polyline
        points={line.points.map(([x, y]) => `${x},${-y}`).join(" ")}
        fill="none"
        stroke={hex[LINE_HUE % hex.length]}
        strokeWidth={2.5}
        vectorEffect="non-scaling-stroke"
      />
      {marked.map((j) => {
        const [x, y] = line.points[j];
        return (
          <circle
            key={j}
            cx={x}
            cy={-y}
            r={arch.thickness_m * 0.18}
            className={line.stands ? "fill-current text-warning" : "fill-current text-danger"}
          />
        );
      })}
      {load.weight_n > 0 && (
        <g className="text-primary">
          <line
            x1={where[0]}
            y1={-(where[1] + arrow)}
            x2={where[0]}
            y2={-where[1]}
            stroke="currentColor"
            strokeWidth={3}
            vectorEffect="non-scaling-stroke"
          />
          <polygon
            points={`${where[0]},${-where[1]} ${where[0] - arrow * 0.15},${-(where[1] + arrow * 0.3)} ${where[0] + arrow * 0.15},${-(where[1] + arrow * 0.3)}`}
            className="fill-current"
          />
        </g>
      )}
    </svg>
  );
}

function ArchPlay({ arch, onChange, preview = false }: { arch: Arch; onChange?: (next: Arch) => void } & PreviewMode) {
  const { t } = useTranslation();
  const [share, setShare] = useState(0);
  const [at, setAt] = useState(0.5);
  const [chain, setChain] = useState(false);
  const own = useMemo(() => blocks(arch).reduce((sum, b) => sum + b.weight_n, 0), [arch]);
  const load = useMemo<Load>(() => ({ at, weight_n: share * own }), [at, share, own]);
  // A load dragged along asks for a new line at every notch: the slider must
  // not wait for each.
  const shownArch = useDeferredValue(arch);
  const shownLoad = useDeferredValue(load);
  const line = useMemo(() => thrust(shownArch, shownLoad), [shownArch, shownLoad]);
  const view = <ArchView arch={shownArch} load={shownLoad} line={line} chain={chain || preview} />;
  if (preview) return view;
  return (
    <WidgetCard title={t("experiments.arch.play.title")} hint={t("experiments.arch.play.hint")}>
      <div className={SIDE.grid}>
        <div className={`${SIDE.top} flex flex-wrap gap-4`}>
          <ToggleGroup
            label={t("experiments.arch.play.shape")}
            labelPlacement="above"
            size="sm"
            overflow="wrap"
            value={arch.shape}
            onChange={(v: Shape) => onChange?.({ ...arch, shape: v })}
            options={SHAPES.map((v) => ({ value: v, label: t(`experiments.arch.play.shapes.${v}`) }))}
          />
        </div>
        <div className={`${SIDE.views} mx-auto w-full max-w-xl space-y-2`}>
          {view}
          <p className={`text-sm font-medium ${line.stands ? "text-primary" : "text-danger"}`} role="status">
            {line.stands ? t("experiments.arch.play.stands") : t("experiments.arch.play.falls")}
          </p>
        </div>
        <div className={SIDE.column}>
          <SliderField
            label={t("experiments.arch.play.thickness")}
            unit="cm"
            value={arch.thickness_m * 100}
            min={2}
            max={50}
            step={1}
            digits={0}
            hint={t("experiments.arch.play.thickness_hint")}
            onChange={(v) => onChange?.({ ...arch, thickness_m: v / 100 })}
          />
          <SliderField
            label={t("experiments.arch.play.stones")}
            unit=""
            value={arch.blocks}
            min={4}
            max={40}
            step={2}
            digits={0}
            onChange={(v) => onChange?.({ ...arch, blocks: v })}
          />
          <SliderField
            label={t("experiments.arch.play.load")}
            unit="%"
            value={share * 100}
            min={0}
            max={200}
            step={1}
            digits={0}
            hint={t("experiments.arch.play.load_hint")}
            onChange={(v) => setShare(v / 100)}
          />
          <SliderField
            label={t("experiments.arch.play.at")}
            unit="%"
            value={at * 100}
            min={-100}
            max={100}
            step={1}
            digits={0}
            hint={t("experiments.arch.play.at_hint")}
            onChange={(v) => setAt(v / 100)}
          />
          <Switch
            label={t("experiments.arch.play.chain")}
            description={t("experiments.arch.play.chain_hint")}
            checked={chain}
            onCheckedChange={setChain}
          />
          <Figures
            tiles={[
              {
                key: "safety",
                label: t("experiments.arch.play.safety"),
                value: line.reach > 0 ? 1 / line.reach : null,
                digits: 1,
                unit: "×",
              },
              {
                key: "thrust",
                label: t("experiments.arch.play.thrust"),
                value: (line.h_n / line.weight_n) * 100,
                digits: 0,
                unit: "%",
              },
              {
                key: "weight",
                label: t("experiments.arch.play.weight"),
                value: own / 9.80665,
                digits: 0,
                unit: "kg",
              },
            ]}
          />
        </div>
      </div>
    </WidgetCard>
  );
}

function ArchModel() {
  const { t } = useTranslation();
  const s = (key: string) => t(`experiments.arch.symbols.${key}`);
  return (
    <>
      <p>{t("experiments.arch.model.intro")}</p>
      <Equation
        tex={String.raw`y = h - a\left(\cosh\frac{x}{a} - 1\right)`}
        reads={t("experiments.arch.model.chain")}
        symbols={[
          { tex: "x", meaning: s("x"), unit: "m" },
          { tex: "h", meaning: s("h"), unit: "m" },
          { tex: "a", meaning: s("a"), unit: "m" },
        ]}
      />
      <Equation
        tex={String.raw`e_j = -\frac{\bar M_j}{N_j}`}
        reads={t("experiments.arch.model.joint")}
        symbols={[
          { tex: "e_j", meaning: s("e"), unit: "m" },
          { tex: String.raw`\bar M_j`, meaning: s("m"), unit: "N·m" },
          { tex: "N_j", meaning: s("n"), unit: "N" },
        ]}
      />
      <Equation
        tex={String.raw`|e_j| \le \lambda\,\frac{t}{2}, \qquad \lambda \le 1`}
        reads={t("experiments.arch.model.stands")}
        symbols={[
          { tex: "t", meaning: s("t"), unit: "m" },
          { tex: String.raw`\lambda`, meaning: s("lambda") },
        ]}
      />
    </>
  );
}

function ArchTrick() {
  const { t } = useTranslation();
  return (
    <>
      <p>{t("experiments.arch.sweet.chain")}</p>
      <p>{t("experiments.arch.sweet.semicircle")}</p>
      <p>{t("experiments.arch.sweet.load")}</p>
    </>
  );
}

function ArchComputed() {
  const { t } = useTranslation();
  return (
    <>
      <p>{t("experiments.arch.computed.system")}</p>
      <p>{t("experiments.arch.computed.left_out")}</p>
    </>
  );
}
