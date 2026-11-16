"""The accounts' database: the engine, its sessions, and the request's unit of work.

Built once per app (``create_app``, on ``app.state.database``) and disposed when
it stops. Building it connects nothing: the first connection opens when an
account route first asks for a session, so the exhibits, which never ask,
answer with no database at all, or with one that is down.

**One unit of work per request** (:func:`request_session`): every store the
request uses shares its session, which commits when the route returned and
rolls back when it raised. The kit's stores flush and never commit, so a route
that forgot nothing still persists, and a refusal raised after a write leaves
nothing half done. The work queued for after the commit (server-kit's
``SqlAfterCommit``: the account mails) runs from that commit, and a rollback
drops it.

What it does not do: create a schema (that is Alembic's, ``backend/alembic``)
or open a session outside a request.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from staunlabor.settings import Settings


class Database:
    """The engine and its session factory, one per app."""

    def __init__(self, settings: Settings) -> None:
        self.engine = create_async_engine(
            settings.database_url,
            pool_size=settings.db_pool_size,
            max_overflow=settings.db_max_overflow,
            pool_timeout=settings.db_pool_timeout_s,
            # A failed statement's error carries its parameters by default: an
            # address, a name, a token's digest. On a deployment the log keeps
            # the statement without them (keksdose's legal audit, 2026-11-11);
            # a laptop keeps them, where they are the developer's own clue.
            hide_parameters=settings.deployed,
        )
        # Not expired on commit: a route's answer reads the rows it wrote, and
        # the commit comes before the answer is sent (request_session).
        self.sessions = async_sessionmaker(self.engine, expire_on_commit=False)

    async def dispose(self) -> None:
        await self.engine.dispose()


async def _unit_of_work(request: Request) -> AsyncIterator[AsyncSession]:
    database: Database = request.app.state.database
    async with database.sessions() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        else:
            await session.commit()


#: The request's session, committed when the route returned and rolled back when it
#: raised. ``scope="function"``: FastAPI ends a ``yield`` dependency AFTER the answer
#: is sent unless told otherwise, and a commit that failed then would have answered
#: 201 for a row that is not there. Ended with the route, the failed commit is the
#: answer's 500.
request_session = Depends(_unit_of_work, scope="function")

#: The parameter type of a dependency that works on the request's session.
RequestSession = Annotated[AsyncSession, request_session]
