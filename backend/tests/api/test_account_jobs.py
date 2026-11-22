"""The daily call, ``POST /api/v1/ops/accounts/daily``: server-kit's jobs router
with this app's prune, behind the jobs token Cloud Scheduler sends.

The rows it deletes keep a person's address and browser for as long as they
stay, so the privacy policy names 30 days; this holds the route to it: a
session ended 31 days ago goes, one ended yesterday stays, and nobody without
the token starts it."""

from __future__ import annotations

from datetime import timedelta

import pytest
from eifi1_server_kit.auth.ports import NewSession
from eifi1_server_kit.auth.sql import SqlSessionStore
from eifi1_server_kit.clock import utc_now
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from staunlabor.models import UserSession
from tests.api.helpers import seed_account
from tests.conftest import FIRST_ADMIN, JOBS_TOKEN

pytestmark = pytest.mark.api

DAILY = "/api/v1/ops/accounts/daily"


async def _two_ended_sessions(session: AsyncSession) -> None:
    ada = await seed_account(session, FIRST_ADMIN, role="ADMIN", last="", locale="en")
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
    accounts: AsyncClient, session: AsyncSession
) -> None:
    await _two_ended_sessions(session)
    answer = await accounts.post(DAILY, headers={"X-Jobs-Token": JOBS_TOKEN})
    assert answer.status_code == 200, answer.text
    assert answer.json()["prune"]["sessions"] == 1
    store = SqlSessionStore(session, UserSession)
    session.expunge_all()
    assert await store.get("old") is None
    assert await store.get("recent") is not None


@pytest.mark.parametrize("headers", [{}, {"X-Jobs-Token": "a-guess"}])
async def test_nobody_without_the_jobs_token_starts_the_daily_call(
    accounts: AsyncClient, session: AsyncSession, headers: dict[str, str]
) -> None:
    await _two_ended_sessions(session)
    answer = await accounts.post(DAILY, headers=headers)
    assert answer.status_code in (401, 403), answer.text
    session.expunge_all()
    assert await SqlSessionStore(session, UserSession).get("old") is not None
