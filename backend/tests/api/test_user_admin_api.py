"""The admin's routes as the site mounts them: server-kit 0.30's ``user_admin_router``
on this app's tables, scope, roles, languages and areas, behind the kit's admin guard and
the address budget, over HTTP against PostgreSQL.

The kit tests every rule on its in-memory stores; these test what this site chose and
what only its database shows: the roster's paging and search on PostgreSQL, a role change
that makes an admin (never a reviewer, who comes with languages), the reviewer's seven
languages and two areas, a deactivation, a forced password change and the two mails
reaching the person, the second factor's reset for a lost authenticator, the daily call's
erasure 30 days after a request leaving no address behind (and an admin's reactivation
keeping the account), the log, the overview and the test mail, and that nobody else
reaches any of it.

Not reachable here, so not tested: ``last_admin`` on a role change or a deactivation. In
the global scope the acting admin is an active admin besides the target, so the target is
never the last one, and taking your own role or account is ``self_action`` first. The
refusal is reached by the last admin's own deletion request instead.
"""

from __future__ import annotations

import json
from typing import Any
from urllib.parse import parse_qs, urlsplit

import pytest
from httpx import AsyncClient, Response
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from staunlabor.models import AdminAction, Invitation, User, UserSession
from tests.api.test_accounts_api import (
    API,
    PASSWORD,
    bearer,
    code,
    erase_due,
    first_admin,
    invite,
    invite_token,
    register,
    sign_in,
    switch_on_two_factor,
)
from tests.conftest import FIRST_ADMIN

pytestmark = pytest.mark.api

NEW_PASSWORD = "a brand new horse battery staple"


async def join(
    client: AsyncClient, admin_token: str, email: str, role: str = "MEMBER", **person: str
) -> dict[str, Any]:
    """An account made through an invitation the admin sends, signed in."""
    token = invite_token(await invite(client, admin_token, email, role))
    response = await register(client, email, invite_token=token, **person)
    assert response.status_code == 201, response.text
    return response.json()


async def staffed(client: AsyncClient) -> tuple[dict[str, Any], dict[str, dict[str, Any]]]:
    """The first admin (Ada Lovelace) and three people she invited: Grace Hopper, a
    reviewer, and two members, Bob Babbage and Cy Lovelace."""
    admin = await first_admin(client)
    token = admin["access_token"]
    people = {
        "grace": await join(client, token, "grace@example.com", "REVIEWER", first_name="Grace", last_name="Hopper"),
        "bob": await join(client, token, "bob@example.com", first_name="Bob", last_name="Babbage"),
        "cy": await join(client, token, "cy@example.com", first_name="Cy", last_name="Lovelace"),
    }
    return admin, people


def uid(person: dict[str, Any]) -> int:
    return person["user"]["id"]


def link_token(answer: Response) -> str:
    """The token in the link an admin's answer carries while mail goes to the console."""
    return parse_qs(urlsplit(answer.json()["link"]).query)["token"][0]


async def actions_on(client: AsyncClient, admin_token: str, user_id: int) -> list[tuple[str, Any]]:
    response = await client.get(f"{API}/admin/actions", params={"target": user_id}, headers=bearer(admin_token))
    assert response.status_code == 200, response.text
    return [(row["action"], row["detail"]) for row in response.json()["actions"]]


# ── The roster ───────────────────────────────────────────────────────────────


async def test_the_roster_pages_searches_and_filters_the_people(accounts: AsyncClient):
    admin, _ = await staffed(accounts)
    token = admin["access_token"]

    async def roster(**params: Any) -> dict[str, Any]:
        response = await accounts.get(f"{API}/admin/users", params=params, headers=bearer(token))
        assert response.status_code == 200, response.text
        return response.json()

    first, second = await roster(limit=2, sort="email"), await roster(limit=2, offset=2, sort="email")
    emails = [row["email"] for row in first["users"] + second["users"]]
    assert emails == [FIRST_ADMIN, "bob@example.com", "cy@example.com", "grace@example.com"]
    assert first["total"] == second["total"] == 4
    assert first["mail_backend"] == "console" and first["summary"] == {"active_admins": 1}
    # The levels the page asks before it sends; no erasure among them, the job erases.
    assert first["levels"]["deactivate"] == "type_email" and "erase" not in first["levels"]
    assert first["levels"]["role"] == "acknowledge"
    assert all("device_timezone" not in row for row in first["users"])

    lovelaces = await roster(q="LOVELACE", sort="name")
    assert [row["email"] for row in lovelaces["users"]] == [FIRST_ADMIN, "cy@example.com"]
    assert [row["email"] for row in (await roster(q="Hopper Grace"))["users"]] == ["grace@example.com"]
    assert [row["email"] for row in (await roster(role="REVIEWER"))["users"]] == ["grace@example.com"]
    # Only the first admin came in without an invitation, the address unproved.
    assert [row["email"] for row in (await roster(state="unverified"))["users"]] == [FIRST_ADMIN]
    for params in ({"sort": "shoe_size"}, {"role": "OWNER"}, {"state": "asleep"}, {"limit": 0}):
        refused = await accounts.get(f"{API}/admin/users", params=params, headers=bearer(token))
        assert refused.status_code == 422, params


# ── The role ─────────────────────────────────────────────────────────────────


async def test_a_role_change_makes_an_admin_acknowledged_and_logged_but_never_a_reviewer(accounts: AsyncClient):
    admin, people = await staffed(accounts)
    token, bob = admin["access_token"], uid(people["bob"])
    path = f"{API}/admin/users/{bob}/role"

    unconfirmed = await accounts.post(path, json={"role": "ADMIN"}, headers=bearer(token))
    assert unconfirmed.status_code == 409 and code(unconfirmed) == "confirmation_required"
    # The reviewer comes with languages (/reviewer), and no role the site lacks comes at all.
    for role in ("REVIEWER", "OWNER"):
        refused = await accounts.post(path, json={"role": role, "acknowledged": True}, headers=bearer(token))
        assert refused.status_code == 422 and code(refused) == "role_not_grantable", role

    made = await accounts.post(path, json={"role": "ADMIN", "acknowledged": True}, headers=bearer(token))
    assert made.status_code == 200 and made.json()["role"] == "ADMIN"
    # The sessions stay: the guard reads the row, so Bob's own token is an admin's now.
    as_bob = await accounts.get(f"{API}/admin/users", headers=bearer(people["bob"]["access_token"]))
    assert as_bob.status_code == 200 and as_bob.json()["summary"] == {"active_admins": 2}
    # With two admins, either takes the other's role back.
    back = await accounts.post(path, json={"role": "MEMBER", "acknowledged": True}, headers=bearer(token))
    assert back.status_code == 200 and back.json()["role"] == "MEMBER"
    assert await actions_on(accounts, token, bob) == [
        ("role", {"from": "ADMIN", "to": "MEMBER"}),
        ("role", {"from": "MEMBER", "to": "ADMIN"}),
    ]


async def test_the_last_admin_can_neither_give_up_the_role_nor_the_account(accounts: AsyncClient):
    admin = await first_admin(accounts)
    token, me = admin["access_token"], uid(admin)
    demoted = await accounts.post(
        f"{API}/admin/users/{me}/role", json={"role": "MEMBER", "acknowledged": True}, headers=bearer(token)
    )
    assert demoted.status_code == 409 and code(demoted) == "self_action"
    switched_off = await accounts.post(
        f"{API}/admin/users/{me}/active", json={"active": False, "confirm_email": FIRST_ADMIN}, headers=bearer(token)
    )
    assert switched_off.status_code == 409 and code(switched_off) == "self_action"
    leaving = await accounts.post(
        f"{API}/auth/me/deletion", json={"password": PASSWORD, "confirm_email": FIRST_ADMIN}, headers=bearer(token)
    )
    assert leaving.status_code == 409 and code(leaving) == "last_admin"


# ── The reviewer ─────────────────────────────────────────────────────────────


async def test_a_reviewer_is_given_the_site_s_languages_and_areas_and_made_a_member_again(accounts: AsyncClient):
    admin, people = await staffed(accounts)
    token, bob = admin["access_token"], uid(people["bob"])
    path = f"{API}/admin/users/{bob}/reviewer"

    given = await accounts.put(path, json={"locales": ["it", "FR"], "areas": ["legal"]}, headers=bearer(token))
    assert given.status_code == 200
    assert given.json() == {"user_id": bob, "role": "REVIEWER", "locales": ["fr", "it"], "areas": ["legal"]}
    for body in ({"locales": ["pt"]}, {"locales": ["de"]}, {"locales": ["fr"], "areas": ["site"]}):
        refused = await accounts.put(path, json=body, headers=bearer(token))
        assert refused.status_code == 422, body
    every = await accounts.put(
        path,
        json={"locales": ["zh", "hu", "it", "fr", "es", "en", "de-CH"], "areas": ["experiments"]},
        headers=bearer(token),
    )
    assert every.json()["locales"] == ["de-CH", "en", "es", "fr", "it", "hu", "zh"]
    assert every.json()["areas"] == ["experiments"]

    taken = await accounts.put(path, json={"locales": []}, headers=bearer(token))
    assert taken.json() == {"user_id": bob, "role": "MEMBER", "locales": [], "areas": None}
    on_the_admin = await accounts.put(
        f"{API}/admin/users/{uid(admin)}/reviewer", json={"locales": ["fr"]}, headers=bearer(token)
    )
    assert on_the_admin.status_code == 409 and code(on_the_admin) == "reviewer_is_admin"
    assert [action for action, _ in await actions_on(accounts, token, bob)] == ["reviewer"] * 3


# ── Deactivating, the forced password change ─────────────────────────────────


async def test_a_deactivated_account_is_signed_out_everywhere_until_it_is_reactivated(accounts: AsyncClient):
    admin, people = await staffed(accounts)
    token, bob = admin["access_token"], uid(people["bob"])
    path = f"{API}/admin/users/{bob}/active"

    for typed, refusal in ((None, "confirmation_required"), ("cy@example.com", "confirmation_mismatch")):
        body: dict[str, Any] = {"active": False} | ({"confirm_email": typed} if typed else {})
        refused = await accounts.post(path, json=body, headers=bearer(token))
        assert refused.status_code == 409 and code(refused) == refusal
    off = await accounts.post(path, json={"active": False, "confirm_email": "Bob@Example.com"}, headers=bearer(token))
    assert off.status_code == 200 and off.json()["is_active"] is False
    me = await accounts.get(f"{API}/auth/me", headers=bearer(people["bob"]["access_token"]))
    assert me.status_code == 401 and code(me) == "session_ended"
    assert code(await sign_in(accounts, "bob@example.com")) == "invalid_credentials"

    on = await accounts.post(path, json={"active": True}, headers=bearer(token))
    assert on.status_code == 200 and on.json()["is_active"] is True
    assert (await sign_in(accounts, "bob@example.com")).status_code == 200
    assert await actions_on(accounts, token, bob) == [("reactivate", {}), ("deactivate", {"sessions_ended": True})]


async def test_a_forced_password_change_ends_the_sessions_and_the_next_sign_in_sets_one(accounts: AsyncClient):
    admin, people = await staffed(accounts)
    token, bob, cy = admin["access_token"], uid(people["bob"]), uid(people["cy"])
    path = f"{API}/admin/users/{bob}/password-change"

    # A body a proxy dropped is no acknowledgement: the action fails closed.
    dropped = await accounts.post(path, headers=bearer(token))
    assert dropped.status_code == 409 and code(dropped) == "confirmation_required"
    required = await accounts.post(path, json={"acknowledged": True}, headers=bearer(token))
    assert required.status_code == 200 and required.json()["password_change_required_at"] is not None
    me = await accounts.get(f"{API}/auth/me", headers=bearer(people["bob"]["access_token"]))
    assert me.status_code == 401 and code(me) == "session_ended"

    challenge = (await sign_in(accounts, "bob@example.com")).json()
    assert challenge["requires_password_change"] is True and "access_token" not in challenge
    chosen = await accounts.post(
        f"{API}/auth/login/set-password",
        json={"challenge_token": challenge["challenge_token"], "new_password": NEW_PASSWORD},
    )
    assert chosen.status_code == 200 and chosen.json()["user"]["email"] == "bob@example.com"
    assert "access_token" in (await sign_in(accounts, "bob@example.com", NEW_PASSWORD)).json()

    # Withdrawn before the next sign-in, the old password signs in as before.
    cy_path = f"{API}/admin/users/{cy}/password-change"
    assert (await accounts.post(cy_path, json={"acknowledged": True}, headers=bearer(token))).status_code == 200
    withdrawn = await accounts.delete(cy_path, headers=bearer(token))
    assert withdrawn.status_code == 200 and withdrawn.json()["password_change_required_at"] is None
    assert "access_token" in (await sign_in(accounts, "cy@example.com")).json()
    assert [action for action, _ in await actions_on(accounts, token, cy)] == [
        "password_change_withdraw",
        "password_change_require",
    ]


# ── The second factor's reset ────────────────────────────────────────────────


async def test_the_admin_switches_off_a_lost_second_factor_acknowledged_logged_and_never_their_own(
    accounts: AsyncClient,
):
    admin, people = await staffed(accounts)
    token, bob = admin["access_token"], uid(people["bob"])
    await switch_on_two_factor(accounts, people["bob"]["access_token"])
    assert (await sign_in(accounts, "bob@example.com")).json()["requires_2fa"] is True
    roster = await accounts.get(f"{API}/admin/users", params={"q": "Babbage"}, headers=bearer(token))
    assert [row["totp_enabled"] for row in roster.json()["users"]] == [True]

    path = f"{API}/admin/users/{bob}/two-factor-reset"
    dropped = await accounts.post(path, headers=bearer(token))
    assert dropped.status_code == 409 and code(dropped) == "confirmation_required"
    reset = await accounts.post(path, json={"acknowledged": True}, headers=bearer(token))
    assert reset.status_code == 200 and reset.json()["totp_enabled"] is False
    # Bob signs in by his password alone again, and may switch it on anew.
    assert "access_token" in (await sign_in(accounts, "bob@example.com")).json()
    assert [action for action, _ in await actions_on(accounts, token, bob)] == ["two_factor_reset"]

    own = await accounts.post(
        f"{API}/admin/users/{uid(admin)}/two-factor-reset", json={"acknowledged": True}, headers=bearer(token)
    )
    assert own.status_code == 409 and code(own) == "self_action"


# ── The two mails ────────────────────────────────────────────────────────────


async def test_the_admin_s_two_mails_carry_their_link_once_while_mail_goes_to_the_console(accounts: AsyncClient):
    admin, people = await staffed(accounts)
    token, me, bob, cy = admin["access_token"], uid(admin), uid(people["bob"]), uid(people["cy"])

    # The first admin came in through the allow-list, the address unproved.
    verification = await accounts.post(
        f"{API}/admin/users/{me}/mail", json={"kind": "verification"}, headers=bearer(token)
    )
    assert verification.status_code == 200
    assert verification.json()["sent"] is True and verification.json()["mail_backend"] == "console"
    assert urlsplit(verification.json()["link"]).path == "/verify-email"
    verified = await accounts.post(f"{API}/auth/verify-email", json={"token": link_token(verification)})
    assert verified.status_code == 200 and verified.json()["email_verified"] is True
    again = await accounts.post(f"{API}/admin/users/{me}/mail", json={"kind": "verification"}, headers=bearer(token))
    assert again.status_code == 409 and code(again) == "email_already_verified"

    reset = await accounts.post(f"{API}/admin/users/{bob}/mail", json={"kind": "password_reset"}, headers=bearer(token))
    assert reset.status_code == 200 and urlsplit(reset.json()["link"]).path == "/reset-password"
    confirmed = await accounts.post(
        f"{API}/auth/password-reset/confirm", json={"token": link_token(reset), "new_password": NEW_PASSWORD}
    )
    assert confirmed.status_code == 200
    assert "access_token" in (await sign_in(accounts, "bob@example.com", NEW_PASSWORD)).json()
    assert await actions_on(accounts, token, bob) == [("mail_reset", {"sent": True})]

    # A deactivated account has nothing to sign in to.
    await accounts.post(
        f"{API}/admin/users/{cy}/active",
        json={"active": False, "confirm_email": "cy@example.com"},
        headers=bearer(token),
    )
    inactive = await accounts.post(
        f"{API}/admin/users/{cy}/mail", json={"kind": "password_reset"}, headers=bearer(token)
    )
    assert inactive.status_code == 409 and code(inactive) == "account_inactive"


# ── The erasure ──────────────────────────────────────────────────────────────


async def test_the_daily_call_erases_an_account_thirty_days_after_it_asked_unless_an_admin_kept_it(
    accounts: AsyncClient, session: AsyncSession
):
    admin, people = await staffed(accounts)
    token, bob, cy = admin["access_token"], uid(people["bob"]), uid(people["cy"])
    for who, email in (("bob", "bob@example.com"), ("cy", "cy@example.com")):
        asked = await accounts.post(
            f"{API}/auth/me/deletion",
            json={"password": PASSWORD, "confirm_email": email},
            headers=bearer(people[who]["access_token"]),
        )
        assert asked.status_code == 202, asked.text
    # Deactivated at once, its day 30 days on; no admin erases by hand.
    row = await session.get(User, bob)
    assert row is not None and not row.is_active and row.deletion_scheduled_at is not None
    assert (row.deletion_scheduled_at - row.deletion_requested_at).days == 30
    by_hand = await accounts.post(
        f"{API}/admin/users/{bob}/erase", json={"confirm_email": "bob@example.com"}, headers=bearer(token)
    )
    assert by_hand.status_code in (404, 405)
    # Cy changed her mind, and the admin reactivated her before the day.
    kept = await accounts.post(f"{API}/admin/users/{cy}/active", json={"active": True}, headers=bearer(token))
    assert kept.status_code == 200, kept.text
    session.expunge_all()

    run = await erase_due(accounts, session, bob, cy)
    assert run["erased"] == [bob] and run["failed"] == []
    assert await session.get(User, bob) is None
    assert await session.get(User, cy) is not None
    assert await session.scalar(select(func.count()).select_from(UserSession).where(UserSession.user_id == bob)) == 0
    # The invitation Bob accepted is gone with him; the two others' stay.
    invited = await session.scalars(select(Invitation.email).order_by(Invitation.email))
    assert list(invited) == ["cy@example.com", "grace@example.com"]
    # The log keeps its rows and no trace of the address; the job erased, nobody by hand.
    rows = list(await session.scalars(select(AdminAction).order_by(AdminAction.id)))
    assert all("bob@" not in json.dumps([row.target_email, row.detail]) for row in rows)
    assert [(row.action, row.actor_id, row.target_user_id) for row in rows][-1] == ("erase", None, None)
    # Run again, nothing more is due.
    assert (await erase_due(accounts, session))["erased"] == []


# ── The log, the overview, the mail ──────────────────────────────────────────


async def test_the_log_pages_newest_first_and_names_the_people_in_it(accounts: AsyncClient):
    admin, people = await staffed(accounts)
    token, cy = admin["access_token"], uid(people["cy"])
    await accounts.post(f"{API}/admin/users/{cy}/password-change", json={"acknowledged": True}, headers=bearer(token))

    newest = (await accounts.get(f"{API}/admin/actions", params={"limit": 2}, headers=bearer(token))).json()
    rest = (await accounts.get(f"{API}/admin/actions", params={"offset": 2}, headers=bearer(token))).json()
    assert newest["total"] == rest["total"] == 4
    assert [row["action"] for row in newest["actions"] + rest["actions"]] == ["password_change_require"] + [
        "invite"
    ] * 3
    latest = newest["actions"][0]
    assert latest["actor"] | {"id": None} == {
        "id": None,
        "email": FIRST_ADMIN,
        "first_name": "Ada",
        "last_name": "Lovelace",
    }
    assert latest["target"]["email"] == "cy@example.com" and latest["target_user_id"] == cy
    for params in ({"limit": 0}, {"offset": -1}):
        refused = await accounts.get(f"{API}/admin/actions", params=params, headers=bearer(token))
        assert refused.status_code == 422, params


async def test_the_overview_counts_the_people_the_new_ones_and_the_open_invitations(accounts: AsyncClient):
    admin, _ = await staffed(accounts)
    await invite(accounts, admin["access_token"], "dee@example.com")
    overview = await accounts.get(f"{API}/admin/attention", headers=bearer(admin["access_token"]))
    assert overview.status_code == 200
    assert overview.json() == {
        # No report filed, so none waits; the job erases, so the kit counts no requests.
        "feedback_waiting": 0,
        "deletion_requests": None,
        "invitations_pending": 1,
        "users_total": 4,
        "users_new_7d": 4,
        "extra": {},
    }


async def test_the_test_mail_goes_to_the_admin_three_times_in_ten_minutes(accounts: AsyncClient):
    admin = await first_admin(accounts)
    headers = bearer(admin["access_token"])
    assert (await accounts.get(f"{API}/admin/mail", headers=headers)).json() == {"mail_backend": "console"}
    for _ in range(3):
        sent = await accounts.post(f"{API}/admin/mail/test", headers=headers)
        assert sent.status_code == 200 and sent.json() == {"sent": True, "mail_backend": "console"}
    fourth = await accounts.post(f"{API}/admin/mail/test", headers=headers)
    assert fourth.status_code == 429 and int(fourth.headers["retry-after"]) > 0


# ── Who reaches it ───────────────────────────────────────────────────────────

#: Every route of the admin's router, each with an id that exists (the first admin's).
ADMIN_ROUTES = (
    ("GET", "/admin/users"),
    ("POST", "/admin/users/1/active"),
    ("POST", "/admin/users/1/role"),
    ("POST", "/admin/users/1/password-change"),
    ("DELETE", "/admin/users/1/password-change"),
    ("POST", "/admin/users/1/mail"),
    ("PUT", "/admin/users/1/reviewer"),
    ("GET", "/admin/actions"),
    ("GET", "/admin/attention"),
    ("GET", "/admin/mail"),
    ("POST", "/admin/mail/test"),
)


async def test_only_an_admin_reaches_the_admin_s_routes(accounts: AsyncClient):
    _, people = await staffed(accounts)
    for who in ("grace", "bob"):
        for method, path in ADMIN_ROUTES:
            headers = bearer(people[who]["access_token"])
            refused = await accounts.request(method, f"{API}{path}", json={}, headers=headers)
            assert refused.status_code == 403 and code(refused) == "admin_required", (who, method, path)
    for method, path in ADMIN_ROUTES:
        anonymous = await accounts.request(method, f"{API}{path}", json={})
        assert anonymous.status_code == 401 and code(anonymous) == "not_signed_in", (method, path)


async def test_an_account_nobody_has_is_not_found_on_every_action(accounts: AsyncClient):
    admin = await first_admin(accounts)
    headers = bearer(admin["access_token"])
    for method, path, body in (
        ("POST", "/admin/users/999/role", {"role": "ADMIN", "acknowledged": True}),
        ("POST", "/admin/users/999/active", {"active": False, "confirm_email": "x@example.com"}),
        ("PUT", "/admin/users/999/reviewer", {"locales": ["fr"]}),
        ("POST", "/admin/users/999/mail", {"kind": "password_reset"}),
    ):
        missing = await accounts.request(method, f"{API}{path}", json=body, headers=headers)
        assert missing.status_code == 404 and code(missing) == "user_not_found", path
