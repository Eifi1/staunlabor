"""The accounts' tables: server-kit's ``[sql]`` mixins (0.29), named and constrained here.

Every column is the kit's (``eifi1_server_kit.auth.sql``): the account and its
second factor, its sessions, the mailed links, the invitations, the passkeys and the challenges
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
    TwoFactorColumns,
)
from eifi1_server_kit.feedback.sql import (
    FeedbackAttachmentColumns,
    FeedbackColumns,
    FeedbackCommentColumns,
    FeedbackReplyColumns,
    FeedbackVoteColumns,
)
from eifi1_server_kit.translation_review.sql import TranslationReviewColumns
from sqlalchemy import CheckConstraint, MetaData
from sqlalchemy.orm import DeclarativeBase

__all__ = [
    "NAMING_CONVENTION",
    "AdminAction",
    "Base",
    "Feedback",
    "FeedbackAttachment",
    "FeedbackComment",
    "FeedbackReply",
    "FeedbackVote",
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


class User(AccountColumns, TwoFactorColumns, Base):
    """An account, with its second factor beside it (server-kit 0.32's
    ``TwoFactorColumns``, migration 0004): off until the person switches it on in
    the settings; the secrets sealed (``Settings.totp_keys``), never in the clear."""

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


# ── Feedback (server-kit 0.31's feedback.sql): the reports, their conversation, the
# comments and votes of the public list, and who uploaded which file. Every column is the
# kit's; the keys follow the account table ("users") and the report table ("feedback"). ──


class Feedback(FeedbackColumns, Base):
    __tablename__ = "feedback"


class FeedbackReply(FeedbackReplyColumns, Base):
    __tablename__ = "feedback_replies"


class FeedbackComment(FeedbackCommentColumns, Base):
    __tablename__ = "feedback_comments"


class FeedbackVote(FeedbackVoteColumns, Base):
    __tablename__ = "feedback_votes"


class FeedbackAttachment(FeedbackAttachmentColumns, Base):
    __tablename__ = "feedback_attachments"


class TranslationReview(TranslationReviewColumns, Base):
    """One verdict on one string in one language: the review of the seven catalogues
    (``docs/translations.md``), on server-kit's ``translation_review.sql``."""

    __tablename__ = "translation_reviews"
