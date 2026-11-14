"""The accounts' housekeeping, as the command a scheduler starts:
``python -m staunlabor.jobs prune``.

**prune** deletes the account rows nobody reads again once they have been done
with for ``settings.account_rows_retention_days``: the sessions that ended or
expired, each keeping the address it was signed in from and the browser's
description; the reset, verification and address-change links past their
expiry; the invitations never accepted that expired or were revoked; and the
spent passkey challenges. Server-kit's ``prune_account_rows`` decides which
rows, in one transaction. Nothing else deletes them, neither the kit nor a
route, and left alone they would stay for good, which no privacy policy can
promise.

A command and not a route: a Cloud Run job on the backend's image runs it on
Cloud Scheduler's clock, with the app role's database URL, and its exit status
is the job's (``deploy/README.md``, "To do before the accounts deploy"); a route
would be one more public door to budget and to guard with a token. Nothing
schedules it yet.

What it deliberately does not do: erase an account (an operator erases one that
asked, ``POST /admin/users/{id}/erase``), or touch the admin log, the passkeys
or an accepted invitation, which records how its account came in.
"""

from __future__ import annotations

import argparse
import asyncio
import logging
from collections.abc import Sequence
from datetime import datetime, timedelta

from eifi1_server_kit.auth.sql import (
    AccountPrune,
    SqlInvitationStore,
    SqlOneTimeTokenStore,
    SqlPasskeyStore,
    SqlSessionStore,
    prune_account_rows,
)
from eifi1_server_kit.clock import utc_now

from staunlabor.database import Database
from staunlabor.models import Invitation, OneTimeToken, Passkey, SpentChallenge, UserSession
from staunlabor.settings import Settings, get_settings

#: By name, not ``__name__``: started with ``-m`` this module is ``__main__``, and the
#: job's line in the log should say whose it is.
logger = logging.getLogger("staunlabor.jobs")


async def prune(settings: Settings, *, now: datetime | None = None) -> AccountPrune:
    """One run: every account row done with before the retention, deleted in one
    transaction on an engine of its own, disposed after. ``now`` is the clock's
    unless a test hands its own."""
    now = utc_now() if now is None else now
    database = Database(settings)
    try:
        async with database.sessions() as session, session.begin():
            return await prune_account_rows(
                before=now - timedelta(days=settings.account_rows_retention_days),
                now=now,
                sessions=SqlSessionStore(session, UserSession),
                passkeys=SqlPasskeyStore(session, Passkey, SpentChallenge),
                links=SqlOneTimeTokenStore(session, OneTimeToken),
                invitations=SqlInvitationStore(session, Invitation),
            )
    finally:
        await database.dispose()


def main(argv: Sequence[str] | None = None) -> int:
    """The command: the job named, run once, and one line saying what went."""
    parser = argparse.ArgumentParser(prog="python -m staunlabor.jobs", description="The accounts' housekeeping.")
    parser.add_argument("job", choices=("prune",), help="prune: delete the account rows past their retention")
    parser.parse_args(argv)
    settings = get_settings()
    pruned = asyncio.run(prune(settings))
    logger.info(
        "Pruned %d account rows done with for %d days or more"
        " (sessions %d, passkey challenges %d, links %d, invitations %d).",
        pruned.total,
        settings.account_rows_retention_days,
        pruned.sessions,
        pruned.challenges,
        pruned.links,
        pruned.invitations,
    )
    return 0


if __name__ == "__main__":  # pragma: no cover - the command's own lines, run in a subprocess by tests/api/test_jobs.py
    # A command's process configures its own log: Cloud Run takes stderr as the job's.
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    raise SystemExit(main())
