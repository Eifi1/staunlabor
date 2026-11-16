"""The first admin made from the operator's terminal (``staunlabor.bootstrap``): the
account the site's sign-in takes, and with it the first-admin registration closed, so
that nobody who types the allow-listed address first can claim the site."""

from __future__ import annotations

import asyncio
from collections.abc import Iterator

import pytest
from httpx import AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from staunlabor import bootstrap
from staunlabor.bootstrap import FirstAdmin, ask, make_first_admin
from staunlabor.database import Database
from staunlabor.models import User
from staunlabor.settings import get_settings
from tests.conftest import FIRST_ADMIN

pytestmark = pytest.mark.api

API = "/api/v1"
PASSWORD = "a long enough password, 2026"
ADMIN = FirstAdmin(email=FIRST_ADMIN, password=PASSWORD, first_name="Ada", last_name="Lovelace")


async def _make(admin: FirstAdmin = ADMIN) -> bool:
    settings = get_settings()
    database = Database(settings)
    try:
        return await make_first_admin(database, settings, admin)
    finally:
        await database.dispose()


async def test_the_admin_made_beforehand_signs_in_and_the_allow_listed_address_can_no_longer_claim_the_site(
    accounts: AsyncClient, session: AsyncSession
):
    assert await _make() is True
    row = await session.scalar(select(User).where(User.email == FIRST_ADMIN))
    assert row is not None and row.role == "ADMIN" and row.is_active
    assert row.email_verified_at is None and row.device_timezone == "Europe/Zurich"
    assert row.password_hash.startswith("$2b$") and PASSWORD not in row.password_hash
    signed_in = await accounts.post(f"{API}/auth/login", json={"email": FIRST_ADMIN, "password": PASSWORD})
    assert signed_in.status_code == 200 and signed_in.json()["user"]["role"] == "ADMIN"
    # The address on the allow-list, typed by anybody: the first-admin path is closed.
    claim = await accounts.post(
        f"{API}/auth/register",
        json={"email": FIRST_ADMIN, "password": "another long password", "first_name": "X", "last_name": "Y"},
    )
    assert claim.status_code == 403 and claim.json()["code"] == "registration_closed"


async def test_it_writes_nothing_once_any_account_exists(database: str, session: AsyncSession):
    assert await _make() is True
    other = FirstAdmin(email="grace@example.com", password=PASSWORD, first_name="Grace", last_name="Hopper")
    assert await _make(other) is False
    assert await session.scalar(select(func.count()).select_from(User)) == 1


def _answers(*lines: str) -> Iterator[str]:
    return iter(lines)


def test_the_terminal_asks_for_the_password_twice_and_never_says_it(capsys: pytest.CaptureFixture[str]):
    plain = _answers(" ada@example.com ", "Ada", "Lovelace")
    hidden = _answers(PASSWORD, PASSWORD)
    admin = ask(lambda _prompt: next(plain), lambda _prompt: next(hidden))
    assert admin == ADMIN
    differing = _answers(PASSWORD, "something else entirely")
    plain = _answers("ada@example.com", "Ada", "Lovelace")
    assert ask(lambda _prompt: next(plain), lambda _prompt: next(differing)) is None
    assert "differ" in capsys.readouterr().out


def test_an_account_the_site_would_refuse_is_named_by_its_field_never_its_value(capsys: pytest.CaptureFixture[str]):
    short = "short"
    plain = _answers("not an address", "Ada", "")
    hidden = _answers(short, short)
    assert ask(lambda _prompt: next(plain), lambda _prompt: next(hidden)) is None
    said = capsys.readouterr().out
    assert "email" in said and "password" in said and "last_name" in said and "nothing done" in said
    assert short not in said.replace("too short", "") and "not an address" not in said


async def test_the_command_says_what_it_did_and_fails_when_there_is_nothing_to_do(
    database: str, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
):
    monkeypatch.setattr(bootstrap, "ask", lambda: ADMIN)
    # main runs its own event loop, as from the command line: off this test's.
    loop = asyncio.get_running_loop()
    assert await loop.run_in_executor(None, bootstrap.main) == 0
    assert f"Done: {FIRST_ADMIN} is the admin" in capsys.readouterr().out
    assert await loop.run_in_executor(None, bootstrap.main) == 1
    assert "accounts already" in capsys.readouterr().out
    monkeypatch.setattr(bootstrap, "ask", lambda: None)
    assert await loop.run_in_executor(None, bootstrap.main) == 1
