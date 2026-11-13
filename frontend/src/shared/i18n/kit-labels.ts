import { loadUiKitLabels, peekUiKitLabels, type UiKitLabels } from "@eifi1/ui-kit";
import { uiKitLabelsDeCh } from "@eifi1/ui-kit/i18n/de-CH";
import { FALLBACK_LOCALE, LANGUAGE_CODES, tagOf } from "./languages";

/**
 * Every string `@eifi1/ui-kit` renders, in each of the seven languages this app
 * ships — one kit catalogue per app catalogue, so a screen can never carry the
 * kit's words in one language and the app's in another.
 *
 * Handed whole to `<UiKitProvider>` in `main.tsx`, which is what reaches the
 * strings no prop could: the calculator inside a `NumberField`, the empty
 * state of a chart.
 *
 * **Fetched like the app's own catalogues, and for the same reason.** Each of
 * the kit's catalogues is 21–25 kB of JavaScript; six of them in the entry
 * chunk would undo what bundling only the fallback bought (see `./index.ts`).
 * So the one German is imported and every other language comes through the
 * kit's own lazy loader, `loadUiKitLabels` (since 0.19), and the kit keeps
 * what arrived (`peekUiKitLabels`, since 0.20), so this module holds no cache
 * of its own. `load` in `./index.ts` asks for the kit's half and the app's
 * half together, before the switch — never one without the other.
 *
 * **Formatted in the language's tag** (`tagOf`, the kit registry's format
 * locale), so the kit's counts and file sizes group their digits the way the
 * app's own `toLocaleString` calls do: 1’234 in German, 1,234 in English.
 *
 * To change a few of the kit's words, spread over what a loader returns rather
 * than copying a catalogue in: a copy has to be refreshed by hand every release,
 * and a key it misses renders English. The kit's `missingKitLabels` is what
 * would catch a catalogue that has fallen behind.
 */

/** The fallback's kit catalogue, in hand from the first paint like the app's. */
const BUNDLED = uiKitLabelsDeCh(tagOf(FALLBACK_LOCALE));

/** Fetch a language's kit catalogue if it is not in hand yet. The German is
 *  the bundled one rather than a second copy fetched through the kit, and a code
 *  this app does not ship loads nothing: {@link kitLabels} answers both in
 *  German — the same answer i18next gives for the app's half. */
export async function loadKitLabels(code: string): Promise<UiKitLabels> {
  if (code === FALLBACK_LOCALE || !(LANGUAGE_CODES as string[]).includes(code)) return BUNDLED;
  return loadUiKitLabels(code, tagOf(code));
}

/** The kit catalogue for `code`, synchronously — what `main.tsx` renders with.
 *  `changeLanguage` has fetched it before switching, so the German answer for
 *  an unloaded code is the frame before init rather than a state anybody sees. */
export function kitLabels(code: string): UiKitLabels {
  return peekUiKitLabels(code, tagOf(code)) ?? BUNDLED;
}
