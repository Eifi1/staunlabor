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
| 2026-11-16 | `experiments.exhibits.overhang.*`, `experiments.overhang.*` | new: the overhang's page (`de-CH` "Der überhängende Stapel"), blocks stacked out over an edge; `de-CH` and `en` written, the other five machine-translated, with plurals for the blocks that tip and the reaches (`_one`, `_other`); a reviewer checks "Überhang", "Auflage" and "Schwerpunkt" in each language | a new exhibit |
| 2026-11-16 | `experiments.exhibits.diver.*`, `experiments.diver.*` | new: the Cartesian diver's page (`de-CH` "Der kartesische Taucher"), a squeezed bottle and its unstable hover; `de-CH` and `en` written, the other five machine-translated; a reviewer checks the diver's name in each language (ludión, ludion, diavoletto di Cartesio, Cartesius-búvár, 浮沉子) and "Schwebetiefe" | a new exhibit |
| 2026-11-16 | `experiments.topics.light`, `experiments.exhibits.rainbow.*`, `experiments.rainbow.*` | new: the topic "light" (`de-CH` "Licht") and the glass-bead rainbow's page (`de-CH` "Der Glasperlen-Regenbogen"), a ray through a bead and the ring round the shadow of one's head; `de-CH` and `en` written, the other five machine-translated; a reviewer checks "Brechzahl" against each language's word for the refractive index, "Regenbogenwinkel" and "Regenbogenstrahl", and that the prose's decimals follow each language (comma or point) | a new exhibit and topic |
| 2026-11-16 | `experiments.exhibits.sky.*`, `experiments.sky.*` | new: why the sky is blue (`de-CH` "Warum ist der Himmel blau?"), a cloudy tube blue from the side and orange at its end, and the sun through the air; `de-CH` and `en` written, the other five machine-translated; a reviewer checks "Trübung", "Luftmasse" and "optische Dicke" against each language's terms, and the decimals (comma or point) | a new exhibit |
| 2026-11-16 | `experiments.sky.air.ozone*`, `experiments.sky.model.ozone*`, `experiments.sky.symbols.{t3,sigma,n,m3,r,hh,h}`, `experiments.sky.sweet.ozone`; rewritten `sweet.sunset`, `computed.system`, `computed.left_out` | the ozone layer on the blue sky: a switch, how much of the orange it takes, two equations and a paragraph on why the sky overhead stays blue at sunset; the sun at the horizon now 3 % (4 % without the ozone); `de-CH` and `en` written, the other five machine-translated; a reviewer checks "Wirkungsquerschnitt", "Dobson-Einheiten" and "Ozon-Luftmasse" against each language's terms | the ozone extension |
| 2026-11-16 | `experiments.exhibits.slits.*`, `experiments.slits.*` | new: the double slit (`de-CH` "Der Doppelspalt"), a laser or white light through two slits or one; `de-CH` and `en` written, the other five machine-translated; a reviewer checks "Streifen" against each language's word for interference fringes (franges, franjas, frange, csíkok, 条纹), "Mittelband" and "Wegunterschied" | a new exhibit |
| 2026-11-16 | `experiments.exhibits.beats.*`, `experiments.beats.*` | new: beats (`de-CH` "Die Schwebung"), two tuning forks detuned by a rider, with sound off at first; `de-CH` and `en` written, the other five machine-translated; a reviewer checks "Reiter" (cavalier, jinete, cavaliere, lovas, 骑码), "Zinke" and "Schwebung" (battements, batido, battimenti, lebegés, 拍) in each language | a new exhibit |
| 2026-11-17 | `experiments.play.pause`, `experiments.play.run` | new: the shared words of a twin's Pause and Run button, each language's most used wording among the exhibits' own (`de-CH` "Anhalten"/"Weiter", `en` "Pause"/"Run"); first on the Coriolis carousel and the Chladni plate, which had no button | a reader who asked for reduced motion starts every twin still, and needs a button to start it |
| 2026-11-17 | `experiments.gyroscope.play.no_steady` | new: the line under the gyroscope's drawing when "Already circling" is asked of a wheel too slow to circle at its tilt, which is then let go from rest; `de-CH` and `en` written, the other five machine-translated | the page broke there before |
| 2026-11-17 | `experiments.slits.computed.system` | changed: one slit's middle band "reaches 26 mm to either side of the middle" (`de-CH` "das 26 mm zu beiden Seiten der Mitte reicht"), not "26 mm wide": 26 mm is the way to its first dark, the band 52 mm; `de-CH` and `en` written, the other five machine-translated | the mathematics check |
| 2026-11-17 | `experiments.rainbow.play.across_outside` | new: a ray that crosses the way back and lands outside the ring ("outside the ring at {{bow}}°", `de-CH` "ausserhalb des Rings bei {{bow}}°"), which `across` ("inside the ring too") had said of every crossing ray; true only up to an index of 1.62; `de-CH` and `en` written, the other five machine-translated | the mathematics check |
| 2026-11-17 | `experiments.maxwell.change.hint` | changed: a thinner axle or a rim-heavy wheel makes the jerk at the bottom "softer" (`de-CH` "sanfter"), not "harder": it comes down slower; `de-CH` and `en` written, the other five machine-translated | the mathematics check |
| 2026-11-17 | `experiments.foucault.sweet.floor` | changed: "the pendulum does not turn with the floor: … the floor turns away beneath its plane at {{rate}}° an hour" (`de-CH` "Das Pendel dreht sich nicht mit dem Boden"), not "keeps its plane in space", which holds only at a pole; `de-CH` and `en` written, the other five machine-translated | the mathematics check |
| 2026-11-18 | `experiments.coil.sweet.top_speed`, `experiments.coil.symbols.top_speed` | changed: the top speed is where the car's own brake takes from a pass all the battery can give, with plus the whole way in and minus the whole way out (`de-CH` "Bei diesem Tempo nimmt die Bremse einer Durchfahrt so viel, wie die Batterie höchstens geben kann"), 7.2 m/s, not where the car's voltage equals the battery's, which holds only at the peaks of the coupling (4.8 m/s); `de-CH` and `en` written, the other five machine-translated | the mathematics check |
| 2026-11-18 | `experiments.resonance.sweet.patience` | changed: the sweep's widest swing is 39 mm, half of the 78 mm in step (was 40 mm), now that a swing is measured at the drive's frequency; only the figure, in all seven | the mathematics check |
| 2026-11-18 | `experiments.elephant.play.falls_at`, `experiments.elephant.figures.limit`, `experiments.elephant.sweet.tilt` | changed: the limit is where the ball starts to rock, not where it falls (`de-CH` "Ruhig bis zu einer Neigung von", `en` "Steady up to a tilt of"); the sentence now says that past it the ball rocks, wider each time, until it falls, and that a quick tilt such as the auto mode's gets further first; `de-CH` and `en` written, the other five machine-translated; a reviewer checks "schaukeln" (rock, balancearse, osciller, dondolare, hintázni, 摇晃) | the mathematics check |
| 2026-11-18 | `experiments.waterwheel.play.regime_{pattern,starting}`, `experiments.waterwheel.sweet.{pattern,starting}`; rewritten `play.regime_chaotic`, `model.hopf` | what the wheel does, now read from the 200 s the page shows: reversals in a repeating pattern (`de-CH` "in einem festen Muster, das sich wiederholt"), and a run not yet settled ("findet noch in keinen festen Lauf"); chaos is "finds no steady turning", not "no steady turning holds", and the threshold paragraph says that above it the wheel is mostly chaotic, at some inflows in a pattern, and that below it it can stay chaotic from rest; `de-CH` and `en` written, the other five machine-translated | the mathematics check |
| 2026-11-18 | `experiments.peg.play.events.wound` | new: the line when the bob, flying free, has passed over the peg and the string stays wound round it (`de-CH` "Der Faden hat sich im Flug über den Stift gelegt: Er bleibt um ihn gewickelt."); `de-CH` and `en` written, the other five machine-translated | the mathematics check |
| 2026-11-18 | `experiments.chaos.computed.system` | changed: the step is a millisecond, and where a light upper arm under a heavy lower one whips round, equal parts of one, so that no arm turns more than 0.035 rad in a step; `de-CH` and `en` written, the other five machine-translated | the mathematics check |
| 2026-11-18 | `experiments.bounce.sweet.rules` | changed: the rule is 240 to 265 mm from 305 mm onto a steel block (ITTF Technical Leaflet T3, B.7, today's balls), not 230 to 250 mm, and the ball's 240 mm sits "at the lower limit" (`de-CH` "an der unteren Grenze"); `de-CH` and `en` written, the other five machine-translated | the mathematics check |
| 2026-11-18 | `experiments.wave.refused` | new: in place of the play card and the trick, when the sliders ask for a pendulum shorter than 2 cm (24 pendulums, 30 s, 80 swings, 40°), which the engine refuses; `de-CH` and `en` written, the other five machine-translated | the crash sweep |
| 2026-11-18 | `experiments.cannon.sweet.flip` | changed: turned over, the stack is no cannon, and the big ball on top climbs back less than it fell, the light balls below only cushioning it (`de-CH` "federn sie nur ab"); it said that nothing flies, which held only while the damping of contacts closed in the fall gave back nothing; `de-CH` and `en` written, the other five machine-translated | the mathematics check |
| 2026-11-18 | `experiments.resonance.model.frequency`, `experiments.resonance.symbols.{lambda,g}`, `experiments.resonance.sweet.{step,patience}` | the rods' own weight: the frequency sentence says it falls nearly as the square of the length and that, standing upright, the rod's own weight lowers it a little more, the metre rod's by a tenth (`de-CH` "Aufrecht stehend drückt ihn sein eigenes Gewicht der Länge nach zusammen"); new legends for Λ (1.571) and g, the latter copied from the coupled pendulums'; the figures 2.09 Hz, 7.6 s, 38 mm and 2.3 Hz for 2.21 Hz, 7.2 s, 39 mm and 2.4 Hz in all seven; `de-CH` and `en` written, the other five machine-translated | the mathematics check |
| 2026-11-18 | `experiments.chaos.sweet.chaotic` | changed: the exponent is measured "over half a minute", shown with one decimal as "λ ≈", "a single stretch of path, so a few tenths more or less" (`de-CH` "ein einzelnes Stück Bahn, also einige Zehntel mehr oder weniger"), and the difference doubles "about" every so many seconds; `de-CH` and `en` written, the other five machine-translated | the mathematics check |
| 2026-11-18 | `experiments.cradle.sweet.{wave,gap,two}` | changed: each share says of which energy — 97 % of what the collision leaves, 89 % of what came in, 8 % into the dents (`de-CH` "97 % der Energie, die nach dem Stoss bleibt, 89 % der hereingebrachten"); with 0.1 mm of air 99.9 % of what is left, but every hit takes its share and the last ball carries only 87 % of what came in, "less than touching"; two balls 97 % and 92 %; `de-CH` and `en` written, the other five machine-translated | the mathematics check |
| 2026-11-18 | `experiments.harmonograph.sweet.turns` | changed: the turn time is "at first" (`de-CH` "anfangs"), now that it is taken at the swings the pendulums are let go at and slows as they die away; `de-CH` and `en` written, the other five machine-translated | the mathematics check |
| 2026-11-18 | `experiments.overhang.model.even`, `experiments.overhang.sweet.steps` | changed: even steps reach n/(n + 1) with the bottom block jutting over the table as far as each block over the one below (`de-CH` "auch der unterste Klotz so weit über den Tisch wie jeder über den darunter"); with the bottom block set back a little nine reach 0.94, still never a whole length; `de-CH` and `en` written, the other five machine-translated | the mathematics check |
