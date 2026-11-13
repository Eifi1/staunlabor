# Translations

Staunlabor ships seven languages, each one `@eifi1/ui-kit` ships a catalogue
for, so the kit's words and the site's are never in two languages on one
screen. **There is one German, `de-CH`: Swiss spelling (ss for ß), formal
("Sie")**; every other German a browser asks for is read as it.
`frontend/src/shared/i18n/languages.ts` is the list.

* `frontend/src/shared/i18n/locales/<code>.json` holds a language's words:
  `app`, `common`, `site` and `legal` (the frame and the site's own pages) and
  `experiments` (the exhibits).
* `de-CH` is the fallback and the only catalogue in the first load; every
  other one is fetched when it is first shown (`shared/i18n/index.ts`).
* `catalogues.test.ts` holds every file to `de-CH.json`'s keys and
  placeholders, and no string may be empty.
* The imprint and the privacy policy are the kit's text in the kit's
  translations wherever every site says the same; German is binding, and
  every other language says so with a link to it.

## Who wrote which

| Code | Language | Register | Source | Reviewed by |
| --- | --- | --- | --- | --- |
| `de-CH` | Deutsch | formal (Sie), ss for ß | written | — (a Swiss reader's read is still wanted) |
| `en` | English | neutral | written | — |
| `es` | Español | formal (usted) | machine | — |
| `fr` | Français | formal (vous) | machine | — |
| `it` | Italiano | formal (Lei) | machine | — |
| `hu` | Magyar | formal (Ön) | machine | — |
| `zh` | 简体中文 | neutral polite (您) | machine | — (a `zh-TW`/`zh-HK` browser is shown this) |

"Machine" is Claude, in the register above. The exhibits' words came from
Kurvenschmiede's catalogues as they were on 2026-11-13; the site's own
(`app.tagline`, `site`, `legal`) were written for this site on 2026-11-13.

## For a reviewer

Look first at the exhibits' vocabulary, held the same across every page of a
language: exhibit, twin, "play the visitor", the engine, the trick, slider;
then the physics terms (angular momentum, autoresonance, induction, the
Bernoulli effect). Some choices were made without a native speaker:

* **"frei"**: in `site.about.lead` read as free of charge (gratuito, gratuit,
  gratuito, ingyenes, 免费); in `site.about.open` as libre (libre, libre,
  libero, szabad, 自由开放).
* **Winterthur**: fr writes "Winterthour" and zh "温特图尔", as the exhibits'
  credit already did; hu uses the adjective "winterthuri".
* **The Data Privacy Frameworks** keep their English names in all five.
* **"science centre"**: es "centro de ciencias", fr "centre de sciences", it
  "science center" (in English, as the file's "exhibit"), hu "tudományos
  élményközpont", zh "科学中心".
* **Drawings** in zh: "插图".

A change to a wording a reviewer may already have read goes in a line below,
so a reviewer knows which wordings are newer than the rest.

| Date | Key | What changed | Why |
| --- | --- | --- | --- |
| 2026-11-13 | `legal.impressum.disclaimer.body` | new: the imprint's disclaimer without the kit's "offered during a closed beta"; `de-CH` and `en` written, the other five from the kit's own translation with that clause taken out | the site is not a beta |
| 2026-11-13 | `legal.privacy.browser.tail` | new: the privacy page's closing line on what the browser keeps; `de-CH` and `en` written, the other five machine-translated | the kit's line speaks of reports waiting to be sent and of signing out, and the site has neither |
