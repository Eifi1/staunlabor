/**
 * The pieces an exhibit's page is built from — a card with its title and what
 * to try, a row of figures. Nothing here uses an exhibit's words, so every
 * page shares it.
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

export interface Tile {
  key: string;
  label: string;
  value: number | null | undefined;
  digits: number;
  unit?: string;
  tone?: StatTileTone;
  /** The bound the value is held to, said under it when it has crossed it. */
  note?: string;
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
        {tiles.map((tile) => (
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
