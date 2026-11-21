"""Which exhibits are checked, on PostgreSQL: the public list every page asks
for, and an admin's verdict, which holds only while the code's fingerprint is
the one it was given on."""

from __future__ import annotations

from datetime import UTC, datetime

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from staunlabor.models import ExhibitCheck
from tests.api.test_accounts_api import API, bearer, first_admin
from tests.api.test_user_admin_api import join

pytestmark = pytest.mark.api

LIST = f"{API}/experiments/checks"


def admin_path(exhibit: str) -> str:
    return f"{API}/admin/experiments/checks/{exhibit}"


async def test_with_no_verdict_every_exhibit_with_cases_is_listed_and_none_is_checked(accounts: AsyncClient) -> None:
    answer = await accounts.get(LIST)
    assert answer.status_code == 200, answer.text
    assert answer.json() == {
        "with_cases": [
            "arch",
            "beats",
            "bounce",
            "cannon",
            "chair",
            "chaos",
            "chladni",
            "circuit",
            "coil",
            "cone",
            "coriolis",
            "coupled",
            "cradle",
            "diver",
            "elephant",
            "foucault",
            "harmonograph",
            "levitation",
            "maxwell",
            "overhang",
            "parabola",
            "peg",
            "plates",
            "platform",
            "race",
            "rainbow",
            "resonance",
            "sky",
            "slits",
            "smoke",
            "sphere",
            "waterwheel",
            "wave",
            "well",
        ],
        "checked": [],
    }


async def test_an_admin_checks_an_exhibit_and_the_public_list_shows_its_date_and_no_name(
    accounts: AsyncClient,
) -> None:
    admin = await first_admin(accounts)
    done = await accounts.put(admin_path("sphere"), headers=bearer(admin["access_token"]))
    assert done.status_code == 200, done.text
    today = datetime.now(UTC).date().isoformat()
    assert done.json()["checked"] == [{"exhibit": "sphere", "checked_on": today}]
    listed = (await accounts.get(LIST)).json()
    assert listed["checked"] == [{"exhibit": "sphere", "checked_on": today}]
    assert "Ada" not in str(listed) and "Lovelace" not in str(listed)


async def test_an_admin_takes_a_verdict_back(accounts: AsyncClient) -> None:
    admin = await first_admin(accounts)
    token = bearer(admin["access_token"])
    await accounts.put(admin_path("coil"), headers=token)
    taken = await accounts.delete(admin_path("coil"), headers=token)
    assert taken.status_code == 200, taken.text
    assert taken.json()["checked"] == []
    assert (await accounts.get(LIST)).json()["checked"] == []


async def test_a_member_and_a_stranger_cannot_check_anything(accounts: AsyncClient) -> None:
    admin = await first_admin(accounts)
    member = await join(accounts, admin["access_token"], "grace@example.com", first_name="Grace", last_name="Hopper")
    refused = await accounts.put(admin_path("sphere"), headers=bearer(member["access_token"]))
    assert refused.status_code == 403, refused.text
    assert (await accounts.put(admin_path("sphere"))).status_code == 401
    assert (await accounts.get(LIST)).json()["checked"] == []


async def test_an_exhibit_without_cases_cannot_be_checked(accounts: AsyncClient) -> None:
    admin = await first_admin(accounts)
    # A name that is no exhibit, as every exhibit has its cases.
    refused = await accounts.put(admin_path("orrery"), headers=bearer(admin["access_token"]))
    assert refused.status_code == 400
    assert "no checks" in refused.json()["detail"]


async def test_a_verdict_on_other_code_counts_for_nothing(accounts: AsyncClient, session: AsyncSession) -> None:
    # Given on a version of the engine since changed: its fingerprint no longer matches.
    session.add(ExhibitCheck(exhibit="chair", fingerprint="0" * 64, checked_at=datetime.now(UTC), checked_by_id=None))
    await session.commit()
    assert (await accounts.get(LIST)).json()["checked"] == []
