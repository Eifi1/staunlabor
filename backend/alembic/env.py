"""Alembic's environment for the accounts' database, on the app's async engine.

The URL is the app's own (``STAUNLABOR_DATABASE_URL``), never a second setting:
a migration URL of its own is one that can point somewhere the app does not, and
a stray copy of it in ``backend/.env`` would aim a test's migration at the
developer's database (Kurvenschmiede's finding). The migrate job of a deployment
says which role migrates by pointing this one setting at the schema owner's URL.

A caller may hand its own connection in ``config.attributes["connection"]``
(``tests/api/test_migrations.py``), which runs the revisions on it and leaves it
open.
"""

from __future__ import annotations

import asyncio
from logging.config import fileConfig

from eifi1_server_kit.auth.sql import alembic_render_item
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import create_async_engine

from alembic import context
from staunlabor.models import Base
from staunlabor.settings import get_settings

config = context.config
if config.config_file_name is not None:
    # Without `disable_existing_loggers=False` every logger already made in this
    # process goes quiet, the app's own included when a test runs a migration.
    fileConfig(config.config_file_name, disable_existing_loggers=False)

target_metadata = Base.metadata


def _run(connection: Connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_server_default=True,
        # server-kit's instants are its UtcDateTime; rendered as plain sa.DateTime(timezone=True),
        # a generated migration names nothing of the kit's.
        render_item=alembic_render_item,
    )
    with context.begin_transaction():
        context.run_migrations()


async def _run_online() -> None:
    # NullPool: a migration is one connection, opened and closed once.
    engine = create_async_engine(get_settings().database_url, poolclass=pool.NullPool)
    try:
        async with engine.connect() as connection:
            await connection.run_sync(_run)
    finally:
        await engine.dispose()


given = config.attributes.get("connection")
if context.is_offline_mode():
    raise SystemExit("The accounts' migrations run against a database; offline SQL is not supported.")
if given is not None:
    _run(given)
else:
    asyncio.run(_run_online())
