"""The accounts: server-kit 0.29's account layer on this app's tables.

The kit runs every route (``auth_router``: sign-up, sign-in, the refresh, the
sessions, ``/auth/me`` and its settings, the mailed links, the passkeys;
``invitations_admin_router``: the admin's invitations), every rule, every
refusal's code, the mails in seven languages and their windows. What is here is
what the kit leaves to an app, and nothing more:

- the stores: the kit's ``[sql]`` stores over ``staunlabor.models``, each on
  the request's session (``staunlabor.database``);
- the two ports the kit keeps no library for: the signer (PyJWT, HS256) and
  the hasher (bcrypt);
- the transport: the console now, Resend once it has verified the domain;
- the policy: invitation-only. The first account claims an empty database
  through the allow-list and is the ADMIN; everybody after it holds an
  invitation, which names the role among :class:`~staunlabor.models.Role`'s;
- the passkeys' relying party, the site's own host.

**No hooks.** Nothing is attached at a sign-up, nothing bound per request, and
the app keeps no rows of its own that an export or a deletion must know about
(feedback and the translation review will bring some).

Not here: user administration (server-kit 0.30), a second factor, a demo,
teams, billing.
"""

from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Any

import bcrypt
import jwt
from eifi1_server_kit.auth import parse_env_list
from eifi1_server_kit.auth.passkeys import RelyingParty
from eifi1_server_kit.auth.router import AuthDeps
from eifi1_server_kit.auth.service import AccountLinks, AccountPolicy
from eifi1_server_kit.auth.sql import (
    SqlAdminActionLog,
    SqlAfterCommit,
    SqlInvitationStore,
    SqlOneTimeTokenStore,
    SqlPasskeyStore,
    SqlSessionStore,
    SqlUserStore,
)
from eifi1_server_kit.mail import ConsoleMailer, Mailer, ResendClient
from eifi1_server_kit.settings import profile_update_model
from eifi1_server_kit.user_admin import InvitationCreate as KitInvitationCreate
from eifi1_server_kit.user_admin.deletion import DeletionMode

from staunlabor.database import RequestSession
from staunlabor.models import AdminAction, Invitation, OneTimeToken, Passkey, Role, SpentChallenge, User, UserSession
from staunlabor.security import caller_address
from staunlabor.settings import Settings

#: The site's languages, in its menu's order (``frontend/src/shared/i18n/languages.ts``).
LANGUAGES = ("de-CH", "en", "es", "fr", "it", "hu", "zh")

#: The only algorithm a token is signed or accepted with: a token naming another
#: (``none``, an asymmetric one) is refused, never tried.
_ALGORITHM = "HS256"


class JwtSigner:
    """The kit's ``TokenSigner``: its claims, signed with PyJWT."""

    def __init__(self, secret: str) -> None:
        self._secret = secret

    def sign(self, claims: Mapping[str, Any]) -> str:
        return jwt.encode(dict(claims), self._secret, algorithm=_ALGORITHM)

    def verify(self, token: str) -> Mapping[str, Any] | None:
        try:
            # Every token the kit mints ends; one without `exp` was not this app's.
            return jwt.decode(token, self._secret, algorithms=[_ALGORITHM], options={"require": ["exp", "sub"]})
        except jwt.PyJWTError:
            # A bad signature, an expired token, not a JWT at all: one answer.
            return None


class BcryptHasher:
    """The kit's ``PasswordHasher``: bcrypt at the settings' cost."""

    def __init__(self, rounds: int) -> None:
        self._rounds = rounds

    def hash(self, password: str) -> str:
        return bcrypt.hashpw(password.encode(), bcrypt.gensalt(self._rounds)).decode()

    def verify(self, password: str, password_hash: str) -> bool:
        try:
            return bcrypt.checkpw(password.encode(), password_hash.encode())
        except ValueError:
            # A malformed hash, or a password bcrypt refuses (over 72 bytes, which
            # the kit's schemas already turn away): no match, never a 500.
            return False


def mailer_for(settings: Settings) -> Mailer:
    if settings.mail_backend == "resend":
        return ResendClient(
            api_key=settings.resend_api_key, from_address=settings.mail_from, reply_to=settings.contact_email
        )
    # WARNING, not the kit's INFO: nothing configures this app's log levels, so
    # an INFO line, the one with the link a developer signs in by, would not show.
    return ConsoleMailer(level=logging.WARNING)


class InvitationCreate(KitInvitationCreate):
    """The admin's invitation, its role one of the site's three: the kit takes
    any role name, and an account made through ``"MEMBR"`` would hold a role no
    page knows (the database's own CHECK refuses it too, as a 500)."""

    role: Role


# ── The stores, each on the request's session ────────────────────────────────


async def users(session: RequestSession) -> SqlUserStore[User]:
    return SqlUserStore(session, User)


async def sessions(session: RequestSession) -> SqlSessionStore[UserSession]:
    return SqlSessionStore(session, UserSession)


async def links(session: RequestSession) -> SqlOneTimeTokenStore[OneTimeToken]:
    return SqlOneTimeTokenStore(session, OneTimeToken)


async def invitations(session: RequestSession) -> SqlInvitationStore[Invitation]:
    return SqlInvitationStore(session, Invitation)


async def passkeys(session: RequestSession) -> SqlPasskeyStore[Passkey, SpentChallenge]:
    return SqlPasskeyStore(session, Passkey, SpentChallenge)


async def admin_log(session: RequestSession) -> SqlAdminActionLog[AdminAction]:
    return SqlAdminActionLog(session, AdminAction)


async def after_commit(session: RequestSession) -> SqlAfterCommit:
    return SqlAfterCommit(session)


def account_deps(settings: Settings) -> AuthDeps:
    """Everything ``auth_router`` and ``invitations_admin_router`` are built from."""
    return AuthDeps(
        users=users,
        sessions=sessions,
        tokens=links,
        invitations=invitations,
        log=admin_log,
        after_commit=after_commit,
        passkeys=passkeys,
        signer=JwtSigner(settings.jwt_secret),
        hasher=BcryptHasher(settings.bcrypt_rounds),
        mailer=mailer_for(settings),
        mail_backend=settings.mail_backend,
        policy=AccountPolicy(
            app="staunlabor",
            app_name="Staunlabor",
            links=AccountLinks(base_url=settings.app_base_url),
            contact=settings.contact_email,
            admin_role=Role.ADMIN,
            default_role=Role.MEMBER,
            bootstrap=parse_env_list(settings.registration_allowlist) or None,
            # An operator erases, and the mail promises no date: server-kit 0.29
            # has no erasure, so "erased for good on <date>" would be a promise
            # nothing here keeps.
            deletion_mode=DeletionMode.OPERATOR,
        ),
        relying_party=RelyingParty(
            rp_id=settings.webauthn_rp_id.strip().lower(),
            rp_name=settings.webauthn_rp_name,
            origins=(settings.site_origin,),
        ),
        profile_model=profile_update_model(LANGUAGES),
        invitation_create_model=InvitationCreate,
        client_address=caller_address,
    )
