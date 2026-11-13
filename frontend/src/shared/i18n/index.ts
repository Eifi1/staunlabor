import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { readStored, resolveAccountLanguage, writeStored } from "@eifi1/ui-kit";
import deCH from "./locales/de-CH.json";
import { loadKitLabels } from "./kit-labels";
import { FALLBACK_LOCALE, LANGUAGE_CODES, offered, tagOf } from "./languages";
import { STORAGE } from "@/shared/lib/storage-keys";

/**
 * The site's words: one catalogue per language, Swiss German compiled in (the
 * fallback every key falls back to), every other language fetched when it is
 * first shown — a reader of one language never downloads the six others.
 *
 * Which language: the one picked on this device, else the browser's first one
 * the site offers, else Swiss German. There are no accounts to ask.
 */

/** Every other catalogue, as its own chunk. */
const FETCHED = import.meta.glob<{ default: Record<string, unknown> }>(["./locales/*.json", "!./locales/de-CH.json"]);

const ready = new Set<string>([FALLBACK_LOCALE]);

async function load(code: string): Promise<void> {
  if (ready.has(code)) return;
  const fetch = FETCHED[`./locales/${code}.json`];
  if (!fetch) return;
  const [words] = await Promise.all([fetch(), loadKitLabels(code)]);
  i18n.addResourceBundle(code, "translation", words.default, true, true);
  ready.add(code);
}

/** The language for this reader, on this device. */
export function readerLanguage(): string {
  const browser = typeof navigator === "undefined" ? [] : [...(navigator.languages ?? [navigator.language])];
  return resolveAccountLanguage({
    device: readStored(STORAGE.language),
    account: null,
    browser,
    offered: LANGUAGE_CODES,
    fallback: FALLBACK_LOCALE,
  }).language;
}

/** `<html lang>` follows the words on screen: screen readers take their
 *  pronunciation from it. */
export function syncHtmlLang(): void {
  document.documentElement.setAttribute("lang", tagOf(i18n.resolvedLanguage ?? i18n.language));
}

/** Switch to `lng`, its words fetched before the switch so no frame shows raw
 *  keys; remembered on this device when the reader picked it. */
export async function changeLanguage(lng: string, { remember = false }: { remember?: boolean } = {}): Promise<void> {
  const code = offered(lng);
  await load(code);
  await i18n.changeLanguage(code);
  if (remember) writeStored(STORAGE.language, code);
  syncHtmlLang();
}

export async function initI18n(): Promise<void> {
  const lng = readerLanguage();
  await i18n.use(initReactI18next).init({
    lng: FALLBACK_LOCALE,
    fallbackLng: FALLBACK_LOCALE,
    supportedLngs: LANGUAGE_CODES,
    interpolation: { escapeValue: false },
    resources: { [FALLBACK_LOCALE]: { translation: deCH } },
  });
  await changeLanguage(lng);
}
