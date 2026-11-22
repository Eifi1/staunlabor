/**
 * The pieces every lesson is built from: a widget's card, its figures, its
 * sliders, the list of what a model leaves out. The logarithmic axes the kit's
 * charts do not have are `shared/charts/log-axis.ts`, which an exhibit uses too.
 *
 * One file rather than one per piece because each is a few lines and they are
 * always used together; anything with behaviour of its own (the exercise, the
 * pole plane, the chain animation) has its own module.
 */

import { useTranslation } from "react-i18next";
import { AlertBanner, Disclosure } from "@eifi1/ui-kit";
import { apiErrorMessage } from "@/shared/api/client";

export { Figures, Param, WidgetBody, WidgetCard } from "@/shared/ui/widget";

/** What the model deliberately leaves out — every lesson says, folded away so
 *  it does not stand between the reader and the experiment. */
export function Assumptions({ items }: { items: string[] }) {
  const { t } = useTranslation();
  return (
    <Disclosure title={t("course.frame.assumptions")} hint={t("course.frame.assumptions_hint")}>
      <ul className="list-disc space-y-1 pl-5 text-sm text-secondary">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </Disclosure>
  );
}

/** A request that failed, in the server's words; nothing while it is fine. */
export function Failed({ error }: { error: unknown }) {
  const { t } = useTranslation();
  if (error == null) return null;
  return <AlertBanner tone="danger">{apiErrorMessage(error, t("course.failed"))}</AlertBanner>;
}
