"""Feedback on server-kit 0.31's feedback layer and its ``feedback.sql`` tables, on
PostgreSQL: the kit's contract suites over this app's own models, and the routes as
a member and the admin meet them.

The reports are the site's to-do list as much as its readers' word: the exhibits
still to come are filed here as ideas. So what the tests hold is that an invited
account files one and finds it again, that the admin's inbox has it and the
answer reaches its author, and that nobody else reads the inbox."""

from __future__ import annotations

import secrets
from collections.abc import AsyncIterator
from pathlib import Path
from typing import Any

import pytest
from eifi1_server_kit.auth.ports import NewAccount
from eifi1_server_kit.auth.sql import SqlUserStore
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
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from staunlabor.feedback import POLICY, everybody_signed_in
from staunlabor.models import Feedback, FeedbackAttachment, FeedbackComment, FeedbackReply, FeedbackVote, User
from staunlabor.settings import get_settings
from tests.api.test_accounts_api import API, PASSWORD, bearer, first_admin, invite, invite_token, register
from tests.conftest import FIRST_ADMIN

pytestmark = pytest.mark.api

IDEA = {
    "category": "IDEA",
    "title": "Der Wirbel im Wasserglas",
    "body": "Ein Exponat, das sich als Simulation eignet: der Strudel über einem Rührstab.",
}


# ── The kit's contract suites over this app's tables ──────────────────────────


async def _person(session: AsyncSession, email: str, *, first: str = "Ada", last: str = "Lovelace") -> User:
    new = NewAccount(email=email, password_hash="hash", first_name=first, last_name=last, locale="de-CH", role="MEMBER")
    return await SqlUserStore(session, User).add(new)


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
    author = _actor(await _person(session, "author@example.org"))
    other = _actor(await _person(session, "other@example.org", first="Grace", last="Hopper"))
    admin = _actor(await _person(session, "admin@example.org", last="Admin"), admin=True)
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
    """The app on this test's empty database, its files in a directory of the test's."""
    from staunlabor.main import create_app

    monkeypatch.setenv("STAUNLABOR_REGISTRATION_ALLOWLIST", FIRST_ADMIN)
    monkeypatch.setenv("STAUNLABOR_FEEDBACK_FILES_DIR", str(tmp_path / "files"))
    get_settings.cache_clear()
    app = create_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        yield client
    await app.state.database.dispose()


async def _admin_and_member(client: AsyncClient) -> tuple[str, str]:
    admin = (await first_admin(client))["access_token"]
    issued = await invite(client, admin, "member@example.org")
    member = await register(client, "member@example.org", invite_token=invite_token(issued))
    assert member.status_code == 201, member.text
    return admin, member.json()["access_token"]


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


async def test_erasing_an_account_keeps_its_ideas_and_takes_its_name_off_them(site: AsyncClient) -> None:
    admin, member = await _admin_and_member(site)
    filed = (await site.post(f"{API}/feedback", json=IDEA, headers=bearer(member))).json()
    me = (await site.get(f"{API}/auth/me", headers=bearer(member))).json()
    typed = {"confirm_email": me["email"]}
    asked = await site.post(f"{API}/auth/me/deletion", json={"password": PASSWORD, **typed}, headers=bearer(member))
    assert asked.status_code == 202, asked.text

    erased = await site.post(f"{API}/admin/users/{me['id']}/erase", json=typed, headers=bearer(admin))
    assert erased.status_code == 200, erased.text
    assert erased.json() == {"feedback_anonymised": 1}
    inbox = (await site.get(f"{API}/feedback", headers=bearer(admin))).json()
    kept = next(row for row in inbox if row["id"] == filed["id"])
    assert kept["title"] == IDEA["title"]
    assert "member@example.org" not in str(kept)
