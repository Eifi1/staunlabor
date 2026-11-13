import type { ReactNode } from "react";
import { Trans } from "react-i18next";
import { TextLink } from "@eifi1/ui-kit";

/** Where the chart palette comes from, and its page. */
export const ANYPLOT_URL = "https://anyplot.ai";
export const ANYPLOT_PALETTE_URL = "https://anyplot.ai/palette";

/**
 * A link out, in a new tab, that counts for the site it names: no `nofollow`,
 * and no `noreferrer` either (the kit's `external` sets it), so anyplot.ai
 * sees where its visitors came from. `noopener` alone keeps the new tab from
 * reaching back into this one.
 */
function OutLink({ href, children }: { href: string; children?: ReactNode }) {
  return (
    <TextLink href={href} target="_blank" rel="noopener">
      {children}
    </TextLink>
  );
}

/**
 * The imprint's credits: the palette every chart is coloured from is
 * anyplot.ai's "Imprint", said with a link to the palette and one to the site
 * — the words in each catalogue's `legal.impressum.credits.body`, where
 * `<palette>` and `<site>` mark the two links.
 */
export function CreditsText() {
  return (
    <Trans
      i18nKey="legal.impressum.credits.body"
      components={{ palette: <OutLink href={ANYPLOT_PALETTE_URL} />, site: <OutLink href={ANYPLOT_URL} /> }}
    />
  );
}
