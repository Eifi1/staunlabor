/**
 * The account's settings as the site wires them. The kit tests its sections; this holds the
 * site's choice: two-factor sign-in offered to every account, off until the person sets it up.
 */
import { afterEach, describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { renderSignedIn } from "@/test/accounts";
import { SettingsPage } from "./settings-page";

const member = {
  id: 7,
  email: "ben@example.com",
  first_name: "Ben",
  last_name: "Example",
  role: "MEMBER",
  totp_enabled: false,
};

afterEach(() => localStorage.clear());

describe("the settings page", () => {
  it("offers every account two-factor sign-in, off until the person sets it up", async () => {
    renderSignedIn(<SettingsPage />, { user: member, routes: { "get /auth/sessions": [], "get /auth/passkeys": [] } });
    expect(await screen.findByRole("button", { name: "Set up two-factor authentication" })).toBeInTheDocument();
    expect(screen.getByText("Off")).toBeInTheDocument();
  });

  it("shows it on for an account that switched it on", async () => {
    renderSignedIn(<SettingsPage />, {
      user: { ...member, totp_enabled: true },
      routes: {
        "get /auth/sessions": [],
        "get /auth/passkeys": [],
        "get /auth/me/2fa": { enabled: true, backup_codes_left: 10 },
      },
    });
    expect(await screen.findByText("On")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Set up two-factor authentication" })).not.toBeInTheDocument();
  });
});
