import { useTranslation } from "react-i18next";
import { PageHeader } from "@eifi1/ui-kit";
import { AccountFeedbackPage } from "@eifi1/ui-kit/accounts";

/**
 * `/feedback`, the admin's inbox, and `/my-feedback`, everybody's own reports: the kit's
 * feedback pages on server-kit's `feedback_router`. The planned exhibits are filed there as
 * ideas (plan, second stage), so the inbox is the site's to-do list too; an admin answers,
 * moves and edits each. Anybody but an admin who opens the inbox is sent to their own.
 *
 * No public list and no submit menu yet: feedback waits until the site opens beyond its
 * invitations (Marcel, 2026-11-14). The comments and votes stay on, as the server's
 * `public_viewer` admits every account.
 *
 * The kit's header, with one sentence of the site's under its title (Marcel, 2026-11-15, in
 * place of terms of use): feedback is sent under CC BY 4.0, the licence of every text here,
 * so ideas and wording from it may be taken over.
 *
 * No screenshot button (`onCaptureScreenshot={null}`, ui-kit 0.66): the kit's capture needs
 * `modern-screenshot`, which this site does not install, so the button always failed. A
 * reporter attaches a picture of their own instead.
 */
export function FeedbackInboxPage() {
  return <AccountFeedbackPage mine={false} header={useLicensedHeader()} onCaptureScreenshot={null} />;
}

export function MyFeedbackPage() {
  return <AccountFeedbackPage mine header={useLicensedHeader()} onCaptureScreenshot={null} />;
}

function useLicensedHeader() {
  const { t } = useTranslation();
  return (title: string) => (
    <PageHeader size="compact" title={title} description={t("account.contributions.feedback")} />
  );
}
