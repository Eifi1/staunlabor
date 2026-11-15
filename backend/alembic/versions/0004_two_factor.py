"""two factor: server-kit 0.32's TwoFactorColumns on the account

Revision ID: 0004
Revises: 0003
Create Date: 2026-11-15

The second factor every account may switch on in its settings, on the account's
own row: on or off, the live secret and the pending one (sealed by
``Settings.totp_keys``, never in the clear), the last accepted time step (a code
is good once), and the backup codes' digests. ``staunlabor.models.User`` mixes in
server-kit's ``TwoFactorColumns``; ``tests/api/test_migrations.py`` holds this
to the models.

``totp_enabled`` is NOT NULL, so the accounts already there need a value when it
is added: ``false`` as a server default for the ``ADD COLUMN``, dropped at once
after, because the kit's column declares none and the comparison would flag it.
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0004"
down_revision: str | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("users", sa.Column("totp_enabled", sa.Boolean(), server_default=sa.false(), nullable=False))
    op.alter_column("users", "totp_enabled", server_default=None)
    op.add_column("users", sa.Column("totp_secret", sa.String(length=255), nullable=True))
    op.add_column("users", sa.Column("totp_pending_secret", sa.String(length=255), nullable=True))
    op.add_column("users", sa.Column("totp_last_step", sa.BigInteger(), nullable=True))
    op.add_column(
        "users",
        sa.Column(
            "totp_backup_codes",
            sa.JSON(none_as_null=True).with_variant(
                postgresql.JSONB(none_as_null=True, astext_type=sa.Text()), "postgresql"
            ),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("users", "totp_backup_codes")
    op.drop_column("users", "totp_last_step")
    op.drop_column("users", "totp_pending_secret")
    op.drop_column("users", "totp_secret")
    op.drop_column("users", "totp_enabled")
