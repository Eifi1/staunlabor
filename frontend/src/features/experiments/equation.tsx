/**
 * A formula a reader who has not met it can follow: the formula, what it says
 * in words, and every symbol in it with its meaning and its unit.
 *
 * The equations are explained on the pages, not only shown: a formula is the
 * shortest statement of a model, and the shortest statement is the hardest to
 * read without its legend. So no formula on an exhibit's page stands alone —
 * each is this block, and the legend lists every letter the formula uses. The
 * symbols are TeX like the formula (the same glyphs the reader sees in it);
 * the words are the catalogue's.
 */

import { useTranslation } from "react-i18next";
import { Tex } from "@/shared/ui/tex";

export interface EquationSymbol {
  /** The symbol as it appears in the formula, in TeX. */
  tex: string;
  meaning: string;
  /** Its unit, written out (`m/s`, `V·s/m`); none for a pure number. */
  unit?: string;
}

export function Equation({ tex, reads, symbols }: { tex: string; reads: string; symbols: EquationSymbol[] }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-2 rounded-md bg-surface-2 px-3 py-2">
      <Tex block tex={tex} />
      <p className="text-sm text-primary">{reads}</p>
      {symbols.length > 0 && (
        <dl
          className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-sm"
          aria-label={t("experiments.equation.symbols")}
        >
          {symbols.map((symbol) => (
            <div key={symbol.tex} className="contents">
              <dt className="text-primary">
                <Tex tex={symbol.tex} />
              </dt>
              <dd className="text-secondary">
                {symbol.meaning}
                {symbol.unit && <span className="text-muted"> ({symbol.unit})</span>}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
