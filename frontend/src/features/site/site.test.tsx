/**
 * The site's own pages: the footer every page ends in, the about page with the
 * one line that names the museum as the model, the imprint and the privacy
 * policy on the kit's legal page, and the 404 for every address that is not a
 * page. The legal pages say only what is true of the site: the exhibits without
 * an account, accounts only by invitation and what they keep — no beta notice,
 * no terms.
 */
import { describe, expect, it } from "vitest";
import { screen, within } from "@testing-library/react";
import { Route, Routes } from "react-router";
import en from "@/shared/i18n/locales/en.json";
import { renderWithProviders } from "@/test/render";
import { AppRoutes } from "@/app/routes";
import { EXHIBITS } from "@/features/experiments/exhibits";
import { AboutPage } from "./about-page";
import { ANYPLOT_PALETTE_URL, ANYPLOT_URL } from "./credits";
import { ImprintPage, PrivacyPage } from "./legal-pages";
import { ISSUES_URL, OPERATOR, SOURCE_URL } from "./operator";
import { SiteFooter } from "./site-footer";

const S = en.site;
const P = en.legal.privacy;

describe("the footer", () => {
  it("links the site's pages, the code and the issues, and says the licences and the version", () => {
    renderWithProviders(<SiteFooter />);
    const nav = screen.getByRole("navigation", { name: S.footer.label });
    const href = (name: string) => within(nav).getByRole("link", { name }).getAttribute("href");
    expect(href(S.footer.about)).toBe("/about");
    expect(href(S.footer.imprint)).toBe("/impressum");
    expect(href(S.footer.privacy)).toBe("/privacy");
    expect(href(S.footer.source)).toBe(SOURCE_URL);
    expect(href(S.footer.issues)).toBe(ISSUES_URL);
    expect(screen.getByText(new RegExp(S.footer.licence.slice(0, 20)))).toHaveTextContent(__APP_VERSION__);
  });
});

describe("the about page", () => {
  it("names the museum as the model and says the site is not affiliated with it", () => {
    renderWithProviders(<AboutPage />);
    expect(screen.getByRole("heading", { level: 1, name: S.about.title })).toBeInTheDocument();
    expect(screen.getByText(S.about.model)).toBeInTheDocument();
    expect(S.about.model).toMatch(/inspired by/);
    expect(S.about.model).toMatch(/not affiliated/);
  });

  it("says the exhibits need no account, and accounts come by invitation", () => {
    renderWithProviders(<AboutPage />);
    expect(screen.getByText(S.about.accounts)).toBeInTheDocument();
    expect(S.about.accounts).toMatch(/^The exhibits need no account\..*only by invitation/);
  });

  it("sends feedback to the repository's issues", () => {
    renderWithProviders(<AboutPage />);
    expect(screen.getByRole("link", { name: S.about.issues })).toHaveAttribute("href", ISSUES_URL);
    expect(screen.getByRole("link", { name: S.about.source })).toHaveAttribute("href", SOURCE_URL);
  });
});

describe("the imprint", () => {
  it("names the operator and the site's address", async () => {
    renderWithProviders(<ImprintPage />);
    expect(await screen.findByText(new RegExp(`^${OPERATOR.name}`))).toHaveTextContent(OPERATOR.city);
    expect(screen.getByText(new RegExp(OPERATOR.email))).toBeInTheDocument();
  });

  it("credits anyplot.ai for the palette the charts and drawings are coloured from", async () => {
    renderWithProviders(<ImprintPage />);
    expect(await screen.findByRole("heading", { name: en.legal.impressum.credits.title })).toBeInTheDocument();
    // Two links that count for anyplot.ai: no nofollow, and the referrer kept.
    const palette = screen.getByRole("link", { name: "Imprint" });
    const site = screen.getByRole("link", { name: "anyplot.ai" });
    expect(palette).toHaveAttribute("href", ANYPLOT_PALETTE_URL);
    expect(site).toHaveAttribute("href", ANYPLOT_URL);
    for (const link of [palette, site]) {
      expect(link).toHaveAttribute("target", "_blank");
      expect(link.getAttribute("rel")).toBe("noopener");
    }
    expect(document.getElementById("credits")).toHaveTextContent(/anyplot\.ai against deuteranopia/);
  });

  it("disclaims as a private, non-commercial project, not as a beta", async () => {
    renderWithProviders(<ImprintPage />);
    expect(await screen.findByText(en.legal.impressum.disclaimer.body)).toBeInTheDocument();
  });

  it("has no beta notice and no link to terms the site does not have", async () => {
    renderWithProviders(<ImprintPage />);
    await screen.findAllByText(new RegExp(OPERATOR.name));
    expect(screen.queryByText(/beta/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /terms/i })).not.toBeInTheDocument();
  });
});

describe("the privacy policy", () => {
  it("lists exactly what the browser keeps, and the site's own closing line", async () => {
    renderWithProviders(<PrivacyPage />);
    for (const entry of Object.values(P.browser.entries)) {
      expect(await screen.findByText(entry)).toBeInTheDocument();
    }
    expect(screen.getByText(P.browser.tail)).toBeInTheDocument();
  });

  it("says what the site processes, who hosts it, how long it is kept, and how an account is taken away", async () => {
    renderWithProviders(<PrivacyPage />);
    for (const key of ["data", "third_parties", "transfers", "retention"] as const) {
      // The kit numbers a page's sections: "2. What data we process".
      expect(await screen.findByRole("heading", { name: new RegExp(`${P[key].title}$`) })).toBeInTheDocument();
    }
    expect(screen.getByText(P.legal_basis.site)).toBeInTheDocument();
    expect(screen.getByText(P.rights.site)).toBeInTheDocument();
  });

  // The accounts (plan, second stage): what the policy must say about them, each a promise
  // the backend keeps — the exhibits without one, the sealed second factor, the mail's
  // processor, the 30 days the daily call prunes after, the erasure that anonymises
  // feedback and removes its files (accounts.py, feedback.py).
  it("says the exhibits need no account and what an account keeps, for how long", () => {
    expect(P.data.body).toMatch(/^The exhibits need no account\./);
    expect(P.data.body).toMatch(/only by invitation/);
    expect(P.data.body).toMatch(/two-factor sign-in.*encrypted.*not in the database/);
    expect(P.third_parties.body).toMatch(/Resend/);
    expect(P.transfers.body).toMatch(/Resend/);
    expect(P.retention.body).toMatch(/deleted 30 days after they ended/);
    expect(P.retention.body).toMatch(/anonymised.*files only you attached are deleted/);
    // The daily call erases 30 days after the request (DeletionMode.AFTER_DAYS), and the
    // shared instance's backups keep a copy for seven days (server-kit's BACKUP_RETENTION_DAYS).
    expect(P.retention.body).toMatch(/30 days after the request it is deleted for good, automatically/);
    expect(P.retention.body).toMatch(/Backups of the database still hold the deleted data for up to 7 days/);
    expect(P.data.body).not.toMatch(/no accounts|no database/);
  });

  it("names the account's session in the kit's words, and no report waiting to be sent", async () => {
    renderWithProviders(<PrivacyPage />);
    await screen.findByText(P.browser.tail);
    const text = document.body.textContent ?? "";
    expect(text).toMatch(/sign(ing)? out/i);
    expect(text).not.toMatch(/waiting to be sent/i);
    expect(screen.queryByText(/beta/i)).not.toBeInTheDocument();
  });
});

describe("the routes", () => {
  // `EXHIBITS` names each exhibit's path, and the link pages, the overview and
  // the daily pick all follow it; the routes are written apart from it, and a
  // path without its route would ship a 404 behind a share card.
  it.each(EXHIBITS.map((entry) => [entry.path, entry.exhibit] as const))(
    "opens %s on its exhibit's page",
    async (path, exhibit) => {
      renderWithProviders(
        <Routes>
          <Route path="*" element={<AppRoutes />} />
        </Routes>,
        { initialEntries: [path] },
      );
      expect(
        await screen.findByRole("heading", { level: 1, name: en.experiments.exhibits[exhibit].title }),
      ).toBeInTheDocument();
    },
  );

  it("answers an address that is no page with the 404, inside the site's frame", async () => {
    renderWithProviders(
      <Routes>
        <Route path="*" element={<AppRoutes />} />
      </Routes>,
      { initialEntries: ["/no-such-exhibit"] },
    );
    expect(await screen.findByRole("link", { name: en.app.name })).toHaveAttribute("href", "/");
    expect(screen.getByText("404")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: S.footer.label })).toBeInTheDocument();
  });
});
