/**
 * A formula, typeset.
 *
 * KaTeX, because every exhibit's page explains the mathematics behind it: a
 * conical pendulum's height written `ρ·cos θ = g'/Ω²` in running text is
 * readable once and a nuisance by the tenth formula. It is loaded with those
 * pages only (its own chunk, `manualChunks` in `vite.config.ts`) and renders
 * both HTML and MathML, so a screen reader reads the formula rather than its
 * glyphs.
 *
 * The TeX is the callers' own — written in their source with numbers the engine
 * returned formatted into it — never anything a reader typed; KaTeX's `trust`
 * stays off, so even a hostile string could not produce a link or a style. That
 * is what makes `dangerouslySetInnerHTML` safe here: what is inserted is
 * KaTeX's output for our input.
 *
 * Formulas are language-neutral and so not in the catalogues. A number inside
 * one goes through {@link texNumber}, which writes it the reader's way and
 * keeps TeX from reading a decimal comma as punctuation or a Swiss thousands
 * apostrophe as a prime.
 */

import katex from "katex";
import "katex/dist/katex.min.css";
import { formatNumber } from "@/shared/lib/format";

export function Tex({ tex, block = false, className }: { tex: string; block?: boolean; className?: string }) {
  const html = katex.renderToString(tex, { throwOnError: false, displayMode: block, output: "htmlAndMathml" });
  if (block) {
    // A display formula wider than a phone scrolls inside itself rather than
    // pushing the page sideways.
    return <div className={`overflow-x-auto py-1 ${className ?? ""}`} dangerouslySetInnerHTML={{ __html: html }} />;
  }
  return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}

/** A number for a formula, written the reader's way.
 *
 *  The sign stays outside `\text{}`, in math mode, where TeX draws its own minus.
 *  The design system writes a negative with U+2212 since 0.49, and KaTeX knows no
 *  such character in text mode: it drew it in a fallback font and warned on every
 *  render. A value that rounds to zero gets no sign, as the formatter's own zero. */
export function texNumber(value: number, digits: number, locale: string): string {
  const magnitude = formatNumber(Math.abs(value), digits, locale);
  const negative = Number.isFinite(value) && value < 0 && Number(Math.abs(value).toFixed(digits)) !== 0;
  return `${negative ? "-" : ""}\\text{${magnitude}}`;
}
