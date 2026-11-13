"""The accounts' tables: server-kit's ``[sql]`` mixins (0.29), named and constrained here.

Every column is the kit's (``eifi1_server_kit.auth.sql``): the account, its
sessions, the mailed links, the invitations, the passkeys and the challenges
they answered, and the admin log. What this module adds is what the kit leaves
to the app: the tables' names, the declarative base and its naming convention
(so the models and migration 0001 name every constraint alike), and the one
role per account among :class:`Role`'s three.

What it deliberately leaves out: the kit's ``DemoAccountColumn`` (the site has
no demo) and ``SessionCutoffColumn`` (a new app ends sessions through their
rows, never by an ``iat`` cut-off). A table of the app's own comes with the
feature that needs it (feedback, the translation review), in a migration of
its own.
"""

from __future__ import annotations

from enum import StrEnum

from eifi1_server_kit.auth.sql import (
    AccountColumns,
    AdminActionColumns,
    InvitationColumns,
    OneTimeTokenColumns,
    PasskeyColumns,
    SessionColumns,
    SpentChallengeColumns,
)
from sqlalchemy import CheckConstraint, MetaData
from sqlalchemy.orm import DeclarativeBase

__all__ = [
    "NAMING_CONVENTION",
    "AdminAction",
    "Base",
    "Invitation",
    "OneTimeToken",
    "Passkey",
    "Role",
    "SpentChallenge",
    "User",
    "UserSession",
]


class Role(StrEnum):
    """The one role an account holds. The first account is the ADMIN (the
    allow-list's); an invitation names the role of everybody after it."""

    ADMIN = "ADMIN"
    MEMBER = "MEMBER"
    REVIEWER = "REVIEWER"


#: The kit leaves its constraints unnamed so the app's convention names them;
#: these names are the ones migration 0001 spells, and Alembic's comparison of
#: the two (``tests/api/test_migrations.py``) holds them together.
NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_N_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING_CONVENTION)


def _roles(column: str, *, nullable: bool = False) -> CheckConstraint:
    """The column holds one of the roles: the database's own refusal of a role
    the app does not have, whatever wrote it."""
    allowed = ", ".join(f"'{role}'" for role in Role)
    condition = f"{column} IN ({allowed})"
    return CheckConstraint(f"{column} IS NULL OR {condition}" if nullable else condition, name="role")


class User(AccountColumns, Base):
    __tablename__ = "users"
    __table_args__ = (_roles("role"),)


class UserSession(SessionColumns, Base):
    __tablename__ = "user_sessions"


class OneTimeToken(OneTimeTokenColumns, Base):
    __tablename__ = "one_time_tokens"


class Invitation(InvitationColumns, Base):
    __tablename__ = "invitations"
    #: ``None`` is the kit's "the default role", MEMBER.
    __table_args__ = (_roles("role", nullable=True),)


class Passkey(PasskeyColumns, Base):
    __tablename__ = "passkeys"


class SpentChallenge(SpentChallengeColumns, Base):
    __tablename__ = "spent_challenges"


class AdminAction(AdminActionColumns, Base):
    __tablename__ = "admin_actions"
