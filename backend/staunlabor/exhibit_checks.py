"""Which exhibits' calculations are checked: an admin's verdict per exhibit, and
the public answer every exhibit's page asks for its notice.

A verdict holds for the code it was given on. It is stored with
:func:`staunlabor.domain.checks.fingerprint`, and the public list counts an
exhibit as checked only while that fingerprint is still the deployed code's.
An engine change brings the "check still to come" notice back by itself. The
public answer gives the date and nothing of who checked (Marcel, 2026-11-19).

What this module deliberately does not do: judge the cases. Every case is a
test (``tests/unit/test_checks.py``); a deploy with a failing one never
happens. The verdict is a person's, that the cases are the right ones and the
sources say what they are cited for.
"""

from __future__ import annotations

import time
from datetime import UTC, date, datetime
from functools import cache
from typing import Annotated, Any

from eifi1_server_kit.auth.router import AuthDeps, account_request_window, app_admin
from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict
from sqlalchemy import delete, select

from staunlabor.database import RequestSession
from staunlabor.domain import checks
from staunlabor.models import ExhibitCheck
from staunlabor.security import limit_run

#: How long a process keeps the public list before it reads the table again: a
#: page view per visitor is a query otherwise, and a verdict is seen in every
#: instance within this long (at once in the one that took it).
LIST_TTL_S = 60.0


class CheckedOut(BaseModel):
    model_config = ConfigDict(frozen=True)

    exhibit: str
    checked_on: date


class ChecksOut(BaseModel):
    #: The exhibits with cases on their page, checked or not.
    with_cases: list[str]
    #: Those an admin has checked, on the code now deployed.
    checked: list[CheckedOut]


@cache
def _fingerprints() -> dict[str, str]:
    """The deployed code's, once per process: the code cannot change under it."""
    return {exhibit: checks.fingerprint(exhibit) for exhibit in checks.exhibits()}


class _Listing:
    """The public list, kept :data:`LIST_TTL_S` per process."""

    def __init__(self) -> None:
        self.value: ChecksOut | None = None
        self.at = 0.0

    def fresh(self) -> ChecksOut | None:
        if self.value is not None and time.monotonic() - self.at < LIST_TTL_S:
            return self.value
        return None

    def keep(self, value: ChecksOut) -> None:
        self.value, self.at = value, time.monotonic()

    def forget(self) -> None:
        self.value = None


async def _listing(session: Any) -> ChecksOut:
    current = _fingerprints()
    rows = (await session.execute(select(ExhibitCheck))).scalars().all()
    checked = [
        CheckedOut(exhibit=row.exhibit, checked_on=row.checked_at.date())
        for row in sorted(rows, key=lambda r: r.exhibit)
        if current.get(row.exhibit) == row.fingerprint
    ]
    return ChecksOut(with_cases=sorted(current), checked=checked)


def _known(exhibit: str) -> str:
    if exhibit not in _fingerprints():
        # The engine's word for it, answered as a 400 (main.py).
        raise ValueError(f"no checks for {exhibit!r}")
    return exhibit


def exhibit_checks_router(accounts: AuthDeps) -> APIRouter:
    """``GET /experiments/checks`` for every page, and an admin's
    ``PUT``/``DELETE /admin/experiments/checks/{exhibit}``."""
    router = APIRouter(tags=["experiments"])
    listing = _Listing()

    @router.get("/experiments/checks", response_model=ChecksOut, dependencies=[Depends(limit_run)])
    async def list_checks(session: RequestSession) -> ChecksOut:
        kept = listing.fresh()
        if kept is not None:
            return kept
        value = await _listing(session)
        listing.keep(value)
        return value

    # The admin's two spend the account window, as every admin route does.
    budget = [Depends(account_request_window(accounts))]

    @router.put("/admin/experiments/checks/{exhibit}", response_model=ChecksOut, dependencies=budget)
    async def check_exhibit(
        exhibit: str, session: RequestSession, user: Annotated[Any, Depends(app_admin)]
    ) -> ChecksOut:
        _known(exhibit)
        row = await session.get(ExhibitCheck, exhibit)
        now = datetime.now(UTC)
        if row is None:
            session.add(
                ExhibitCheck(
                    exhibit=exhibit, fingerprint=_fingerprints()[exhibit], checked_at=now, checked_by_id=user.id
                )
            )
        else:
            row.fingerprint, row.checked_at, row.checked_by_id = _fingerprints()[exhibit], now, user.id
        await session.flush()
        listing.forget()
        return await _listing(session)

    @router.delete("/admin/experiments/checks/{exhibit}", response_model=ChecksOut, dependencies=budget)
    async def uncheck_exhibit(
        exhibit: str, session: RequestSession, _user: Annotated[Any, Depends(app_admin)]
    ) -> ChecksOut:
        _known(exhibit)
        await session.execute(delete(ExhibitCheck).where(ExhibitCheck.exhibit == exhibit))
        await session.flush()
        listing.forget()
        return await _listing(session)

    return router
