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
 */
export function FeedbackInboxPage() {
  return <AccountFeedbackPage mine={false} />;
}

export function MyFeedbackPage() {
  return <AccountFeedbackPage mine />;
}
