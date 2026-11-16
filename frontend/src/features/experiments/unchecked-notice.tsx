import { useTranslation } from "react-i18next";
import { AlertBanner } from "@eifi1/ui-kit";

/**
 * The notice that the exhibits' calculations still await their check (Marcel,
 * 2026-11-15): on every exhibit's page (`ExhibitFrame`) and on the overview.
 * Every figure is tested against the engine, and the engine against
 * independent counts, but nobody outside has gone through the models yet; a
 * reader who takes a number away should know that. One place, so it goes in
 * one edit once the check is done.
 */
export function UncheckedNotice() {
  const { t } = useTranslation();
  return <AlertBanner tone="warning">{t("experiments.unchecked")}</AlertBanner>;
}
