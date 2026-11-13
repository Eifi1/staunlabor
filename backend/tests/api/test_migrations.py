"""Migration 0001 builds exactly what the models declare.

The suite's databases are built by ``create_all`` from the models
(``conftest._build_schema``); a deployment's by ``alembic upgrade head``. Each
test here runs the chain on an empty database of its own and asks Alembic's
comparison whether anything differs from the models: a column, a type, a null,
an index, a constraint's name. Server defaults are compared too, since the
kit's columns declare none and a migration that added one would slip past
every other check.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from pathlib import Path
from typing import Any

import pytest
from alembic.autogenerate import compare_metadata
from alembic.config import Config
from alembic.migration import MigrationContext
from alembic.script import ScriptDirectory
from sqlalchemy import Connection, inspect
from sqlalchemy.ext.asyncio import create_async_engine

from alembic import command
from staunlabor.models import Base
from tests.conftest import MAINTENANCE_URL, _maintenance, drop_database, with_database, worker_database_name

pytestmark = pytest.mark.api

BACKEND = Path(__file__).resolve().parents[2]


def _config(connection: Connection) -> Config:
    # No ini file: env.py would hand it to logging.config and reset the
    # process's loggers under every later test in this worker.
    config = Config()
    config.set_main_option("script_location", str(BACKEND / "alembic"))
    config.attributes["connection"] = connection
    return config


def _differences(connection: Connection) -> list[Any]:
    context = MigrationContext.configure(connection, opts={"compare_type": True, "compare_server_default": True})
    return compare_metadata(context, Base.metadata)


@pytest.fixture
async def empty_database(worker_id: str) -> AsyncIterator[str]:
    stem = MAINTENANCE_URL.rsplit("/", 1)[-1]
    name = worker_database_name(stem, worker_id, "migrations")
    await drop_database(name)
    await _maintenance(f'CREATE DATABASE "{name}"')
    try:
        yield with_database(MAINTENANCE_URL, name)
    finally:
        await drop_database(name)


async def test_upgrade_head_on_an_empty_database_builds_exactly_the_models_schema(empty_database: str):
    engine = create_async_engine(empty_database)
    try:
        async with engine.begin() as connection:
            await connection.run_sync(lambda sync: command.upgrade(_config(sync), "head"))
        async with engine.connect() as connection:
            differences = await connection.run_sync(_differences)
            tables = await connection.run_sync(lambda sync: set(inspect(sync).get_table_names()))
    finally:
        await engine.dispose()
    assert differences == []
    assert tables == {*Base.metadata.tables, "alembic_version"}


async def test_downgrade_base_leaves_only_alembic_s_own_table(empty_database: str):
    engine = create_async_engine(empty_database)
    try:
        async with engine.begin() as connection:
            await connection.run_sync(lambda sync: command.upgrade(_config(sync), "head"))
        async with engine.begin() as connection:
            await connection.run_sync(lambda sync: command.downgrade(_config(sync), "base"))
        async with engine.connect() as connection:
            tables = await connection.run_sync(lambda sync: set(inspect(sync).get_table_names()))
    finally:
        await engine.dispose()
    assert tables == {"alembic_version"}


def test_the_chain_is_one_line_of_revisions_from_0001():
    """One head, and every revision after 0001 names the one before it: two
    branches would be two schemas, and a deploy would have to pick one."""
    script = ScriptDirectory(str(BACKEND / "alembic"))
    assert script.get_heads() == [script.get_current_head()]
    assert [revision.revision for revision in script.walk_revisions()][-1] == "0001"
