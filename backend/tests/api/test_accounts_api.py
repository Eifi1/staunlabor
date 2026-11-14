"""The account routes as the site mounts them: server-kit's ``auth_router`` and
``invitations_admin_router`` on this app's tables, signer, hasher, policy and
budget, over HTTP against PostgreSQL.

The kit tests every route's rules on its in-memory stores; these test what this
app chose: who gets in (the allow-list's first admin, then invitations naming a
member or a reviewer), that a session is a row the tokens name, what a refused
bearer answers, the languages a sign-up, an invitation and a profile may name,
the budget in front of every route, and that the request's unit of work commits
before it answers.
"""

from __future__ import annotations

from typing import Any
from urllib.parse import parse_qs, urlsplit

import jwt
import pytest
from eifi1_server_kit.auth.testing import SoftAuthenticator
from httpx import ASGITransport, AsyncClient, Response
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from staunlabor.models import Invitation, User, UserSession
from staunlabor.security import ACCOUNT_REQUESTS
from tests.conftest import FIRST_ADMIN

pytestmark = pytest.mark.api

API = "/api/v1"
PASSWORD = "correct horse battery staple"
PERSON = {"password": PASSWORD, "first_name": "Ada", "last_name": "Lovelace", "locale": "de-CH"}


def bearer(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def code(response: Response) -> str:
    return response.json()["code"]


async def register(client: AsyncClient, email: str, **extra: Any) -> Response:
    return await client.post(f"{API}/auth/register", json={**PERSON, "email": email, **extra})


async def first_admin(client: AsyncClient) -> dict[str, Any]:
    response = await register(client, FIRST_ADMIN)
    assert response.status_code == 201, response.text
    return response.json()


async def invite(client: AsyncClient, admin_token: str, email: str, role: str = "MEMBER") -> dict[str, Any]:
    response = await client.post(
        f"{API}/admin/invitations", json={"email": email, "role": role, "locale": "fr"}, headers=bearer(admin_token)
    )
    assert response.status_code == 201, response.text
    return response.json()


def invite_token(issued: dict[str, Any]) -> str:
    """The token in the link the admin's answer carries while mail goes to the console."""
    return parse_qs(urlsplit(issued["link"]).query)["invite"][0]


async def invited(client: AsyncClient, email: str, role: str = "MEMBER") -> dict[str, Any]:
    """An account made through an invitation the first admin sends."""
    admin = await first_admin(client)
    token = invite_token(await invite(client, admin["access_token"], email, role))
    response = await register(client, email, invite_token=token)
    assert response.status_code == 201, response.text
    return response.json()


async def sign_in(client: AsyncClient, email: str = FIRST_ADMIN, password: str = PASSWORD) -> Response:
    return await client.post(f"{API}/auth/login", json={"email": email, "password": password})


# ── Who gets in ──────────────────────────────────────────────────────────────


async def test_the_first_account_on_the_allow_list_is_the_admin_and_signed_in(
    accounts: AsyncClient, session: AsyncSession
):
    body = await first_admin(accounts)
    assert body["user"]["email"] == FIRST_ADMIN and body["user"]["role"] == "ADMIN"
    assert body["token_type"] == "bearer"
    sid = jwt.decode(body["access_token"], options={"verify_signature": False})["sid"]
    row = await session.get(UserSession, sid)
    assert row is not None and row.is_active
    stored = await session.scalar(select(User).where(User.email == FIRST_ADMIN))
    assert stored is not None and stored.role == "ADMIN" and stored.password_hash.startswith("$2b$04$")


async def test_an_address_off_the_allow_list_cannot_claim_the_empty_database(accounts: AsyncClient):
    response = await register(accounts, "stranger@example.com")
    assert response.status_code == 403 and code(response) == "registration_closed"


async def test_after_the_first_account_nobody_gets_in_without_an_invitation(accounts: AsyncClient):
    await first_admin(accounts)
    response = await register(accounts, "bob@example.com")
    assert response.status_code == 403 and code(response) == "registration_closed"


async def test_an_invitation_makes_an_account_with_its_role_and_proves_its_address(
    accounts: AsyncClient, session: AsyncSession
):
    admin = await first_admin(accounts)
    issued = await invite(accounts, admin["access_token"], "grace@example.com", "REVIEWER")
    # While mail goes to the console, the answer carries the link, once.
    assert issued["mail_backend"] == "console" and issued["sent"] is True and issued["status"] == "open"
    listed = (await accounts.get(f"{API}/admin/invitations", headers=bearer(admin["access_token"]))).json()
    assert [(row["email"], row["role"], row["link"]) for row in listed] == [("grace@example.com", "REVIEWER", None)]

    token = invite_token(issued)
    check = await accounts.post(f"{API}/auth/invitations/check", json={"token": token})
    assert check.status_code == 200
    assert check.json() | {"expires_at": None} == {
        "email": "grace@example.com",
        "expires_at": None,
        "account_exists": False,
        "role": "REVIEWER",
    }

    response = await register(accounts, "grace@example.com", invite_token=token, first_name="Grace")
    assert response.status_code == 201, response.text
    user = response.json()["user"]
    assert user["role"] == "REVIEWER" and user["email_verified"] is True
    accepted = await session.scalar(select(Invitation).where(Invitation.email == "grace@example.com"))
    assert accepted is not None and accepted.accepted_by_user_id == user["id"]
    # Accepted, it leaves the admin's list; spent, its link opens nothing.
    assert (await accounts.get(f"{API}/admin/invitations", headers=bearer(admin["access_token"]))).json() == []
    again = await register(accounts, "grace2@example.com", invite_token=token)
    assert code(again) == "invitation_invalid"


async def test_an_invitation_names_a_member_or_a_reviewer_and_never_an_admin(accounts: AsyncClient):
    admin = await first_admin(accounts)
    for role in ("ADMIN", "OWNER", "admin", ""):
        response = await accounts.post(
            f"{API}/admin/invitations",
            json={"email": "x@example.com", "role": role, "locale": "en"},
            headers=bearer(admin["access_token"]),
        )
        assert response.status_code == 422, role
        # An empty role is no role at all, the body's refusal; any other is the kit's.
        assert role == "" or code(response) == "role_not_grantable", role
    assert (await accounts.get(f"{API}/admin/invitations", headers=bearer(admin["access_token"]))).json() == []


async def test_a_sign_up_and_an_invitation_name_only_the_site_s_languages(accounts: AsyncClient):
    assert (await register(accounts, FIRST_ADMIN, locale="pt")).status_code == 422
    admin = await first_admin(accounts)

    async def invite_in(locale: str) -> Response:
        body = {"email": "x@example.com", "role": "MEMBER", "locale": locale}
        return await accounts.post(f"{API}/admin/invitations", json=body, headers=bearer(admin["access_token"]))

    assert (await invite_in("pt")).status_code == 422
    issued = await invite_in("de_ch")
    assert issued.status_code == 201 and issued.json()["locale"] == "de-CH"


async def test_only_the_admin_reaches_the_invitations(accounts: AsyncClient):
    member = await invited(accounts, "bob@example.com")
    response = await accounts.get(f"{API}/admin/invitations", headers=bearer(member["access_token"]))
    assert response.status_code == 403 and code(response) == "admin_required"


# ── Sign-in, the session, the account ────────────────────────────────────────


async def test_a_sign_in_answers_a_session_and_every_wrong_one_the_same_refusal(accounts: AsyncClient):
    await first_admin(accounts)
    signed_in = await sign_in(accounts)
    assert signed_in.status_code == 200 and signed_in.json()["user"]["email"] == FIRST_ADMIN
    for email, password in ((FIRST_ADMIN, "wrong password"), ("nobody@example.com", PASSWORD)):
        refused = await sign_in(accounts, email, password)
        assert refused.status_code == 401 and code(refused) == "invalid_credentials"


async def test_a_refresh_renews_the_same_session_with_a_new_pair(accounts: AsyncClient):
    admin = await first_admin(accounts)
    response = await accounts.post(f"{API}/auth/refresh", json={"refresh_token": admin["refresh_token"]})
    assert response.status_code == 200
    renewed = response.json()

    def sid(token: str) -> str:
        return jwt.decode(token, options={"verify_signature": False})["sid"]

    assert sid(renewed["access_token"]) == sid(admin["access_token"]) == sid(renewed["refresh_token"])
    assert (await accounts.get(f"{API}/auth/me", headers=bearer(renewed["access_token"]))).status_code == 200


async def test_me_answers_the_account_and_a_profile_holds_only_the_site_s_languages(accounts: AsyncClient):
    admin = await first_admin(accounts)
    me = await accounts.get(f"{API}/auth/me", headers=bearer(admin["access_token"]))
    assert me.status_code == 200
    assert me.json()["display_name"] == "Ada Lovelace" and me.json()["locale"] == "de-CH"
    patched = await accounts.patch(f"{API}/auth/me", json={"locale": "hu"}, headers=bearer(admin["access_token"]))
    assert patched.status_code == 200 and patched.json()["display_name"] == "Lovelace Ada"
    canonical = await accounts.patch(f"{API}/auth/me", json={"locale": "de"}, headers=bearer(admin["access_token"]))
    assert canonical.json()["locale"] == "de-CH"
    refused = await accounts.patch(f"{API}/auth/me", json={"locale": "pt"}, headers=bearer(admin["access_token"]))
    assert refused.status_code == 422


async def test_signing_out_ends_this_session_and_every_token_that_names_it(accounts: AsyncClient):
    admin = await first_admin(accounts)
    token = admin["access_token"]
    assert (await accounts.delete(f"{API}/auth/sessions/current", headers=bearer(token))).status_code == 204
    me = await accounts.get(f"{API}/auth/me", headers=bearer(token))
    assert me.status_code == 401 and code(me) == "session_ended"
    renewed = await accounts.post(f"{API}/auth/refresh", json={"refresh_token": admin["refresh_token"]})
    assert renewed.status_code == 401 and code(renewed) == "session_ended"
    # Already ended: still 204, so a sign-out that is retried never fails.
    assert (await accounts.delete(f"{API}/auth/sessions/current", headers=bearer(token))).status_code == 204


async def test_the_sessions_list_marks_the_caller_s_own(accounts: AsyncClient):
    admin = await first_admin(accounts)
    other = (await sign_in(accounts)).json()
    listed = await accounts.get(f"{API}/auth/sessions", headers=bearer(other["access_token"]))
    assert listed.status_code == 200
    sessions = listed.json()
    caller = jwt.decode(other["access_token"], options={"verify_signature": False})["sid"]
    first = jwt.decode(admin["access_token"], options={"verify_signature": False})["sid"]
    assert {row["id"] for row in sessions} == {caller, first}
    assert [row["id"] for row in sessions if row["current"]] == [caller]
    # Ending the other device's session from this one.
    ended = await accounts.delete(f"{API}/auth/sessions/{first}", headers=bearer(other["access_token"]))
    assert ended.status_code == 204
    assert (await accounts.get(f"{API}/auth/me", headers=bearer(admin["access_token"]))).status_code == 401


async def test_a_refused_bearer_is_a_401_with_its_code(accounts: AsyncClient):
    admin = await first_admin(accounts)
    claims = jwt.decode(admin["access_token"], options={"verify_signature": False})
    foreign = jwt.encode(claims, "another-app-s-key-of-thirty-two-chars-or-more", algorithm="HS256")
    unsigned = jwt.encode(claims, key=None, algorithm="none")
    for headers in (
        {},
        bearer("not a token"),
        bearer(foreign),
        bearer(unsigned),
        bearer(admin["refresh_token"]),
    ):
        response = await accounts.get(f"{API}/auth/me", headers=headers)
        assert response.status_code == 401 and code(response) == "not_signed_in", headers
        assert response.headers["www-authenticate"] == "Bearer"


# ── Passkeys: the relying party is the site's host ───────────────────────────


async def test_a_passkey_made_on_the_site_signs_in_without_a_password(accounts: AsyncClient):
    admin = await first_admin(accounts)
    device = SoftAuthenticator()
    origin = "http://localhost:5176"
    started = await accounts.post(
        f"{API}/auth/passkey/register/begin",
        json={"current_password": PASSWORD},
        headers=bearer(admin["access_token"]),
    )
    assert started.status_code == 200 and started.json()["options"]["rp"]["id"] == "localhost"
    finished = await accounts.post(
        f"{API}/auth/passkey/register/finish",
        json={
            "challenge_token": started.json()["challenge_token"],
            "credential": device.register(started.json()["options"], origin),
            "name": "Laptop",
        },
        headers=bearer(admin["access_token"]),
    )
    assert finished.status_code == 201, finished.text
    begun = (await accounts.post(f"{API}/auth/passkey/login/begin")).json()
    answer = device.authenticate(begun["options"], origin)
    signed_in = await accounts.post(
        f"{API}/auth/passkey/login/finish", json={"challenge_token": begun["challenge_token"], "credential": answer}
    )
    assert signed_in.status_code == 200, signed_in.text
    assert signed_in.json()["user"]["email"] == FIRST_ADMIN


# ── The budget and the unit of work ──────────────────────────────────────────


async def test_every_account_route_spends_the_address_s_budget_and_the_exhibits_keep_theirs(accounts: AsyncClient):
    # The usernameless passkey begin reads and writes nothing and has no window
    # of the kit's: the budget is all that stands in front of it.
    begun = [
        (await accounts.post(f"{API}/auth/passkey/login/begin")).status_code for _ in range(ACCOUNT_REQUESTS.max_hits)
    ]
    assert begun == [200] * ACCOUNT_REQUESTS.max_hits
    for method, path in (("POST", "/auth/passkey/login/begin"), ("GET", "/auth/me"), ("GET", "/admin/invitations")):
        refused = await accounts.request(method, f"{API}{path}")
        assert refused.status_code == 429, path
        assert "Try again in" in refused.json()["detail"] and int(refused.headers["retry-after"]) > 0
    assert (await accounts.get(f"{API}/experiments/chair")).status_code == 200


async def test_a_commit_that_fails_is_the_answer_s_500_and_writes_nothing(
    accounts: AsyncClient, session: AsyncSession, monkeypatch: pytest.MonkeyPatch
):
    """The unit of work commits before the answer goes out: a failed commit is
    the 500 the person sees, never a 201 for an account that is not there."""

    async def refuse(_self: AsyncSession) -> None:
        raise RuntimeError("the database went away at the commit")

    # As a server answers: the 500 is sent, and the exception goes to its log
    # rather than into the caller (httpx re-raises it by default).
    app = accounts._transport.app  # type: ignore[attr-defined]
    transport = ASGITransport(app=app, raise_app_exceptions=False)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        with monkeypatch.context() as patch:
            patch.setattr(AsyncSession, "commit", refuse)
            response = await register(client, FIRST_ADMIN)
    assert response.status_code == 500 and set(response.json()) == {"detail", "error_id"}
    assert await session.scalar(select(func.count()).select_from(User)) == 0
