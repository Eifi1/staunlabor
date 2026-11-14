"""The accounts: server-kit's account layer (0.31) on this app's tables.

The kit runs every route (``auth_router``: sign-up, sign-in, the refresh, the
sessions, ``/auth/me`` and its settings, the mailed links, the passkeys;
``invitations_admin_router``: the admin's invitations; ``user_admin_router``:
the roster, its four actions, the reviewer scope, the log, the overview, the
mails and the operator's erasure), every rule, every refusal's code, the mails
in seven languages and their windows. What is here is what the kit leaves to
an app, and nothing more:

- the stores: the kit's ``[sql]`` stores over ``staunlabor.models``, each on
  the request's session (``staunlabor.database``);
- the signer and the hasher, the kit's own since 0.30 (``[jwt]``: HS256 pinned,
  ``exp`` required; ``[bcrypt]`` at the settings' cost), built from the settings;
- the transport: the console now (the whole mail on a laptop, its kind alone on
  a deployment), Resend once it has verified the domain;
- the policy: invitation-only. The first account claims an empty database
  through the allow-list and is the ADMIN; everybody after it holds an
  invitation, which names a MEMBER or a REVIEWER (:data:`INVITABLE_ROLES`), in
  one of the site's seven languages (:data:`LANGUAGES`);
- the passkeys' relying party, the site's own host;
- the admin's vocabulary: the role change gives every role but the reviewer (the
  kit's default), the reviewer comes with its languages and areas
  (:data:`REVIEW_AREAS`);
- the daily jobs' two halves the kit leaves to the app, because the transactions
  are its own (:func:`jobs_deps`): the kit's ``account_jobs_router`` prunes the
  rows done with for 30 days, on Cloud Scheduler's call with the jobs token.

**No hooks.** Nothing is attached at a sign-up, nothing bound per request, and
the app keeps no rows of its own that an export or a deletion must know about
(feedback and the translation review will bring some).

Not here: a second factor, a demo, teams, billing, and a scheduled erasure (an
operator erases, so the daily call has no erasures to run).
"""

from __future__ import annotations

from datetime import datetime

from eifi1_server_kit.auth import parse_env_list
from eifi1_server_kit.auth.bcrypt_hasher import BcryptHasher
from eifi1_server_kit.auth.jobs import AccountJobsDeps
from eifi1_server_kit.auth.jwt_signer import JwtSigner
from eifi1_server_kit.auth.passkeys import RelyingParty
from eifi1_server_kit.auth.router import AuthDeps
from eifi1_server_kit.auth.service import AccountLinks, AccountPolicy
from eifi1_server_kit.auth.sql import (
    AccountPrune,
    SqlAdminActionLog,
    SqlAfterCommit,
    SqlInvitationStore,
    SqlOneTimeTokenStore,
    SqlPasskeyStore,
    SqlRosterStore,
    SqlSessionStore,
    SqlUserStore,
    prune_account_rows,
)
from eifi1_server_kit.mail import ConsoleMailer, Mailer, ResendClient
from eifi1_server_kit.user_admin.deletion import DeletionMode
from eifi1_server_kit.user_admin.router import UserAdminDeps
from eifi1_server_kit.user_admin.service import AdminPolicy

from staunlabor.database import Database, RequestSession
from staunlabor.models import AdminAction, Invitation, OneTimeToken, Passkey, Role, SpentChallenge, User, UserSession
from staunlabor.security import caller_address
from staunlabor.settings import Settings

#: The site's languages, in its menu's order (``frontend/src/shared/i18n/languages.ts``):
#: the only ones a sign-up, an invitation or a profile may name (``AuthDeps.offered_locales``).
LANGUAGES = ("de-CH", "en", "es", "fr", "it", "hu", "zh")

#: The roles an invitation may name; any other is the kit's ``422 role_not_grantable``,
#: before a row is written. Never the admin: an invitation is a bearer link, mailed (or,
#: while the console stands in, handed on) and good for fourteen days, and whoever holds
#: it becomes what it names. An admin is made from an account that is already in, has
#: proved its address and signs in, by a role change an admin acknowledges, which the log
#: keeps and which never takes the last admin away.
INVITABLE_ROLES = (Role.MEMBER, Role.REVIEWER)

#: The areas a reviewer may be limited to, each a top-level namespace of the site's
#: catalogues (``frontend/src/shared/i18n/locales/*.json``): ``experiments``, the eight
#: exhibits' words and their physics (angular momentum, autoresonance, induction), which
#: want a physics teacher as much as a native reader; ``legal``, the imprint and the
#: privacy policy (and the kit's shared legal text under ``kit.legal.``), which want a
#: lawyer, as Kurvenschmiede's one area does. Not ``app``, ``common`` or ``site``: a
#: handful of the frame's words no specialist is needed for, which a reviewer without an
#: area limit reads. A closed list, because a scope is a promise about what somebody may
#: read, and a typo in one should be a 422 rather than a reviewer of nothing.
REVIEW_AREAS = ("experiments", "legal")


def mailer_for(settings: Settings) -> Mailer:
    if settings.mail_backend == "resend":
        return ResendClient(
            api_key=settings.resend_api_key, from_address=settings.mail_from, reply_to=settings.contact_email
        )
    # The whole mail, link included, only on a laptop, where a developer signs in by
    # it. A deployment logs the kind alone, the kit's default since 0.30: its log
    # stays in Cloud Logging for 30 days, where an unspent link is a credential and
    # the address is the person's; an admin's answer carries an invitation's or a
    # reset's link once instead.
    return ConsoleMailer(show_content=not settings.deployed)


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


async def roster(session: RequestSession) -> SqlRosterStore[User]:
    return SqlRosterStore(session, User)


def account_deps(settings: Settings) -> AuthDeps:
    """Everything ``auth_router`` and ``invitations_admin_router`` are built from,
    and ``user_admin_router`` beside them (:func:`admin_deps`)."""
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
            invitable_roles=INVITABLE_ROLES,
            bootstrap=parse_env_list(settings.registration_allowlist) or None,
            # An operator erases (``POST /admin/users/{id}/erase``, an account that
            # asked), and the deletion mail promises no date: the kit's erasure on a
            # date is a scheduled job this deployment does not run, so "erased for
            # good on <date>" would be a promise nothing here keeps.
            deletion_mode=DeletionMode.OPERATOR,
        ),
        relying_party=RelyingParty(
            rp_id=settings.webauthn_rp_id.strip().lower(),
            rp_name=settings.webauthn_rp_name,
            origins=(settings.site_origin,),
        ),
        offered_locales=LANGUAGES,
        client_address=caller_address,
    )


def admin_deps(accounts: AuthDeps) -> UserAdminDeps:
    """Everything ``user_admin_router`` is built from: the account layer's own, the
    roster, and the site's roles, languages and areas. The role change gives every
    role but the reviewer (the kit's default): an admin, or a member again. The
    reviewer comes with its languages through ``PUT /admin/users/{id}/reviewer``, so
    nobody is a reviewer of nothing. No guard of its own: the router takes the kit's
    ``admin_guard(accounts)``, the one ``invitations_admin_router`` has, so both admin
    routers refuse alike. No feedback and no hooks yet: an erasure has none of the
    app's rows to anonymise."""
    return UserAdminDeps(
        auth=accounts,
        roster=roster,
        policy=AdminPolicy(
            roles=tuple(role.value for role in Role),
            review_locales=LANGUAGES,
            review_areas=REVIEW_AREAS,
        ),
    )


def jobs_deps(database: Database, settings: Settings) -> AccountJobsDeps:
    """The daily call's jobs, ``POST /api/v1/ops/accounts/daily`` behind the jobs
    token (``X-Jobs-Token``), which Cloud Scheduler sends once a day.

    The kit fixes the retention (30 days, as the privacy policy says), the order
    and the answer; the app hands it the prune, because the transaction is its
    own: the sessions that ended or expired (each keeps the address it was signed
    in from and the browser's description), the links past their expiry, the
    invitations never accepted, the spent passkey challenges. Left alone they
    would stay for good, which no privacy policy can promise.

    No erasures: an operator erases (``DeletionMode.OPERATOR``). No upload sweep:
    no feedback yet."""

    async def prune(before: datetime) -> AccountPrune:
        async with database.sessions() as session, session.begin():
            return await prune_account_rows(
                before=before,
                sessions=SqlSessionStore(session, UserSession),
                passkeys=SqlPasskeyStore(session, Passkey, SpentChallenge),
                links=SqlOneTimeTokenStore(session, OneTimeToken),
                invitations=SqlInvitationStore(session, Invitation),
            )

    return AccountJobsDeps(token=lambda: settings.jobs_token, prune=prune)
