"""Feedback on server-kit 0.31's feedback layer and its ``feedback.sql`` tables, on
PostgreSQL: the kit's contract suites over this app's own models, and the routes as
a member and the admin meet them.

The reports are the site's to-do list as much as its readers' word: the exhibits
still to come are filed here as ideas. So what the tests hold is that an invited
account files one and finds it again, that the admin's inbox has it and the
answer reaches its author, and that nobody else reads the inbox."""

from __future__ import annotations

import os
import secrets
import time
from collections.abc import AsyncIterator
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

import pytest
from eifi1_server_kit.feedback import (
    FeedbackActor,
    FeedbackCategory,
    FeedbackStatus,
    NewFeedback,
)
from eifi1_server_kit.feedback.sql import (
    SqlAttachmentStorage,
    SqlFeedbackCommentStore,
    SqlFeedbackReplyStore,
    SqlFeedbackRepository,
    SqlFeedbackVoteStore,
    SqlPeopleLookup,
)
from eifi1_server_kit.feedback.testing import (
    check_comment_store,
    check_public_repository,
    check_reply_store,
    check_repository,
    check_storage,
    check_vote_store,
)
from eifi1_server_kit.objects import LocalObjectStore
from eifi1_server_kit.uploads import check_upload
from httpx import AsyncClient
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from staunlabor.feedback import POLICY, everybody_signed_in
from staunlabor.models import Feedback, FeedbackAttachment, FeedbackComment, FeedbackReply, FeedbackVote, User
from tests.api.helpers import (
    API,
    PASSWORD,
    bearer,
    erase_due,
    first_admin,
    join,
    seed_account,
)
from tests.conftest import ACCOUNTS_ENV, JOBS_TOKEN, app_client

pytestmark = pytest.mark.api

IDEA = {
    "category": "IDEA",
    "title": "Der Wirbel im Wasserglas",
    "body": "Ein Exponat, das sich als Simulation eignet: der Strudel über einem Rührstab.",
}


# ── The kit's contract suites over this app's tables ──────────────────────────


def _actor(account: User, *, admin: bool = False) -> FeedbackActor:
    return FeedbackActor(
        id=account.id, email=account.email, display_name=f"{account.first_name} {account.last_name}", is_admin=admin
    )


def _report(user_id: int, title: str) -> NewFeedback:
    return NewFeedback(
        user_id=user_id,
        title=title,
        body="Filed by the test.",
        category=FeedbackCategory.IDEA,
        status=FeedbackStatus.OPEN,
        context={"route": "/"},
    )


async def _upload(storage: SqlAttachmentStorage[Any], uploader: FeedbackActor, note: str) -> str:
    data = f"{note} by {uploader.email} ({secrets.token_hex(4)})\n".encode()
    key = await storage.save(data, check_upload(data, "text/plain"), uploader=uploader, filename=f"{note}.txt")
    return POLICY.url_for(key)


async def test_the_kit_s_feedback_suites_pass_on_this_app_s_tables(session: AsyncSession, tmp_path: Path) -> None:
    author = _actor(await seed_account(session, "author@example.org"))
    other = _actor(await seed_account(session, "other@example.org", first="Grace", last="Hopper"))
    admin = _actor(await seed_account(session, "admin@example.org", last="Admin"), admin=True)
    storage = SqlAttachmentStorage(
        session,
        FeedbackAttachment,
        objects=LocalObjectStore(tmp_path),
        reports=Feedback,
        replies=FeedbackReply,
        comments=FeedbackComment,
        policy=POLICY,
        public_viewer=everybody_signed_in,
    )
    replies = SqlFeedbackReplyStore(session, FeedbackReply, uploads=FeedbackAttachment, policy=POLICY)
    comments = SqlFeedbackCommentStore(session, FeedbackComment, uploads=FeedbackAttachment, policy=POLICY)
    votes = SqlFeedbackVoteStore(session, FeedbackVote)
    repository = SqlFeedbackRepository(
        session,
        Feedback,
        accounts=User,
        policy=POLICY,
        replies=FeedbackReply,
        comments=FeedbackComment,
        votes=FeedbackVote,
        uploads=FeedbackAttachment,
    )

    await check_storage(storage, policy=POLICY, uploader=author)
    await check_repository(
        repository, storage=storage, policy=POLICY, author=author, other=other, replies=replies, comments=comments
    )
    await check_public_repository(repository, votes=votes, author=author, other=other)
    answered = await repository.add(_report(author.id, "To answer"))
    await check_reply_store(
        replies,
        feedback_id=answered.id,
        admin=admin,
        policy=POLICY,
        attachment_url=await _upload(storage, admin, "reply"),
    )
    commented = await repository.add(_report(author.id, "To comment on"))
    await check_comment_store(
        comments,
        feedback_id=commented.id,
        author=author,
        other=other,
        admin=admin,
        policy=POLICY,
        attachment_url=await _upload(storage, author, "comment"),
    )
    wanted = await repository.add(_report(author.id, "To vote on"))
    await check_vote_store(votes, feedback_id=wanted.id, voter=author, other=other)
    names = await SqlPeopleLookup(session, User).names([author.id, other.id])
    assert names == {author.id: ("Ada", "Lovelace"), other.id: ("Grace", "Hopper")}


# ── The routes ───────────────────────────────────────────────────────────────


@pytest.fixture
async def site(database: str, monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> AsyncIterator[AsyncClient]:
    """The account tests' app, its files in a directory of the test's."""
    async with app_client(monkeypatch, **ACCOUNTS_ENV, STAUNLABOR_FEEDBACK_FILES_DIR=str(tmp_path / "files")) as client:
        yield client


async def _admin_and_member(client: AsyncClient) -> tuple[str, str]:
    admin = (await first_admin(client))["access_token"]
    return admin, (await join(client, admin, "member@example.org"))["access_token"]


async def test_an_invited_account_files_an_idea_and_finds_it_in_its_own_list(site: AsyncClient) -> None:
    _, member = await _admin_and_member(site)
    filed = await site.post(f"{API}/feedback", json=IDEA, headers=bearer(member))
    assert filed.status_code == 201, filed.text
    mine = await site.get(f"{API}/feedback/my", headers=bearer(member))
    assert mine.status_code == 200
    assert [row["title"] for row in mine.json()] == [IDEA["title"]]


async def test_the_admin_s_inbox_has_the_idea_and_the_answer_reaches_its_author(site: AsyncClient) -> None:
    admin, member = await _admin_and_member(site)
    filed = (await site.post(f"{API}/feedback", json=IDEA, headers=bearer(member))).json()
    inbox = await site.get(f"{API}/feedback", headers=bearer(admin))
    assert inbox.status_code == 200
    assert IDEA["title"] in [row["title"] for row in inbox.json()]
    answer = await site.post(
        f"{API}/feedback/{filed['id']}/replies", json={"body": "Gute Idee, geplant."}, headers=bearer(admin)
    )
    assert answer.status_code == 201, answer.text
    mine = (await site.get(f"{API}/feedback/my", headers=bearer(member))).json()
    assert [reply["body"] for reply in mine[0]["replies"]] == ["Gute Idee, geplant."]


async def test_nobody_but_the_admin_reads_the_inbox_and_nobody_signed_out_files_anything(site: AsyncClient) -> None:
    _, member = await _admin_and_member(site)
    refused = await site.get(f"{API}/feedback", headers=bearer(member))
    assert refused.status_code == 403
    assert refused.json()["code"] == "admin_required"
    anonymous = await site.post(f"{API}/feedback", json=IDEA)
    assert anonymous.status_code == 401


async def test_the_admin_s_overview_counts_the_reports_nobody_has_looked_at(site: AsyncClient) -> None:
    admin, member = await _admin_and_member(site)
    for title in ("Der Wirbel im Wasserglas", "Die Pendelwelle"):
        filed = await site.post(f"{API}/feedback", json={**IDEA, "title": title}, headers=bearer(member))
        assert filed.status_code == 201, filed.text
    overview = await site.get(f"{API}/admin/attention", headers=bearer(admin))
    assert overview.json()["feedback_waiting"] == 2
    # Answered and set to a status past OPEN, a report no longer waits.
    first = (await site.get(f"{API}/feedback", headers=bearer(admin))).json()[0]
    triaged = await site.patch(f"{API}/feedback/{first['id']}", json={"status": "POSTPONED"}, headers=bearer(admin))
    assert triaged.status_code == 200, triaged.text
    overview = await site.get(f"{API}/admin/attention", headers=bearer(admin))
    assert overview.json()["feedback_waiting"] == 1


async def test_erasing_an_account_keeps_its_ideas_and_takes_its_name_off_them(
    site: AsyncClient, session: AsyncSession
) -> None:
    admin, member = await _admin_and_member(site)
    filed = (await site.post(f"{API}/feedback", json=IDEA, headers=bearer(member))).json()
    me = (await site.get(f"{API}/auth/me", headers=bearer(member))).json()
    typed = {"confirm_email": me["email"]}
    asked = await site.post(f"{API}/auth/me/deletion", json={"password": PASSWORD, **typed}, headers=bearer(member))
    assert asked.status_code == 202, asked.text

    assert (await erase_due(site, session, me["id"]))["erased"] == [me["id"]]
    inbox = (await site.get(f"{API}/feedback", headers=bearer(admin))).json()
    kept = next(row for row in inbox if row["id"] == filed["id"])
    assert kept["title"] == IDEA["title"]
    assert "member@example.org" not in str(kept)


async def test_erasing_an_account_removes_the_files_it_alone_holds(
    site: AsyncClient, session: AsyncSession, tmp_path: Path
) -> None:
    admin, member = await _admin_and_member(site)

    async def upload(token: str, text: str) -> str:
        answer = await site.post(
            f"{API}/feedback/attachments",
            files={"file": ("note.txt", text.encode(), "text/plain")},
            headers=bearer(token),
        )
        assert answer.status_code == 201, answer.text
        return answer.json()["url"]

    own = await upload(member, "Nur das Mitglied hat diese Notiz angehängt.\n")
    # The same bytes from the admin: one file in the store (its name is its content's).
    shared = await upload(member, "Beide haben diese Notiz angehängt.\n")
    assert await upload(admin, "Beide haben diese Notiz angehängt.\n") == shared
    # The same bytes again, which the admin uploaded and has not filed yet (an upload
    # waits a day for its report): no report of theirs names it, their upload holds it.
    unfiled = await upload(member, "Die Administration reicht diese Notiz noch ein.\n")
    assert await upload(admin, "Die Administration reicht diese Notiz noch ein.\n") == unfiled
    filed = await site.post(
        f"{API}/feedback", json={**IDEA, "attachment_urls": [own, shared, unfiled]}, headers=bearer(member)
    )
    assert filed.status_code == 201, filed.text
    theirs = await site.post(
        f"{API}/feedback", json={**IDEA, "title": "Die Pendelwelle", "attachment_urls": [shared]}, headers=bearer(admin)
    )
    assert theirs.status_code == 201, theirs.text

    files = tmp_path / "files"

    def stored() -> set[str]:
        return {path.name for path in files.rglob("*") if path.is_file()}

    def key(url: str) -> str:
        return url.rsplit("/", 1)[-1]

    assert {key(own), key(shared), key(unfiled)} <= stored()
    # Older than the five minutes the purge spares for an upload of the same bytes.
    past = time.time() - 600
    for path in files.rglob("*"):
        if path.is_file():
            os.utime(path, (past, past))

    me = (await site.get(f"{API}/auth/me", headers=bearer(member))).json()
    typed = {"confirm_email": me["email"]}
    asked = await site.post(f"{API}/auth/me/deletion", json={"password": PASSWORD, **typed}, headers=bearer(member))
    assert asked.status_code == 202, asked.text
    assert (await erase_due(site, session, me["id"]))["erased"] == [me["id"]]

    # The member's own file is gone; the one the admin's report still names stays, and so
    # does the one the admin's upload still holds for a report not filed yet.
    assert key(own) not in stored()
    assert {key(shared), key(unfiled)} <= stored()


async def test_the_daily_call_sweeps_an_upload_no_report_named_for_a_day(
    site: AsyncClient, session: AsyncSession, tmp_path: Path
) -> None:
    _, member = await _admin_and_member(site)
    answer = await site.post(
        f"{API}/feedback/attachments",
        files={"file": ("note.txt", b"Nie eingereicht.\n", "text/plain")},
        headers=bearer(member),
    )
    assert answer.status_code == 201, answer.text
    key = answer.json()["url"].rsplit("/", 1)[-1]
    files = tmp_path / "files"
    [stored] = [path for path in files.rglob("*") if path.is_file()]
    assert stored.name == key
    # Two days on, and older than the minutes a purge spares.
    await session.execute(update(FeedbackAttachment).values(created_at=datetime.now(UTC) - timedelta(days=2)))
    await session.commit()
    past = time.time() - 2 * 86400
    os.utime(stored, (past, past))

    run = await site.post(f"{API}/ops/accounts/daily", headers={"X-Jobs-Token": JOBS_TOKEN})
    assert run.status_code == 200, run.text
    assert not stored.exists()
