/**
 * The account layer's pages for the admin and the reviewers: the feedback inbox the planned
 * exhibits are filed in, the admin page on the kit's sections, and the translation review over
 * the catalogues the site ships. The kit tests its parts; these hold the site's wiring — which
 * routes, which roles, which areas.
 */
import { afterEach, describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { Route, Routes, useLocation } from "react-router";
import en from "@/shared/i18n/locales/en.json";
import { renderSignedIn } from "@/test/accounts";
import { AdminPage } from "./admin-page";
import { FeedbackInboxPage, MyFeedbackPage } from "./feedback-pages";
import { TranslationsPage } from "./translations-page";

const admin = { id: 1, email: "kontakt@staunlabor.app", first_name: "Staunlabor", last_name: "Planung", role: "ADMIN" };
const member = { id: 7, email: "ben@example.com", first_name: "Ben", last_name: "Example", role: "MEMBER" };

const idea = (id: number, title: string) => ({
  id,
  user_id: 1,
  user_email: admin.email,
  title,
  body: "Ein Exponat, das sich als Simulation eignet.",
  category: "IDEA",
  status: "OPEN",
  context: { route: "/", plan: "exhibits" },
  screenshot_url: null,
  attachment_urls: [],
  outcome: null,
  resolved_at: null,
  created_at: "2026-11-14T09:00:00Z",
  updated_at: "2026-11-14T09:00:00Z",
  replies: [],
});

function Where() {
  const { pathname, search } = useLocation();
  return <output data-testid="where">{`${pathname}${search}`}</output>;
}

afterEach(() => localStorage.clear());

describe("the feedback inbox", () => {
  it("shows the admin the ideas filed for the exhibits still to come", async () => {
    renderSignedIn(<FeedbackInboxPage />, {
      user: admin,
      routes: { "get /feedback": [idea(2, "Pendelwelle"), idea(3, "Doppelkegel")] },
    });
    expect((await screen.findAllByText("Pendelwelle")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Doppelkegel").length).toBeGreaterThan(0);
  });

  it("sends a member to their own reports", async () => {
    renderSignedIn(
      <Routes>
        <Route path="/feedback" element={<FeedbackInboxPage />} />
        <Route path="/my-feedback" element={<Where />} />
      </Routes>,
      { user: member, initialEntries: ["/feedback?row=2"] },
    );
    expect(await screen.findByTestId("where")).toHaveTextContent("/my-feedback?row=2");
  });

  it("lists a member's own reports on their page", async () => {
    renderSignedIn(<MyFeedbackPage />, { user: member, routes: { "get /feedback/my": [idea(4, "Wirbel")] } });
    expect((await screen.findAllByText("Wirbel")).length).toBeGreaterThan(0);
  });
});

describe("the admin page", () => {
  it("heads the kit's sections with the site's word, the counts first", async () => {
    renderSignedIn(<AdminPage />, {
      user: admin,
      routes: {
        "get /admin/attention": {
          feedback_waiting: 19,
          deletion_requests: 0,
          invitations_pending: 0,
          users_total: 1,
          users_new_7d: 1,
          extra: {},
        },
        "get /admin/users": {
          users: [
            {
              ...admin,
              is_active: true,
              email_verified: true,
              translation_review_locales: [],
              translation_review_areas: null,
            },
          ],
          total: 1,
          mail_backend: "console",
          summary: { active_admins: 1 },
          levels: {},
        },
        "get /admin/invitations": [],
        "get /admin/actions": { actions: [], total: 0 },
        "get /admin/mail": { mail_backend: "console" },
      },
    });
    expect(screen.getByRole("heading", { level: 1, name: en.account.admin })).toBeInTheDocument();
    // The ideas waiting, as the overview's "To triage" tile.
    expect(await screen.findByText("19")).toBeInTheDocument();
  });
});

describe("the translation review", () => {
  it("reads the site's own catalogue against German, in the languages the server grants", async () => {
    renderSignedIn(<TranslationsPage />, {
      user: admin,
      routes: { "get /translations/reviews": { locales: ["fr"], areas: null, reviews: [] } },
      initialEntries: ["/translations?q=account.admin"],
    });
    expect(await screen.findByText("Administration", {}, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getByText("Verwaltung")).toBeInTheDocument();
  });
});
