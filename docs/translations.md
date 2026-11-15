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
* The account mails (the invitation, the address check and change, the reset,
  the deletion, a new passkey) are server-kit's (`eifi1_server_kit.auth.mails`,
  0.29), and so is the admin's test mail (`eifi1_server_kit.mail`, 0.30), in
  the same seven languages, `de-CH` formal with "ss"; the backend writes none of
  its own. Each goes in its reader's account language, an invitation in the one
  the admin picks. A wording a reviewer finds there is an ask upstream.
* A reviewer is given languages, any of the seven, and may be limited to areas
  (`accounts.REVIEW_AREAS`): `experiments`, the exhibits' words and their
  physics, or `legal`, the imprint and the privacy policy. Without an area, a
  reviewer reads every key of their languages.

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
| 2026-11-13 | `legal.impressum.credits.title`, `legal.impressum.credits.body` | new: the imprint credits anyplot.ai's "Imprint", the palette of the charts and drawings, as keksdose's imprint does; `de-CH` and `en` from keksdose's words, the other five machine-translated | the colours are anyplot.ai's |
| 2026-11-14 | `site.footer.signIn`, `site.footer.account`, `account.settings`, `account.roles.*` | new: the footer's sign-in and account link, the settings page's heading, the three roles; `de-CH` and `en` written, the other five machine-translated | the accounts (plan, second stage) |
| 2026-11-14 | `account.admin`, `account.reviewTranslations`, `account.more`, `account.areas.*` | new: the admin page's heading, the link to the translation review, the settings page's links' name, the review areas' names (`experiments` in each language's word for exhibit, as `site.about`); `de-CH` and `en` written, the other five machine-translated | the admin page and `/translations` on the kit's sections |
| 2026-11-14 | `account.feedback` | new: the settings page's link to the feedback inbox, where the planned exhibits are filed as ideas; `de-CH` and `en` written, the other five machine-translated | the feedback pages on the kit's |
| 2026-11-14 | `experiments.exhibits.wave.*`, `experiments.wave.*` | new: the pendulum wave's page; `de-CH` and `en` written, the other five machine-translated | a new exhibit |
| 2026-11-14 | `experiments.exhibits.harmonograph.*`, `experiments.harmonograph.*` | new: the harmonograph's page; `de-CH` and `en` written, the other five machine-translated | a new exhibit |
| 2026-11-15 | `legal.privacy.data.body`, `legal.privacy.third_parties.body`, `legal.privacy.transfers.body`, `legal.privacy.retention.body`, `legal.privacy.browser.tail` | rewritten for the accounts: the exhibits without one, an account only by invitation and what it keeps (the sealed second factor, the sessions' addresses), feedback and the translation review, Resend in Ireland, the 30 days the daily call prunes after, what an erasure anonymises and deletes; `de-CH` and `en` written, the other five machine-translated, the Cloudflare and GitHub paragraphs kept from their earlier wording | plan, second stage, step 5; a reviewer checks the passkey and two-factor terms against the kit's own in each language |
| 2026-11-15 | `legal.privacy.rights.site`, `site.about.accounts` | new: the export and the deletion request in the settings; the about page's line that the exhibits need no account and accounts come by invitation; `de-CH` and `en` written, the other five machine-translated | the same |
| 2026-11-15 | `legal.privacy.retention.body` | the deletion now automatic, 30 days after the request, an admin's reactivation keeping the account; the database backups' seven days; `de-CH` and `en` written, the other five machine-translated | Marcel: the daily call erases, no promise kept by hand |
| 2026-11-15 | `account.contributions.translations`, `account.contributions.feedback` | new: one sentence under the translation review's lead and the feedback pages' title, that a suggestion or a report is sent under CC BY 4.0, the licence of the site's texts; `de-CH` and `en` written, the other five machine-translated | Marcel, in place of terms of use; a reviewer checks "license … under" reads as granting a licence in each language |
| 2026-11-15 | `experiments.exhibits.cone.*`, `experiments.cone.*` | new: the double cone's page; `de-CH` and `en` written, the other five machine-translated | a new exhibit |
| 2026-11-15 | `experiments.exhibits.parabola.*`, `experiments.parabola.*` | new: the water parabola's page; `de-CH` and `en` written, the other five machine-translated | a new exhibit |
| 2026-11-15 | `experiments.exhibits.coupled.*`, `experiments.coupled.*` | new: the coupled pendulums' page; `de-CH` and `en` written, the other five machine-translated | a new exhibit |
| 2026-11-15 | `experiments.exhibits.peg.*`, `experiments.peg.*` | new: Galileo's interrupted pendulum's page; `de-CH` and `en` written, the other five machine-translated | a new exhibit |
| 2026-11-15 | `experiments.exhibits.maxwell.*`, `experiments.maxwell.*` | new: Maxwell's wheel's page; `de-CH` and `en` written, the other five machine-translated | a new exhibit |
| 2026-11-15 | `experiments.exhibits.chaos.*`, `experiments.chaos.*` | new: the chaotic pendulum's page; `de-CH` and `en` written, the other five machine-translated | a new exhibit |
| 2026-11-15 | `experiments.exhibits.waterwheel.*`, `experiments.waterwheel.*` | new: the chaotic waterwheel's page; `de-CH` and `en` written, the other five machine-translated | a new exhibit |
| 2026-11-15 | `experiments.exhibits.foucault.*`, `experiments.foucault.*` | new: Foucault's pendulum's page; `de-CH` and `en` written, the other five machine-translated | a new exhibit |
| 2026-11-15 | `experiments.exhibits.coriolis.*`, `experiments.coriolis.*` | new: the Coriolis carousel's page; `de-CH` and `en` written, the other five machine-translated | a new exhibit |
| 2026-11-15 | `experiments.exhibits.cradle.*`, `experiments.cradle.*` | new: Newton's cradle's page (`de-CH` "Kugelstosspendel"); `de-CH` and `en` written, the other five machine-translated | a new exhibit |
| 2026-11-15 | `experiments.exhibits.well.*`, `experiments.well.*` | new: the gravity well's page (`de-CH` "Gravitationstrichter"); `de-CH` and `en` written, the other five machine-translated | a new exhibit |
| 2026-11-15 | `experiments.exhibits.resonance.*`, `experiments.resonance.*` | new: the resonant rods' page (`de-CH` "Resonanzstäbe"), with the first sound switch (off by default); `de-CH` and `en` written, the other five machine-translated | a new exhibit |
| 2026-11-15 | `experiments.exhibits.gyroscope.*`, `experiments.gyroscope.*` | new: the gyroscope wheel's page (`de-CH` "Kreiselrad"); `de-CH` and `en` written, the other five machine-translated | a new exhibit |
| 2026-11-15 | `experiments.exhibits.arch.*`, `experiments.arch.*`, `experiments.topics.equilibrium` | new: the chain and the arch's page (`de-CH` "Kette und Bogen"), and the overview's topic "Gleichgewicht"; `de-CH` and `en` written, the other five machine-translated | a new exhibit |
| 2026-11-15 | `experiments.exhibits.chladni.*`, `experiments.chladni.*` | new: the Chladni figures' page (`de-CH` "Chladni-Figuren"), the second with a sound switch; `de-CH` and `en` written, the other five machine-translated | a new exhibit |
| 2026-11-15 | `experiments.exhibits.levitation`, `experiments.levitation.*` | new: the floating top, a spinning magnet over a ring magnet in a window a few millimetres high; `de-CH` and `en` written, the other five machine-translated; a reviewer checks the words for "top", "ring magnet", "lift" and "washers" in each language | Marcel: the hover-window page (no brand name: not "Levitron") |
| 2026-11-15 | `experiments.exhibits.circuit.*`, `experiments.circuit.*` | new: the slow LC circuit's page (`de-CH` "Der langsame Schwingkreis"), a capacitor that swings through a coil, with its spring twin; `de-CH` and `en` written, the other five machine-translated; a reviewer checks "Schwingkreis", "Umschalter", "Grenzwiderstand" and "Güte" in each language | Marcel: "Schwingkreis bitte bauen" |
| 2026-11-15 | `experiments.unchecked` | new: the notice on the overview and every exhibit's page that the calculations still await their check (Marcel's wish); `de-CH` and `en` written, the other five machine-translated | until the check is done |
| 2026-11-15 | `experiments.overview.credit`, `site.about.model` | changed: the credit to the museum says "most of the exhibits" (`de-CH` "Die meisten Exponate sind inspiriert von …"), since the slow LC circuit is not one of its exhibits; `de-CH` and `en` written, the other five machine-translated; a reviewer checks that each still says "inspired by", never "from" | Marcel: "Die meisten" |
| 2026-11-15 | `experiments.exhibits.plates.*`, `experiments.plates.*` | new: the falling plates' page (`de-CH` "Die fallenden Platten"), metal plates braked by eddy currents between magnets; `de-CH` and `en` written, the other five machine-translated; a reviewer checks "Wirbelstrom" (eddy current, courant de Foucault, corrente parassita, örvényáram, 涡流), "Endgeschwindigkeit" and "Zahn"/"Schlitz" in each language | a new exhibit |
| 2026-11-16 | `experiments.exhibits.bounce.*`, `experiments.bounce.*` | new: the bouncing ball's page (`de-CH` "Die hüpfende Stahlkugel"), a steel ball and a table-tennis ball bouncing out on a plate, with clicks; `de-CH` and `en` written, the other five machine-translated; a reviewer checks "Stosszahl" (restitution, coefficient de restitution, coeficiente de restitución, coefficiente di restituzione, ütközési szám, 恢复系数) and the name of table tennis in each language | a new exhibit |
