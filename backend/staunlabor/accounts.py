"""The accounts: server-kit's account layer (0.30) on this app's tables.

The kit runs every route (``auth_router``: sign-up, sign-in, the refresh, the
sessions, ``/auth/me`` and its settings, the mailed links, the passkeys;
``invitations_admin_router``: the admin's invitations), every rule, every
refusal's code, the mails in seven languages and their windows. What is here is
what the kit leaves to an app, and nothing more:

- the stores: the kit's ``[sql]`` stores over ``staunlabor.models``, each on
  the request's session (``staunlabor.database``);
- the signer and the hasher, the kit's own since 0.30 (``[jwt]``: HS256 pinned,
  ``exp`` required; ``[bcrypt]`` at the settings' cost), built from the settings;
- the transport: the console now (the whole mail on a laptop, its kind alone on
  a deployment), Resend once it has verified the domain;
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

from eifi1_server_kit.auth import parse_env_list
from eifi1_server_kit.auth.bcrypt_hasher import BcryptHasher
from eifi1_server_kit.auth.jwt_signer import JwtSigner
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


def mailer_for(settings: Settings) -> Mailer:
    if settings.mail_backend == "resend":
        return ResendClient(
            api_key=settings.resend_api_key, from_address=settings.mail_from, reply_to=settings.contact_email
        )
    # The whole mail, link included, only on a laptop, where a developer signs in by
    # it. A deployment logs the kind alone, the kit's default since 0.30: its log
    # stays in Cloud Logging for 30 days, where an unspent link is a credential and
    # the address is the person's; an admin's answer carries an invitation's or a
    # reset's link once instead. WARNING, not the kit's INFO, on both: nothing
    # configures this app's log levels (uvicorn sets only its own), so an INFO line
    # would show nowhere.
    return ConsoleMailer(level=logging.WARNING, show_content=not settings.deployed)


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
