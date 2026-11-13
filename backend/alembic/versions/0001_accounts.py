"""accounts: server-kit 0.29's account tables, from an empty database

Revision ID: 0001
Revises:
Create Date: 2026-11-13

The tables of ``staunlabor.models``, which are server-kit's ``[sql]`` mixins:
the accounts, their sessions, the mailed links, the invitations, the passkeys
and the challenges they answered, and the admin log. Written out rather than
imported, because a revision describes the schema as it was and has to outlive
the code that is current today; ``tests/api/test_migrations.py`` holds it to the
models.

Every instant is ``timestamptz``: the kit reads and writes it through a type of
its own that keeps it in UTC, which the database never sees. Every default is
the application's, none the database's (the kit's columns declare none).
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

#: The kit's JSON column: JSONB on PostgreSQL.
_JSON = sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), "postgresql")
_ROLES = "'ADMIN', 'MEMBER', 'REVIEWER'"


def _instant(name: str, *, nullable: bool) -> sa.Column:
    return sa.Column(name, sa.DateTime(timezone=True), nullable=nullable)


def _account_key(name: str, *, table: str, ondelete: str, nullable: bool) -> list[sa.SchemaItem]:
    """A column pointing at an account, and its foreign key."""
    return [
        sa.Column(name, sa.Integer(), nullable=nullable),
        sa.ForeignKeyConstraint([name], ["users.id"], name=f"fk_{table}_{name}_users", ondelete=ondelete),
    ]


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("first_name", sa.String(length=120), nullable=False),
        sa.Column("last_name", sa.String(length=120), nullable=False),
        sa.Column("locale", sa.String(length=16), nullable=False),
        sa.Column("role", sa.String(length=16), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        _instant("email_verified_at", nullable=True),
        _instant("password_change_required_at", nullable=True),
        _instant("deletion_requested_at", nullable=True),
        _instant("deletion_scheduled_at", nullable=True),
        _instant("last_login_at", nullable=True),
        sa.Column("text_size", sa.String(length=8), nullable=True),
        sa.Column("contrast", sa.String(length=8), nullable=True),
        sa.Column("device_timezone", sa.String(length=64), nullable=True),
        sa.Column("translation_review_locales", _JSON, nullable=True),
        sa.Column("translation_review_areas", _JSON, nullable=True),
        _instant("created_at", nullable=False),
        sa.CheckConstraint(f"role IN ({_ROLES})", name="ck_users_role"),
        sa.PrimaryKeyConstraint("id", name="pk_users"),
    )
    # One account per address: the address is stored normalised.
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    op.create_table(
        "user_sessions",
        sa.Column("sid", sa.String(length=64), nullable=False),
        *_account_key("user_id", table="user_sessions", ondelete="CASCADE", nullable=False),
        sa.Column("device", sa.String(length=255), nullable=True),
        sa.Column("ip_address", sa.String(length=45), nullable=True),
        _instant("started_at", nullable=False),
        _instant("last_active", nullable=False),
        sa.Column("shared_device", sa.Boolean(), nullable=False),
        _instant("expires_at", nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.PrimaryKeyConstraint("sid", name="pk_user_sessions"),
    )
    op.create_index("ix_user_sessions_user_id", "user_sessions", ["user_id"])
    op.create_index("ix_user_sessions_expires_at", "user_sessions", ["expires_at"])

    op.create_table(
        "one_time_tokens",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("kind", sa.String(length=32), nullable=False),
        *_account_key("user_id", table="one_time_tokens", ondelete="CASCADE", nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        _instant("expires_at", nullable=False),
        _instant("created_at", nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_one_time_tokens"),
        # One link per account and kind: a new one replaces the old.
        sa.UniqueConstraint("user_id", "kind", name="uq_one_time_tokens_user_id_kind"),
    )
    op.create_index("ix_one_time_tokens_user_id", "one_time_tokens", ["user_id"])
    op.create_index("ix_one_time_tokens_token_hash", "one_time_tokens", ["token_hash"], unique=True)

    op.create_table(
        "invitations",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("role", sa.String(length=16), nullable=True),
        sa.Column("scope", _JSON, nullable=True),
        sa.Column("token_hash", sa.String(length=64), nullable=True),
        _instant("expires_at", nullable=True),
        _instant("accepted_at", nullable=True),
        *_account_key("accepted_by_user_id", table="invitations", ondelete="SET NULL", nullable=True),
        _instant("revoked_at", nullable=True),
        *_account_key("invited_by_user_id", table="invitations", ondelete="SET NULL", nullable=True),
        sa.Column("locale", sa.String(length=16), nullable=False),
        sa.Column("note", sa.String(length=255), nullable=True),
        _instant("created_at", nullable=False),
        sa.CheckConstraint(f"role IS NULL OR role IN ({_ROLES})", name="ck_invitations_role"),
        sa.PrimaryKeyConstraint("id", name="pk_invitations"),
    )
    op.create_index("ix_invitations_email", "invitations", ["email"])
    op.create_index("ix_invitations_token_hash", "invitations", ["token_hash"], unique=True)

    op.create_table(
        "passkeys",
        sa.Column("id", sa.Integer(), nullable=False),
        *_account_key("user_id", table="passkeys", ondelete="CASCADE", nullable=False),
        sa.Column("credential_id", sa.LargeBinary(), nullable=False),
        sa.Column("public_key", sa.LargeBinary(), nullable=False),
        # An unsigned 32-bit counter: past a signed INTEGER's range.
        sa.Column("sign_count", sa.BigInteger(), nullable=False),
        sa.Column("transports", sa.String(length=255), nullable=True),
        sa.Column("name", sa.String(length=120), nullable=False),
        _instant("last_used_at", nullable=True),
        _instant("created_at", nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_passkeys"),
    )
    op.create_index("ix_passkeys_user_id", "passkeys", ["user_id"])
    op.create_index("ix_passkeys_credential_id", "passkeys", ["credential_id"], unique=True)

    op.create_table(
        "spent_challenges",
        # The primary key is the one-use rule: a challenge is answered once.
        sa.Column("challenge_hash", sa.String(length=64), nullable=False),
        _instant("expires_at", nullable=False),
        sa.PrimaryKeyConstraint("challenge_hash", name="pk_spent_challenges"),
    )
    op.create_index("ix_spent_challenges_expires_at", "spent_challenges", ["expires_at"])

    op.create_table(
        "admin_actions",
        sa.Column("id", sa.Integer(), nullable=False),
        _instant("at", nullable=False),
        *_account_key("actor_id", table="admin_actions", ondelete="SET NULL", nullable=True),
        sa.Column("action", sa.String(length=40), nullable=False),
        *_account_key("target_user_id", table="admin_actions", ondelete="SET NULL", nullable=True),
        sa.Column("target_email", sa.String(length=320), nullable=True),
        sa.Column("detail", _JSON, nullable=False),
        sa.Column("target_group_id", sa.Integer(), nullable=True),
        sa.Column("target_group_name", sa.String(length=120), nullable=True),
        sa.Column("scope", _JSON, nullable=True),
        sa.PrimaryKeyConstraint("id", name="pk_admin_actions"),
    )
    op.create_index("ix_admin_actions_at", "admin_actions", ["at"])
    op.create_index("ix_admin_actions_target_user_id", "admin_actions", ["target_user_id"])


def downgrade() -> None:
    for table in ("admin_actions", "spent_challenges", "passkeys", "invitations", "one_time_tokens", "user_sessions"):
        op.drop_table(table)
    op.drop_table("users")
