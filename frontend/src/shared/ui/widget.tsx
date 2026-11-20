/**
 * The pieces an exhibit's page and a lesson of the course are built from — a
 * card with its title and what to try, the controls beside what they drive, a
 * row of figures, a slider with its number. Nothing here uses an exhibit's or a
 * lesson's words, so every page shares it.
 *
 * `WidgetBody` and `Param` came with the course from Kurvenschmiede, whose
 * `shared/ui/widget.tsx` they are; the exhibits lay out their own frame.
 */

import type { ReactNode } from "react";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  SectionLabel,
  StatTile,
  StatTileGrid,
  type StatTileTone,
} from "@eifi1/ui-kit";
import { useLocale } from "@/shared/i18n/use-locale";
import { formatNumber } from "@/shared/lib/format";
import { SliderField } from "@/shared/ui/slider-field";

/** One experiment: its title, what to try, the controls and what they draw. */
export function WidgetCard({
  title,
  hint,
  actions,
  children,
  id,
}: {
  title: string;
  hint?: string;
  actions?: ReactNode;
  children: ReactNode;
  id?: string;
}) {
  return (
    <Card padding="md" density="compact" className="space-y-4" id={id}>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle as="h3">{title}</CardTitle>
            {hint && <CardDescription>{hint}</CardDescription>}
          </div>
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </div>
      </CardHeader>
      {children}
    </Card>
  );
}

/** Controls beside what they drive on a wide screen, above it on a narrow one. */
export function WidgetBody({ controls, children }: { controls: ReactNode; children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[22rem_minmax(0,1fr)]">
      <div className="space-y-4">{controls}</div>
      <div className="min-w-0 space-y-3">{children}</div>
    </div>
  );
}

export interface Tile {
  key: string;
  label: string;
  value: number | null | undefined;
  digits: number;
  unit?: string;
  tone?: StatTileTone;
  /** The bound the value is held to, said under it when it has crossed it. */
  note?: string;
  /** A figure that answers the page's question: left out until the reader has
   *  tried the exhibit (`features/experiments/held.tsx`). */
  held?: boolean;
}

/** A widget's figures, as the kit's small tiles. A figure past its bound is in
 *  the warning tone and says which bound. */
export function Figures({ title, tiles }: { title?: string; tiles: Tile[] }) {
  const locale = useLocale();
  return (
    <div>
      {title && (
        <SectionLabel as="h4" className="mb-1">
          {title}
        </SectionLabel>
      )}
      {/* Hyphenated in the reader's language: the tile sets its label in
          capitals and German names these in one word. */}
      <StatTileGrid minTileWidth="8rem" lang={locale} className="gap-2 hyphens-auto">
        {tiles
          .filter((tile) => !tile.held)
          .map((tile) => (
            <StatTile
              key={tile.key}
              size="sm"
              // The kit sets a small tile's label in capitals, and a capital ω
              // is Ω, a capital η an H: a symbol's case is its meaning here.
              label={<span className="normal-case">{tile.label}</span>}
              value={tile.value ?? null}
              format={(value) => formatNumber(value, tile.digits, locale)}
              unit={tile.unit || undefined}
              tone={tile.tone ?? "neutral"}
              description={tile.note}
            />
          ))}
      </StatTileGrid>
    </div>
  );
}

/** A slider with its number: the site's `SliderField`, with the digits a
 *  physical quantity needs. A logarithmic one has no "off" stop — a time
 *  constant or a stiffness of zero is not a setting, it is a different
 *  equation — and a linear one moves in two hundred steps unless told. */
export function Param({
  label,
  unit,
  value,
  min,
  max,
  step,
  digits,
  log,
  hint,
  onChange,
}: {
  label: string;
  unit: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  digits: number;
  log?: boolean;
  hint?: string;
  onChange: (next: number) => void;
}) {
  return (
    <SliderField
      label={label}
      unit={unit}
      value={value}
      min={min}
      max={max}
      step={step ?? (max - min) / 200}
      digits={digits}
      log={log}
      zeroStop={false}
      hint={hint}
      onChange={onChange}
    />
  );
}
