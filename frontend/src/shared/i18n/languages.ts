import {
  formatLocaleOf,
  languageOptions,
  resolveLanguage,
  type KitLanguageCode,
  type LanguageOption,
} from "@eifi1/ui-kit";

/** The language everything else falls back to, and the only one that is
 *  *bundled*.
 *
 *  It is stated here rather than in `./index.ts` because three things need it
 *  and none of them may disagree: i18next's `fallbackLng`, the catalogue that
 *  ships inside the entry chunk, and the language `useLocale()` formats for
 *  before one has resolved. It sits in this module — the one that says which
 *  languages exist — rather than in the one that initialises i18next, so
 *  reading it costs nothing: `use-locale.ts` would otherwise import the whole
 *  init path, catalogue included, to learn one string. */
export const FALLBACK_LOCALE = "de-CH";

/** The languages the site ships words for (see ./locales): all seven of the
 *  ones `@eifi1/ui-kit` ships a catalogue for, so the kit's words and the
 *  site's are never in two languages on one screen.
 *
 *  **Only the codes are the site's.** What each is called in itself, the flag
 *  it flies and the locale it formats in are the kit's registry
 *  (`KIT_LANGUAGES`), so English formats as `en-GB` because the registry says
 *  so rather than because this file does.
 *
 *  **There is one German, `de-CH`: Swiss spelling (ss for ß), formal ("Sie").**
 *  Every German a browser or an old stored choice asks for is read as it
 *  ({@link offered}). Its label is plain "Deutsch"; the Swiss flag says where
 *  the spelling comes from. */
const OFFERED = ["de-CH", "en", "es", "fr", "it", "hu", "zh"] as const satisfies readonly KitLanguageCode[];

export type LanguageCode = (typeof OFFERED)[number];

/** What `supportedLngs` is built from, so a language in the menu and a language
 *  i18next will resolve to cannot be two different lists. */
export const LANGUAGE_CODES: LanguageCode[] = [...OFFERED];

/** One language this app ships, as a switcher shows it, and the BCP-47 tag it
 *  formats and declares itself in.
 *
 *  **The code and the tag are two things.** The code names a *catalogue* — it is
 *  what i18next resolves and what the device stores —
 *  and a bare `en` says nothing about how a date is written. The tag is what goes
 *  on `<html lang>` and into every `toLocaleString`: `de-CH` writes 1’234.5,
 *  `en-GB` writes 2 October 2026. */
export interface AppLanguage extends LanguageOption {
  tag: string;
}

/** Every language, in the kit's order (alphabetical by its own name), each with
 *  its flag and its tag. */
export const LANGUAGES: readonly AppLanguage[] = languageOptions(LANGUAGE_CODES).map((option) => ({
  ...option,
  tag: formatLocaleOf(option.code),
}));

/** The code this app offers for what a reader asks for, in the order asked —
 *  the device's stored choice, then the browser's list — or the fallback when
 *  nothing matches.
 *
 *  The kit's `resolveLanguage`: exact first, then by language, so every German is
 *  `de-CH` (`de`, `de-AT`, the `de-informal` a reader may still have stored),
 *  every Chinese is `zh` — Simplified, which a reader of Traditional reads far
 *  more readily than a guess at a second language — and `en-AU` is `en`. Only
 *  within what this app offers: a browser saying `pt-BR` first and `en` second
 *  gets English. */
export function offered(...candidates: (string | null | undefined)[]): LanguageCode {
  return resolveLanguage(candidates, LANGUAGE_CODES) as LanguageCode;
}

/** The BCP-47 tag a language formats and declares itself in; the fallback's for
 *  a code this app does not ship. */
export function tagOf(code: string | undefined): string {
  return formatLocaleOf(offered(code));
}
