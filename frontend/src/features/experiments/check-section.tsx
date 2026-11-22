import { useTranslation } from "react-i18next";
import { BookOpen, ClipboardCheck, SlidersHorizontal } from "lucide-react";
import { Button, Card, CardHeader, CardTitle, Chip, TextLink } from "@eifi1/ui-kit";
import { useLocale } from "@/shared/i18n/use-locale";
import { formatSig, powerOfTen, superscript } from "@/shared/lib/format";
import { CHECK_FORMULAS } from "./check-formulas";
import { askCheckSetting } from "./check-setting";
import { checkCases, type CheckCase } from "./checks";
import { Equation } from "./equation";
import type { Exhibit } from "./exhibits";

/** The section's anchor, which the check status under the title links to. */
export const CHECKS_ANCHOR = "check-it";

/** `6.2 · 10⁻¹⁷`: for the tiny numbers a check compares, where fixed decimals
 *  would print a row of zeros. The checks' own look, spaced and with two
 *  significant digits, where the readouts' `formatPowerOfTen` writes `6.2·10⁻¹⁷`. */
function scientific(value: number, locale: string): string {
  const { mantissa, exponent } = powerOfTen(value);
  return `${formatSig(mantissa, locale, 2)} · 10${superscript(exponent)}`;
}

/** Seven significant digits: enough to see where the two values part. The
 *  site's minus (`formatSig`), since an expected or measured value can be
 *  negative. */
function checkValue(value: number, locale: string): string {
  if (value === 0) return "0";
  if (Math.abs(value) < 1e-4) return scientific(value, locale);
  return formatSig(value, locale, 7);
}

/** A relative deviation as a percentage, or in powers of ten once it is
 *  below a hundredth of a per cent. */
function checkShare(share: number, locale: string): string {
  if (share === 0) return "0";
  if (share < 1e-4) return scientific(share, locale);
  return `${formatSig(share * 100, locale, 2)} %`;
}

/** A value with its unit, joined by a narrow no-break space so the unit never
 *  wraps onto a line of its own (the kit's `unit` rule, which wants a number
 *  where this has the text `checkValue` made). */
function withUnit(text: string, unit: string): string {
  return unit ? `${text}\u202f${unit}` : text;
}

function CaseCard({ exhibit, item, index }: { exhibit: Exhibit; item: CheckCase; index: number }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const words = `experiments.checks.cases.${exhibit}.${item.key}`;
  const formula = CHECK_FORMULAS[exhibit]?.[item.key];
  // Where the expected value is zero the deviation is absolute, in the unit.
  const absolute = item.expected === 0;
  const off = absolute ? withUnit(checkValue(item.deviation, locale), item.unit) : checkShare(item.deviation, locale);
  const allowed = absolute
    ? withUnit(checkValue(item.tolerance, locale), item.unit)
    : checkShare(item.tolerance, locale);
  return (
    <li className="space-y-3 border-t border-subtle pt-4 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-base font-semibold text-primary">
          {index + 1}. {t(`${words}.title`)}
        </h3>
        {item.derived && (
          <Chip size="xs" tone="neutral">
            {t("experiments.checks.derived")}
          </Chip>
        )}
        {/* Tried, not only read: the twin above set to the case. A case the
            page cannot show (a rod's length it has no input for, a box of
            states, an answer the trick holds back) has no setting, and no
            button that would do nothing. */}
        {Object.keys(item.setting).length > 0 && (
          <Button
            variant="secondary"
            size="sm"
            className="ml-auto"
            title={t("experiments.checks.set_up_hint")}
            onClick={() => askCheckSetting(exhibit, item.setting)}
          >
            <SlidersHorizontal className="size-4" aria-hidden />
            {t("experiments.checks.set_up")}
          </Button>
        )}
      </div>
      <p className="text-sm text-secondary">
        <span className="font-medium text-primary">{t("experiments.checks.setting")}: </span>
        {t(`${words}.setting`)}
      </p>
      {formula && (
        <Equation
          tex={formula.tex}
          reads={t(`${words}.reads`)}
          symbols={formula.symbols.map((symbol) => ({
            tex: symbol.tex,
            meaning: t(`experiments.checks.symbols.${symbol.key}`),
            unit: symbol.unit,
          }))}
        />
      )}
      <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-[auto_minmax(0,1fr)]">
        <dt className="text-secondary">{t("experiments.checks.by_hand")}</dt>
        <dd className="font-medium text-primary tabular-nums">
          {withUnit(checkValue(item.expected, locale), item.unit)}
        </dd>
        <dt className="text-secondary">{t("experiments.checks.page")}</dt>
        <dd className="font-medium text-primary tabular-nums">
          {withUnit(checkValue(item.measured, locale), item.unit)}
        </dd>
      </dl>
      <p className="text-sm text-secondary">{t("experiments.checks.deviation", { value: off, allowed })}</p>
      <p className="text-sm text-secondary">
        <span className="font-medium text-primary">{t("experiments.checks.why")}: </span>
        {t(`${words}.why`)}
      </p>
      {item.derived && (
        <p className="text-sm text-secondary">
          <span className="font-medium text-primary">{t("experiments.checks.step")}: </span>
          {t(`${words}.step`)}
        </p>
      )}
      <div className="space-y-2">
        <p className="flex items-center gap-1.5 text-sm font-medium text-primary">
          <BookOpen className="size-4 text-brand" aria-hidden />
          {t("experiments.checks.sources")}
        </p>
        <ul className="space-y-2">
          {item.sources.map((source) => (
            <li key={source.url + source.cite} className="space-y-1 text-sm">
              <TextLink href={source.url} target="_blank" rel="noopener">
                {source.cite}
              </TextLink>
              {/* Untranslated, as the source has it: a reader checks the words. */}
              <blockquote
                lang="en"
                className="border-l-2 border-subtle pl-3 text-secondary italic"
                title={t("experiments.checks.original")}
              >
                {source.quote}
              </blockquote>
            </li>
          ))}
        </ul>
      </div>
    </li>
  );
}

/**
 * "Check it yourself": the exhibit's limiting cases, each with its formula,
 * its source quoted, the value by hand and the page's (Marcel, 2026-11-19:
 * the checking should also teach, so others can follow it). Only for the
 * exhibits that have cases.
 */
export function CheckSection({ exhibit }: { exhibit: Exhibit }) {
  const { t } = useTranslation();
  const cases = checkCases(exhibit);
  if (cases.length === 0) return null;
  return (
    <Card padding="md" density="compact" className="space-y-4">
      <CardHeader>
        <div className="flex items-center gap-2">
          <ClipboardCheck className="size-5 shrink-0 text-brand" aria-hidden />
          <CardTitle as="h2" id={CHECKS_ANCHOR}>
            {t("experiments.checks.title")}
          </CardTitle>
        </div>
      </CardHeader>
      <p className="max-w-[75ch] text-sm text-secondary">{t("experiments.checks.intro")}</p>
      <ol className="space-y-4">
        {cases.map((item, index) => (
          <CaseCard key={item.key} exhibit={exhibit} item={item} index={index} />
        ))}
      </ol>
    </Card>
  );
}
