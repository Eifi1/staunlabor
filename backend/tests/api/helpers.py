"""What the API tests share: the HTTP steps of an account's life (signing up, the
first admin, an invitation and its acceptance, a sign-in, the second factor switched
on, the daily call's erasure), and an account seeded straight into the database for
the stores' contract suites.

A module of its own, not a test module: a test module imported by another drags its
tests' assumptions along, and the helpers lived in two of them."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any
from urllib.parse import parse_qs, urlsplit

from eifi1_server_kit.auth.ports import NewAccount
from eifi1_server_kit.auth.sql import SqlUserStore
from eifi1_server_kit.auth.testing import totp_code
from httpx import AsyncClient, Response
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from staunlabor.models import User
from tests.conftest import FIRST_ADMIN, JOBS_TOKEN

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


async def erase_due(client: AsyncClient, session: AsyncSession, *user_ids: int) -> dict[str, Any]:
    """The daily call's erasure, as if the 30 days since each of ``user_ids`` asked had
    passed: a request still standing moved 31 days back and its day to yesterday (a
    cancelled one stays cancelled), then ``POST /ops/accounts/erase-due``."""
    now = datetime.now(UTC)
    for user_id in user_ids:
        await session.execute(
            update(User)
            .where(User.id == user_id, User.deletion_requested_at.is_not(None))
            .values(deletion_requested_at=now - timedelta(days=31), deletion_scheduled_at=now - timedelta(days=1))
        )
    await session.commit()
    run = await client.post(f"{API}/ops/accounts/erase-due", headers={"X-Jobs-Token": JOBS_TOKEN})
    assert run.status_code == 200, run.text
    session.expunge_all()
    return run.json()


async def switch_on_two_factor(client: AsyncClient, token: str) -> tuple[str, list[str]]:
    """The settings' three steps: the password, the secret for the authenticator,
    a code from it. Answers the secret and the ten backup codes."""
    set_up = await client.post(f"{API}/auth/me/2fa/setup", json={"password": PASSWORD}, headers=bearer(token))
    assert set_up.status_code == 200, set_up.text
    secret = set_up.json()["secret"]
    enabled = await client.post(
        f"{API}/auth/me/2fa/enable",
        json={"code": totp_code(secret, now=datetime.now(UTC))},
        headers=bearer(token),
    )
    assert enabled.status_code == 200, enabled.text
    return secret, enabled.json()["backup_codes"]


async def join(
    client: AsyncClient, admin_token: str, email: str, role: str = "MEMBER", **person: str
) -> dict[str, Any]:
    """An account made through an invitation the admin sends, signed in."""
    token = invite_token(await invite(client, admin_token, email, role))
    response = await register(client, email, invite_token=token, **person)
    assert response.status_code == 201, response.text
    return response.json()


def uid(person: dict[str, Any]) -> int:
    return person["user"]["id"]


async def seed_account(
    session: AsyncSession,
    email: str,
    *,
    role: str = "MEMBER",
    first: str = "Ada",
    last: str = "Lovelace",
    locale: str = "de-CH",
) -> User:
    """An account written straight into the database, no route and no password: for the
    stores' contract suites and the jobs, which need a row and nothing else."""
    new = NewAccount(email=email, password_hash="x", first_name=first, last_name=last, locale=locale, role=role)
    return await SqlUserStore(session, User).add(new)
