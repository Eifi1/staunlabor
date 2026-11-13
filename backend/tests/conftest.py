"""The suite's fixtures: the app over httpx, and for the accounts a PostgreSQL
database of each xdist worker's own.

**The exhibits need no database** (``client``): the app is built fresh for every
test, so each starts with a full calculation budget, and nothing it asks for
connects anywhere. ``STAUNLABOR_DATABASE_URL`` is pinned below to a database
that does not exist, so a test that reaches the accounts without asking for a
database fails loudly instead of writing into the developer's own.

**The accounts get a throwaway database per worker** (``worker_database_url``),
PostgreSQL as in development and production, never SQLite: the schema leans on
``timestamptz``, JSONB, length-bounded strings and ``ON DELETE`` rules SQLite
does not keep. The suite runs under ``pytest -n auto``, and two workers sharing
one database would empty each other's tables mid-test, so each worker creates
``staunlabor_test_<worker>_p<pid>`` through the maintenance database
``staunlabor_test`` (``npm run db:setup``; the role has CREATEDB), builds the
schema with ``create_all`` and drops it at the end. The pid keeps two runs on one
machine apart; a run that crashed leaves a database whose pid is gone, which the
next run drops. Migration 0001 is checked against the same models in
``tests/api/test_migrations.py``. ``database`` empties every table before a test.
"""

from __future__ import annotations

import asyncio
import os
import re
from collections.abc import AsyncIterator, Iterator

import asyncpg
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from staunlabor.settings import Settings, get_settings

# The developer's backend/.env is not read: a key in it nobody pinned here would
# reach the tests (Kurvenschmiede met a migration URL aimed at its own database).
Settings.model_config["env_file"] = None

#: The maintenance database, its own and never the development one: the fixtures
#: create and drop databases beside it.
MAINTENANCE_URL = os.environ.get(
    "STAUNLABOR_TEST_DATABASE_URL",
    "postgresql+asyncpg://staunlabor:staunlabor_dev@127.0.0.1:5432/staunlabor_test",
)

# Every test that does not ask for a database gets one that is not there, over
# whatever the shell exported: an account route reached by mistake is an error.
os.environ["STAUNLABOR_DATABASE_URL"] = f"{MAINTENANCE_URL.rsplit('/', 1)[0]}/staunlabor_no_database_here"

_NO_DATABASE = (
    "Could not reach the test database at {where}\n"
    "  {kind}: {error}\n\n"
    "The accounts' tests run on PostgreSQL, as development and production do.\n"
    "    Run once:  npm run db:setup\n"
    "  or point STAUNLABOR_TEST_DATABASE_URL at any throwaway Postgres whose role has CREATEDB."
)


def _where(url: str) -> str:
    """A URL without its password, for a message."""
    return url.rsplit("@", 1)[-1]


@pytest.fixture(autouse=True)
def _reset_settings_cache():
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


@pytest.fixture
async def client() -> AsyncIterator[AsyncClient]:
    from staunlabor.main import create_app

    app = create_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        yield client
    await app.state.database.dispose()


# ── A database per worker ────────────────────────────────────────────────────

#: Serialises CREATE and DROP DATABASE across the workers: PostgreSQL refuses to
#: copy template1 while another session copies it, and eight workers starting at
#: once meet that as a fixture error that passes alone.
_DDL_LOCK = 7402119
_RUN_TOKEN = f"p{os.getpid()}"
_WORKER_DATABASE = re.compile(r"^(?P<stem>.+)_(?:gw\d+|master)(?:_[a-z]+)?_p(?P<pid>\d+)$")


def worker_database_name(stem: str, worker_id: str, role: str = "") -> str:
    """One throwaway database's name, the one place that knows the rule the
    orphan sweep reads back (``_WORKER_DATABASE``)."""
    return "_".join(part for part in (stem, worker_id, role, _RUN_TOKEN) if part)


def with_database(url: str, name: str) -> str:
    return f"{url.rsplit('/', 1)[0]}/{name}"


async def _maintenance(*statements: str) -> None:
    """CREATE or DROP DATABASE: outside a transaction, one worker at a time."""
    engine = create_async_engine(MAINTENANCE_URL, isolation_level="AUTOCOMMIT")
    try:
        async with engine.connect() as connection:
            await connection.execute(text("SELECT pg_advisory_lock(:key)"), {"key": _DDL_LOCK})
            try:
                for statement in statements:
                    await connection.execute(text(statement))
            finally:
                await connection.execute(text("SELECT pg_advisory_unlock(:key)"), {"key": _DDL_LOCK})
    finally:
        await engine.dispose()


async def drop_database(name: str) -> None:
    """``DROP … WITH (FORCE)``, so a connection a crashed run left open cannot
    keep it. FORCE terminates every session on the database, an autovacuum
    worker's too, which the role may not signal: that refusal is a race with the
    autovacuum launcher, over in milliseconds, so it is tried again."""
    for attempt in range(8):
        try:
            await _maintenance(f'DROP DATABASE IF EXISTS "{name}" WITH (FORCE)')
            return
        except DBAPIError as exc:
            if attempt == 7 or not isinstance(exc.orig, asyncpg.exceptions.InsufficientPrivilegeError):
                raise
            await asyncio.sleep(0.25)


def _owner_is_gone(pid: int) -> bool:
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return True
    except PermissionError:
        return False
    return False


async def _sweep_orphans(stem: str) -> None:
    """Drop the worker databases of runs whose process is gone: names of this
    suite's shape only, and never a live worker's, whose pid still answers."""
    engine = create_async_engine(MAINTENANCE_URL, isolation_level="AUTOCOMMIT")
    try:
        async with engine.connect() as connection:
            found = await connection.execute(
                text("SELECT datname FROM pg_database WHERE datname LIKE :like"), {"like": f"{stem}\\_%"}
            )
            names = list(found.scalars())
    finally:
        await engine.dispose()
    for name in names:
        match = _WORKER_DATABASE.match(name)
        if match and match["stem"] == stem and _owner_is_gone(int(match["pid"])):
            await drop_database(name)


async def _build_schema(url: str) -> None:
    from staunlabor.models import Base

    engine = create_async_engine(url)
    try:
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
    finally:
        await engine.dispose()


@pytest.fixture(scope="session")
def worker_database_url(worker_id: str) -> Iterator[str]:
    """This worker's own database, the models' schema in it, dropped at the end.

    Synchronous, its async work through :func:`asyncio.run`: an engine made in a
    session-scoped event loop could not be used from the tests' own loops."""
    stem = MAINTENANCE_URL.rsplit("/", 1)[-1]
    name = worker_database_name(stem, worker_id)
    url = with_database(MAINTENANCE_URL, name)
    try:
        asyncio.run(_sweep_orphans(stem))
        asyncio.run(drop_database(name))
        asyncio.run(_maintenance(f'CREATE DATABASE "{name}"'))
        asyncio.run(_build_schema(url))
    except Exception as exc:  # pragma: no cover - no database to reach
        # Broad on purpose: asyncpg raises its own types straight out of connect.
        pytest.fail(
            _NO_DATABASE.format(where=_where(MAINTENANCE_URL), kind=type(exc).__name__, error=exc), pytrace=False
        )
    yield url
    asyncio.run(drop_database(name))


@pytest.fixture
async def database(worker_database_url: str, monkeypatch: pytest.MonkeyPatch) -> AsyncIterator[str]:
    """This worker's database, emptied for this test, and the app's settings
    pointed at it: every row gone and every id counter back at 1."""
    from staunlabor.models import Base

    monkeypatch.setenv("STAUNLABOR_DATABASE_URL", worker_database_url)
    get_settings.cache_clear()
    engine = create_async_engine(worker_database_url)
    try:
        async with engine.begin() as connection:
            # DELETE, not TRUNCATE: on tables of a few rows it is a fraction of
            # the cost (Kurvenschmiede measured 39 ms against 2.5 s per test).
            for table in reversed(Base.metadata.sorted_tables):
                await connection.exec_driver_sql(f'DELETE FROM "{table.name}"')
            sequences = await connection.execute(
                text("SELECT sequencename FROM pg_sequences WHERE schemaname = 'public'")
            )
            for sequence in sequences.scalars():
                await connection.exec_driver_sql(f'ALTER SEQUENCE "{sequence}" RESTART')
    finally:
        await engine.dispose()
    yield worker_database_url


@pytest.fixture
async def session(database: str) -> AsyncIterator[AsyncSession]:
    """A session on this test's empty database, for the stores' contract checks."""
    engine = create_async_engine(database)
    try:
        async with async_sessionmaker(engine, expire_on_commit=False)() as session:
            yield session
    finally:
        await engine.dispose()
