"""The app's stores keep server-kit's ports' promises, on PostgreSQL.

The stores are the kit's own ``[sql]`` stores, which the kit tests on SQLite;
the tables are this app's (``staunlabor.models``), with its names, its naming
convention and its CHECK on the roles. Each check is the kit's
(``eifi1_server_kit.auth.testing``): it calls every method of its port, writes
under fresh addresses, and raises naming the first promise that fails. What
runs here is what PostgreSQL makes of them: ``timestamptz`` to the microsecond,
JSONB, the unique indexes, the foreign keys and their ``ON DELETE``.
"""

from __future__ import annotations

import pytest
from eifi1_server_kit.auth.ports import NewAccount
from eifi1_server_kit.auth.sql import (
    SqlAdminActionLog,
    SqlAfterCommit,
    SqlInvitationStore,
    SqlOneTimeTokenStore,
    SqlPasskeyStore,
    SqlSessionStore,
    SqlUserStore,
)
from eifi1_server_kit.auth.testing import (
    check_admin_action_log,
    check_after_commit,
    check_invitation_store,
    check_one_time_token_store,
    check_passkey_store,
    check_session_store,
    check_user_store,
)
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from staunlabor.models import AdminAction, Invitation, OneTimeToken, Passkey, Role, SpentChallenge, User, UserSession

pytestmark = pytest.mark.api


async def _two_accounts(session: AsyncSession) -> tuple[int, int]:
    store = SqlUserStore(session, User)
    made = [
        await store.add(
            NewAccount(
                email=f"{name}@example.com",
                password_hash="x",
                first_name=name.title(),
                last_name="",
                locale="de-CH",
                role=Role.MEMBER,
            )
        )
        for name in ("ada", "grace")
    ]
    return made[0].id, made[1].id


async def test_the_account_store_keeps_the_kit_s_promises(session: AsyncSession):
    await check_user_store(SqlUserStore(session, User), role=Role.MEMBER, other_role=Role.ADMIN)


async def test_the_session_store_keeps_the_kit_s_promises(session: AsyncSession):
    user_id, other_user_id = await _two_accounts(session)
    await check_session_store(SqlSessionStore(session, UserSession), user_id=user_id, other_user_id=other_user_id)


async def test_the_link_store_keeps_the_kit_s_promises(session: AsyncSession):
    user_id, other_user_id = await _two_accounts(session)
    store = SqlOneTimeTokenStore(session, OneTimeToken)
    await check_one_time_token_store(store, user_id=user_id, other_user_id=other_user_id)


async def test_the_invitation_store_keeps_the_kit_s_promises(session: AsyncSession):
    inviter_id, user_id = await _two_accounts(session)
    store = SqlInvitationStore(session, Invitation)
    await check_invitation_store(store, inviter_id=inviter_id, user_id=user_id, role=Role.REVIEWER)


async def test_the_passkey_store_keeps_the_kit_s_promises(session: AsyncSession):
    user_id, other_user_id = await _two_accounts(session)
    store = SqlPasskeyStore(session, Passkey, SpentChallenge)
    await check_passkey_store(store, user_id=user_id, other_user_id=other_user_id)


async def test_the_admin_log_keeps_the_kit_s_promises(session: AsyncSession):
    actor_id, target_user_id = await _two_accounts(session)
    log = SqlAdminActionLog(session, AdminAction)
    await check_admin_action_log(log, actor_id=actor_id, target_user_id=target_user_id)


async def test_the_work_after_the_commit_keeps_the_kit_s_promises(session: AsyncSession):
    await check_after_commit(SqlAfterCommit(session), commit=session.commit, rollback=session.rollback)


@pytest.mark.parametrize("table", [User, Invitation])
async def test_the_database_holds_no_role_the_site_does_not_have(session: AsyncSession, table: type):
    """Whatever writes the row, a store or a hand in psql."""
    if table is User:
        row = User(email="x@example.com", password_hash="x", first_name="X", last_name="", locale="en", role="OWNER")
    else:
        row = Invitation(email="x@example.com", locale="en", role="admin")
    session.add(row)
    with pytest.raises(IntegrityError, match=r"ck_(users|invitations)_role"):
        await session.flush()
