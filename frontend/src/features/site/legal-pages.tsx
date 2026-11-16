import { useTranslation } from "react-i18next";
import { LegalKitSection, LegalPage, LegalSection } from "@eifi1/ui-kit";
import { useAccountStorageLines } from "@eifi1/ui-kit/accounts";
import { STORAGE } from "@/shared/lib/storage-keys";
import { changeLanguage } from "@/shared/i18n/index";
import { CreditsText } from "./credits";
import { OPERATOR } from "./operator";

/** The day each page's text last changed for its readers: the deploy that put
 *  it live. A change to a page's words moves its date in the release that
 *  ships it. */
const UPDATED = { impressum: "2026-11-13", privacy: "2026-11-16" } as const;

/** "Show the German version": the binding text, one click away. */
const showGerman = () => void changeLanguage("de-CH", { remember: true });

/** The imprint, on the kit's page in the kit's words, as every app of the
 *  family has it. No notice and no footer of the kit's: the site is not a
 *  beta of anything, has no terms to link to, and draws its own footer. */
export function ImprintPage() {
  const { t } = useTranslation();
  return (
    <LegalPage
      page="impressum"
      updated={UPDATED.impressum}
      operator={OPERATOR}
      landmark={false}
      notice={null}
      footer={null}
      onShowBindingLanguage={showGerman}
      // The kit's non-commercial disclaimer says the project is "offered during
      // a closed beta"; the site is not a beta.
      labels={{ sections: { impressum: { disclaimer: { body: t("legal.impressum.disclaimer.body") } } } }}
    >
      <LegalKitSection section="operator" />
      <LegalKitSection section="contact" />
      <LegalKitSection section="disclaimer" />
      {/* Third-party acknowledgements, as keksdose's imprint has them: the
          page that names who is behind the site. Today the palette every
          chart and drawing is coloured from, anyplot.ai's "Imprint". */}
      <LegalSection key="credits" heading={t("legal.impressum.credits.title")}>
        <CreditsText />
      </LegalSection>
    </LegalPage>
  );
}

/** What the site's own lines say about the browser's storage, in the order
 *  the page lists them (`shared/lib/storage-keys.ts`). */
const BROWSER_ENTRIES = ["language", "look", "tried"] as const;

/** The privacy policy: the kit's sections where every site says the same, the
 *  site's own where it is different — the exhibits without an account, the
 *  accounts only by invitation, with feedback and the translation review, and
 *  what an erasure removes (`backend/staunlabor/accounts.py`). */
export function PrivacyPage() {
  const { t } = useTranslation();
  // The account's session (`STORAGE.accounts` + `session`): the kit's own lines, in the
  // kit's seven languages, since the kit's client is what writes it.
  const accountLines = useAccountStorageLines(STORAGE.accounts);
  const own = (key: string) => (
    <LegalSection key={key} heading={t(`legal.privacy.${key}.title`)} body={t(`legal.privacy.${key}.body`)} />
  );
  return (
    <LegalPage
      page="privacy"
      updated={UPDATED.privacy}
      operator={OPERATOR}
      landmark={false}
      notice={null}
      footer={null}
      onShowBindingLanguage={showGerman}
      // The kit's closing line speaks of reports waiting to be sent, which the
      // site has none of; its own says what goes to the server and what stays.
      labels={{ sections: { privacy: { browser: { tail: t("legal.privacy.browser.tail") } } } }}
    >
      <LegalKitSection section="controller" />
      {own("data")}
      <LegalKitSection section="legal_basis">{t("legal.privacy.legal_basis.site")}</LegalKitSection>
      {own("third_parties")}
      <LegalKitSection
        section="browser"
        entries={[
          ...BROWSER_ENTRIES.map((entry) => t(`legal.privacy.browser.entries.${entry}`)),
          ...accountLines.map((entry) => entry.line),
        ]}
      />
      {own("transfers")}
      {own("retention")}
      <LegalKitSection section="rights">{t("legal.privacy.rights.site")}</LegalKitSection>
      <LegalKitSection section="contact" />
    </LegalPage>
  );
}
