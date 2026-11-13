import type { LegalOperator } from "@eifi1/ui-kit";

/** Who runs the site, as the imprint and the privacy policy name them. The
 *  address is a site address Cloudflare forwards (`deploy/README.md` §5). */
export const OPERATOR: LegalOperator = {
  name: "Marcel Eifert",
  postalCode: "9470",
  city: "Buchs",
  region: "SG",
  country: "CH",
  email: "kontakt@staunlabor.app",
  bindingLanguage: "de-CH",
};

/** Where the code is, and where a reader reports what is wrong or missing. */
export const SOURCE_URL = "https://github.com/Eifi1/staunlabor";
export const ISSUES_URL = `${SOURCE_URL}/issues`;
