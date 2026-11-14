"""The scheduled pruning (``staunlabor.jobs``) on PostgreSQL: what goes, what stays,
and the command a scheduler starts.

Which row is done with is server-kit's rule (``prune_account_rows``, tested on its
stores there); these hold the site's retention to it, on its own tables, and the
command to the database its settings name.
"""

from __future__ import annotations

import asyncio
import logging
import os
import sys
from datetime import datetime, timedelta
from pathlib import Path

import pytest
from eifi1_server_kit.auth.sql import AccountPrune
from eifi1_server_kit.clock import utc_now
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from staunlabor.jobs import main, prune
from staunlabor.models import Invitation, OneTimeToken, SpentChallenge, User, UserSession
from staunlabor.settings import get_settings

pytestmark = pytest.mark.api

BACKEND = Path(__file__).resolve().parents[2]


async def _rows_either_side_of_thirty_days(session: AsyncSession, now: datetime) -> None:
    """Of each kind, rows done with 31 days ago, which go, and 29 days ago or not at
    all, which stay; and an accepted invitation as old as any, which stays for good."""
    long_ago, lately = now - timedelta(days=31), now - timedelta(days=29)
    ada = User(email="ada@example.com", password_hash="x", first_name="Ada", last_name="", locale="en", role="ADMIN")
    session.add(ada)
    await session.flush()

    def signed_in(sid: str, *, active: bool, last_active: datetime, expires_at: datetime) -> UserSession:
        return UserSession(
            sid=sid,
            user_id=ada.id,
            started_at=last_active,
            last_active=last_active,
            expires_at=expires_at,
            is_active=active,
            ip_address="192.0.2.7",
        )

    def link(kind: str, digest: str, expires_at: datetime) -> OneTimeToken:
        return OneTimeToken(kind=kind, user_id=ada.id, token_hash=digest * 64, email=ada.email, expires_at=expires_at)

    session.add_all(
        [
            signed_in("ended-long-ago", active=False, last_active=long_ago, expires_at=now + timedelta(days=1)),
            signed_in("ran-out-long-ago", active=True, last_active=long_ago - timedelta(days=30), expires_at=long_ago),
            signed_in("ended-lately", active=False, last_active=lately, expires_at=now + timedelta(days=1)),
            signed_in("live", active=True, last_active=now, expires_at=now + timedelta(days=30)),
            link("password_reset", "a", long_ago),
            link("verification", "b", lately),
            Invitation(email="ran-out@example.com", locale="en", expires_at=long_ago),
            Invitation(
                email="withdrawn@example.com", locale="en", expires_at=now - timedelta(days=17), revoked_at=long_ago
            ),
            Invitation(email="ran-out-lately@example.com", locale="en", expires_at=lately),
            Invitation(
                email="ada@example.com",
                locale="en",
                expires_at=long_ago,
                accepted_at=long_ago,
                accepted_by_user_id=ada.id,
            ),
            SpentChallenge(challenge_hash="c" * 64, expires_at=long_ago),
            SpentChallenge(challenge_hash="d" * 64, expires_at=lately),
        ]
    )
    await session.commit()


async def test_the_prune_deletes_what_was_done_with_thirty_days_ago_and_keeps_the_rest(
    database: str, session: AsyncSession
):
    now = utc_now()
    await _rows_either_side_of_thirty_days(session, now)
    assert await prune(get_settings(), now=now) == AccountPrune(sessions=2, challenges=1, links=1, invitations=2)

    assert list(await session.scalars(select(UserSession.sid).order_by(UserSession.sid))) == ["ended-lately", "live"]
    assert list(await session.scalars(select(OneTimeToken.kind))) == ["verification"]
    invitations = await session.scalars(select(Invitation.email).order_by(Invitation.email))
    assert list(invitations) == ["ada@example.com", "ran-out-lately@example.com"]
    assert list(await session.scalars(select(SpentChallenge.challenge_hash))) == ["d" * 64]
    assert await session.scalar(select(func.count()).select_from(User)) == 1


async def test_the_retention_is_the_setting_s(database: str, session: AsyncSession, monkeypatch: pytest.MonkeyPatch):
    now = utc_now()
    await _rows_either_side_of_thirty_days(session, now)
    monkeypatch.setenv("STAUNLABOR_ACCOUNT_ROWS_RETENTION_DAYS", "28")
    get_settings.cache_clear()
    # Everything but the live session and the accepted invitation is past 28 days.
    assert await prune(get_settings(), now=now) == AccountPrune(sessions=3, challenges=2, links=2, invitations=3)


def test_the_command_runs_the_job_it_names_and_says_what_went(database: str, caplog: pytest.LogCaptureFixture):
    with caplog.at_level(logging.INFO, logger="staunlabor.jobs"):
        assert main(["prune"]) == 0
    assert caplog.messages == [
        "Pruned 0 account rows done with for 30 days or more (sessions 0, passkey challenges 0, links 0, invitations 0)."
    ]
    # A job it does not know is argparse's usage error, the job's failed exit.
    with pytest.raises(SystemExit) as unknown:
        main(["vacuum"])
    assert unknown.value.code == 2


async def test_the_command_a_scheduler_starts_prunes_the_database_its_settings_name(
    database: str, session: AsyncSession, tmp_path: Path
):
    await _rows_either_side_of_thirty_days(session, utc_now())
    # Started as a Cloud Run job starts it, from a directory with no .env in it.
    started = await asyncio.create_subprocess_exec(
        sys.executable,
        "-m",
        "staunlabor.jobs",
        "prune",
        cwd=tmp_path,
        env={**os.environ, "STAUNLABOR_DATABASE_URL": database, "PYTHONPATH": str(BACKEND)},
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    _, stderr = await asyncio.wait_for(started.communicate(), timeout=60)
    assert started.returncode == 0, stderr.decode()
    assert "INFO staunlabor.jobs: Pruned 6 account rows done with for 30 days or more" in stderr.decode()
    assert await session.scalar(select(func.count()).select_from(UserSession)) == 2
