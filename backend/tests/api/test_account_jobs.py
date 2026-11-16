"""The daily call, ``POST /api/v1/ops/accounts/daily``: server-kit's jobs router
with this app's prune, behind the jobs token Cloud Scheduler sends.

The rows it deletes keep a person's address and browser for as long as they
stay, so the privacy policy names 30 days; this holds the route to it: a
session ended 31 days ago goes, one ended yesterday stays, and nobody without
the token starts it."""

from __future__ import annotations

from collections.abc import AsyncIterator
from datetime import timedelta

import pytest
from eifi1_server_kit.auth.ports import NewAccount, NewSession
from eifi1_server_kit.auth.sql import SqlSessionStore, SqlUserStore
from eifi1_server_kit.clock import utc_now
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from staunlabor.models import User, UserSession
from staunlabor.settings import get_settings
from tests.conftest import FIRST_ADMIN

pytestmark = pytest.mark.api

DAILY = "/api/v1/ops/accounts/daily"
TOKEN = "a-jobs-token-for-the-tests-only-0123456789"


@pytest.fixture
async def jobs(database: str, monkeypatch: pytest.MonkeyPatch) -> AsyncIterator[AsyncClient]:
    """The app with a jobs token set, on this test's empty database."""
    from staunlabor.main import create_app

    monkeypatch.setenv("STAUNLABOR_REGISTRATION_ALLOWLIST", FIRST_ADMIN)
    monkeypatch.setenv("STAUNLABOR_JOBS_TOKEN", TOKEN)
    get_settings.cache_clear()
    app = create_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        yield client
    await app.state.database.dispose()


async def _two_ended_sessions(session: AsyncSession) -> None:
    ada = await SqlUserStore(session, User).add(
        NewAccount(email=FIRST_ADMIN, password_hash="x", first_name="Ada", last_name="", locale="en", role="ADMIN")
    )
    store = SqlSessionStore(session, UserSession)
    now = utc_now()
    for sid, days in (("old", 31), ("recent", 1)):
        row = await store.start(
            NewSession(sid=sid, user_id=ada.id, started_at=now - timedelta(days=days), expires_at=now + timedelta(1))
        )
        await store.touch(row, last_active=now - timedelta(days=days), expires_at=now + timedelta(days=1))
        await store.end(row)
    await session.commit()


async def test_the_daily_call_deletes_a_session_ended_more_than_thirty_days_ago(
    jobs: AsyncClient, session: AsyncSession
) -> None:
    await _two_ended_sessions(session)
    answer = await jobs.post(DAILY, headers={"X-Jobs-Token": TOKEN})
    assert answer.status_code == 200, answer.text
    assert answer.json()["prune"]["sessions"] == 1
    store = SqlSessionStore(session, UserSession)
    session.expunge_all()
    assert await store.get("old") is None
    assert await store.get("recent") is not None


@pytest.mark.parametrize("headers", [{}, {"X-Jobs-Token": "a-guess"}])
async def test_nobody_without_the_jobs_token_starts_the_daily_call(
    jobs: AsyncClient, session: AsyncSession, headers: dict[str, str]
) -> None:
    await _two_ended_sessions(session)
    answer = await jobs.post(DAILY, headers=headers)
    assert answer.status_code in (401, 403), answer.text
    session.expunge_all()
    assert await SqlSessionStore(session, UserSession).get("old") is not None
