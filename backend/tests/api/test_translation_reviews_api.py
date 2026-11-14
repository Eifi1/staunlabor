"""The translation review on server-kit 0.31's review layer and its ``translation_review.sql``
table, on PostgreSQL: the kit's contract suites over this app's table, and the routes as an
admin, a reviewer an admin granted and a member meet them.

Six of the seven catalogues were machine-translated and nobody has read them
(``docs/translations.md``); this is where a native reader says so, string by string. What
the tests hold is who may read and write which verdicts: an admin every language, a reviewer
the languages and areas granted, and a member none at all."""

from __future__ import annotations

from typing import Any

import pytest
from eifi1_server_kit.auth.ports import NewAccount
from eifi1_server_kit.auth.sql import SqlUserStore
from eifi1_server_kit.translation_review import ReviewerName
from eifi1_server_kit.translation_review.sql import SqlTranslationReviewStore
from eifi1_server_kit.translation_review.testing import check_round_trip, check_store
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from staunlabor.models import TranslationReview, User
from tests.api.test_accounts_api import API, bearer, first_admin
from tests.api.test_user_admin_api import join, uid

pytestmark = pytest.mark.api

REVIEWS = f"{API}/translations/reviews"


def verdict(locale: str, key: str, text: str = "Le pendule") -> dict[str, Any]:
    return {"locale": locale, "key": key, "text": text, "reference_text": "The pendulum", "verdict": "APPROVED"}


async def test_the_kit_s_review_store_suite_passes_on_this_app_s_table(session: AsyncSession) -> None:
    new = NewAccount(
        email="grace@example.com",
        password_hash="hash",
        first_name="Grace",
        last_name="Hopper",
        locale="fr",
        role="REVIEWER",
    )
    grace = await SqlUserStore(session, User).add(new)
    store = SqlTranslationReviewStore(session, TranslationReview, accounts=User)
    await check_store(store, reviewer_id=grace.id, name=ReviewerName("Grace", "Hopper"), locale="fr")


async def test_an_admin_reviews_every_language_through_the_kit_s_round_trip(accounts: AsyncClient) -> None:
    admin = await first_admin(accounts)
    await check_round_trip(accounts, headers=bearer(admin["access_token"]), locale="hu")
    listed = (await accounts.get(REVIEWS, headers=bearer(admin["access_token"]))).json()
    assert listed["locales"] == ["de-CH", "en", "es", "fr", "it", "hu", "zh"]
    assert listed["areas"] is None


async def test_a_reviewer_reads_and_writes_only_what_an_admin_granted(accounts: AsyncClient) -> None:
    admin = await first_admin(accounts)
    token = admin["access_token"]
    grace = await join(accounts, token, "grace@example.com", first_name="Grace", last_name="Hopper")
    granted = await accounts.put(
        f"{API}/admin/users/{uid(grace)}/reviewer",
        json={"locales": ["fr"], "areas": ["experiments"]},
        headers=bearer(token),
    )
    assert granted.status_code == 200, granted.text
    # The grant takes effect on the next request, with the same session.
    reviewer = bearer(grace["access_token"])

    listed = (await accounts.get(REVIEWS, headers=reviewer)).json()
    assert (listed["locales"], listed["areas"]) == (["fr"], ["experiments"])
    saved = await accounts.put(REVIEWS, json={"items": [verdict("fr", "experiments.pendulum.title")]}, headers=reviewer)
    assert saved.status_code == 200, saved.text
    assert saved.json()["reviews"][0]["reviewer_name"] == "Grace Hopper"

    # Another language, or a string outside the area: nothing is written.
    for item in (verdict("it", "experiments.pendulum.title"), verdict("fr", "legal.privacy.title")):
        refused = await accounts.put(REVIEWS, json={"items": [item]}, headers=reviewer)
        assert refused.status_code == 403, item
    # The admin sees the reviewer's verdict, named.
    seen = (await accounts.get(REVIEWS, headers=bearer(token))).json()["reviews"]
    assert [(row["locale"], row["key"], row["reviewer_name"]) for row in seen] == [
        ("fr", "experiments.pendulum.title", "Grace Hopper")
    ]


async def test_a_member_is_granted_nothing_and_nobody_signed_out_reads_anything(accounts: AsyncClient) -> None:
    admin = await first_admin(accounts)
    bob = await join(accounts, admin["access_token"], "bob@example.com", first_name="Bob", last_name="Babbage")
    refused = await accounts.get(REVIEWS, headers=bearer(bob["access_token"]))
    assert refused.status_code == 403
    assert (await accounts.get(REVIEWS)).status_code == 401
