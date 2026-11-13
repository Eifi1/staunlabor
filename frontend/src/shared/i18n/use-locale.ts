import { useTranslation } from "react-i18next";
import { FALLBACK_LOCALE, tagOf } from "./languages";

/** The BCP-47 tag every `toLocaleString` in this app formats against —
 *  `de-CH`, `en-GB`, `zh-CN` — and never the catalogue code: `en` says nothing
 *  about how a number is written (see `AppLanguage` in `./languages.ts`).
 *
 *  The fallback is `fallbackLng` from `initI18n`, and this file is why that is
 *  one constant rather than a `?? "de"` in every component that formats: a
 *  fallback written at each call site is a habit rather than a decision, and a
 *  habit is what gets half-changed. A build that ships before i18next has
 *  resolved a language, or with a detector that finds nothing, would then
 *  format a few numbers as `1,234.5` among a page of `1.234,5`. */
export function useLocale(): string {
  return tagOf(useLanguage());
}

/** The catalogue code the reader has chosen — `de-CH`, `en` — for the
 *  places that need *which language* rather than *how to format*: the pickers'
 *  current value and the design system's catalogue. */
export function useLanguage(): string {
  const { i18n } = useTranslation();
  return i18n.resolvedLanguage ?? FALLBACK_LOCALE;
}
