"""The accounts: server-kit's account layer (0.32) on this app's tables.

The kit runs every route (``auth_router``: sign-up, sign-in, the refresh, the
sessions, ``/auth/me`` and its settings, the mailed links, the passkeys, the
second factor; ``invitations_admin_router``: the admin's invitations;
``user_admin_router``: the roster, its four actions, the reviewer scope, the log,
the overview, the mails and the second factor's reset), every rule, every
refusal's code, the mails in seven languages and their windows. What is here is what the kit leaves to
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
- the second factor (0.32): offered to every account, switched on by the person
  in the settings and never required; its secrets sealed by the kit's
  ``SecretBox`` under the deployment's keys (``Settings.totp_keys``), on the
  account's own row (``TwoFactorColumns``). With the store, ``user_admin_router``
  mounts the admin's reset for an account that lost its authenticator and its
  backup codes;
- the admin's vocabulary: the role change gives every role but the reviewer (the
  kit's default), the reviewer comes with its languages and areas
  (:data:`REVIEW_AREAS`);
- the deletion: deactivated at once, erased by the daily call 30 days after the
  request (``DeletionMode.AFTER_DAYS``, Marcel 2026-11-15), unless an admin
  reactivates the account first;
- the daily jobs the kit leaves to the app, because the transactions are its own
  (:func:`jobs_deps`): the kit's ``account_jobs_router`` runs the due erasures,
  prunes the rows done with for 30 days and sweeps the uploads no report names,
  on Cloud Scheduler's call with the jobs token.

**One hook:** an erasure removes the files the person attached to feedback from
the store, once it has committed (``feedback.erased_files_purge``). Nothing is
attached at a sign-up and nothing bound per request; the rows feedback and the
translation review keep are the kit's to anonymise (``admin_deps``) or keep
without the name (a review's ``reviewer_id`` is ``SET NULL``).

Not here: a demo, teams (Marcel 2026-11-15: no), billing, and an operator's
erasure by hand (the job erases).
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from datetime import datetime
from typing import Any

from eifi1_server_kit.auth import parse_env_list
from eifi1_server_kit.auth.bcrypt_hasher import BcryptHasher
from eifi1_server_kit.auth.jobs import AccountJobsDeps
from eifi1_server_kit.auth.jwt_signer import JwtSigner
from eifi1_server_kit.auth.limits import AuthLimiters
from eifi1_server_kit.auth.passkeys import RelyingParty
from eifi1_server_kit.auth.router import AuthDeps
from eifi1_server_kit.auth.seal import SecretBox
from eifi1_server_kit.auth.service import AccountLinks, AccountPolicy, AccountService, AuthHooks
from eifi1_server_kit.auth.sql import (
    AccountPrune,
    SqlAdminActionLog,
    SqlAfterCommit,
    SqlInvitationStore,
    SqlOneTimeTokenStore,
    SqlPasskeyStore,
    SqlRosterStore,
    SqlSessionStore,
    SqlTwoFactorStore,
    SqlUserStore,
    prune_account_rows,
)
from eifi1_server_kit.mail import ConsoleMailer, Mailer, ResendClient
from eifi1_server_kit.objects import purge_objects
from eifi1_server_kit.user_admin.deletion import DeletionMode
from eifi1_server_kit.user_admin.router import UserAdminDeps
from eifi1_server_kit.user_admin.service import AdminPolicy, ErasureRun, erase_due_accounts
from sqlalchemy.ext.asyncio import AsyncSession

from staunlabor.database import Database, RequestSession
from staunlabor.feedback import (
    admin_hooks,
    attachment_storage_on,
    erased_files_purge,
    erasing_feedback,
    objects_for,
)
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
#: catalogues (``frontend/src/shared/i18n/locales/*.json``): ``experiments``, the
#: exhibits' words and their physics (angular momentum, autoresonance, induction), which
#: want a physics teacher as much as a native reader; ``legal``, the imprint and the
#: privacy policy (and the kit's shared legal text under ``kit.legal.``), which want a
#: lawyer, as Kurvenschmiede's one area does. Not ``app``, ``common``, ``site`` or
#: ``account``: the frame's and the account pages' words, no specialist needed, which a
#: reviewer without an area limit reads. ``course``, the basics' mathematics (the lessons
#: moved in from Kurvenschmiede), wants a mathematics teacher as ``experiments`` wants a
#: physics one (Marcel, 2026-11-22). A closed list, because a scope is a promise about what somebody may
#: read, and a typo in one should be a 422 rather than a reviewer of nothing.
REVIEW_AREAS = ("course", "experiments", "legal")


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


async def two_factor(session: RequestSession) -> SqlTwoFactorStore[User]:
    return SqlTwoFactorStore(session, User)


async def admin_log(session: RequestSession) -> SqlAdminActionLog[AdminAction]:
    return SqlAdminActionLog(session, AdminAction)


async def after_commit(session: RequestSession) -> SqlAfterCommit:
    return SqlAfterCommit(session)


async def roster(session: RequestSession) -> SqlRosterStore[User]:
    return SqlRosterStore(session, User)


def hooks_for(database: Database, settings: Settings) -> Callable[[], Awaitable[AuthHooks]]:
    """The account layer's hooks: the erasure's purge of the person's feedback files."""
    hooks: AuthHooks = AuthHooks(purge_files=erased_files_purge(database, settings))

    async def account_hooks() -> AuthHooks:
        return hooks

    return account_hooks


def account_deps(database: Database, settings: Settings) -> AuthDeps:
    """Everything ``auth_router`` and ``invitations_admin_router`` are built from,
    and ``user_admin_router`` beside them (:func:`admin_deps`)."""
    return AuthDeps(
        hooks=hooks_for(database, settings),
        users=users,
        sessions=sessions,
        tokens=links,
        invitations=invitations,
        log=admin_log,
        after_commit=after_commit,
        passkeys=passkeys,
        two_factor=two_factor,
        secret_seal=SecretBox(settings.totp_keys),
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
            # The daily call erases an account 30 days after it asked (Marcel,
            # 2026-11-15: no promise an admin has to keep by hand), and the
            # deletion mail names that day. Until then an admin's reactivation
            # keeps the account. The kit's default days, 30, as the privacy
            # policy says.
            deletion_mode=DeletionMode.AFTER_DAYS,
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
    routers refuse alike. The overview counts the feedback reports waiting
    (``admin_hooks``). No erasure route: the daily call erases (:func:`jobs_deps`),
    so the kit mounts none and needs no feedback flow here."""
    return UserAdminDeps(
        auth=accounts,
        roster=roster,
        hooks=admin_hooks,
        policy=AdminPolicy(
            roles=tuple(role.value for role in Role),
            review_locales=LANGUAGES,
            review_areas=REVIEW_AREAS,
        ),
    )


def jobs_deps(database: Database, settings: Settings, accounts: AuthDeps) -> AccountJobsDeps:
    """The daily call's jobs, ``POST /api/v1/ops/accounts/daily`` behind the jobs
    token (``X-Jobs-Token``), which Cloud Scheduler sends once a day. The kit fixes
    the retention (30 days, as the privacy policy says), the order and the answer;
    the app hands it the three jobs, because the transactions are its own:

    * **the due erasures** (``DeletionMode.AFTER_DAYS``, Marcel 2026-11-15): an
      account whose deletion was asked 30 days ago is erased, one per transaction,
      on the account layer's own flow (``erase_if_due`` re-reads the row, so an
      admin's reactivation in the meantime keeps it) — its feedback anonymised, its
      files removed after the commit (:func:`hooks_for`);
    * **the prune**: the sessions that ended or expired (each keeps the address it
      was signed in from and the browser's description), the links past their
      expiry, the invitations never accepted, the spent passkey challenges. Left
      alone they would stay for good, which no privacy policy can promise;
    * **the upload sweep**: a file uploaded and named by no report after a day
      (``UPLOAD_WAIT``), its object removed after the commit — what the erasure's
      purge spared because it was written in the last minutes ends here too."""
    objects = objects_for(settings)

    def accounts_on(session: AsyncSession, hooks: AuthHooks) -> AccountService[User, Any, Any]:
        """The account layer's service on a session of the job's own, with no request."""
        return AccountService(
            users=SqlUserStore(session, User),
            sessions=SqlSessionStore(session, UserSession),
            tokens=SqlOneTimeTokenStore(session, OneTimeToken),
            invitations=SqlInvitationStore(session, Invitation),
            log=SqlAdminActionLog(session, AdminAction),
            after_commit=SqlAfterCommit(session),
            signer=accounts.signer,
            hasher=accounts.hasher,
            mailer=accounts.mailer,
            policy=accounts.policy,
            limiters=AuthLimiters(),
            hooks=hooks,
            passkeys=SqlPasskeyStore(session, Passkey, SpentChallenge),
            relying_party=accounts.relying_party,
            two_factor=SqlTwoFactorStore(session, User),
            secret_seal=accounts.secret_seal,
        )

    async def erase_one(user_id: int) -> bool:
        # The account layer's own hooks (hooks_for), built once: the files' purge.
        hooks = await accounts.hooks()
        async with database.sessions() as session, session.begin():
            return await accounts_on(session, hooks).erase_if_due(user_id, feedback=await erasing_feedback(session))

    async def erase_due() -> ErasureRun:
        async with database.sessions() as session:
            ids = await SqlRosterStore(session, User).deletion_requested()
        return await erase_due_accounts(ids, erase_one)

    async def prune(before: datetime) -> AccountPrune:
        async with database.sessions() as session, session.begin():
            return await prune_account_rows(
                before=before,
                sessions=SqlSessionStore(session, UserSession),
                passkeys=SqlPasskeyStore(session, Passkey, SpentChallenge),
                links=SqlOneTimeTokenStore(session, OneTimeToken),
                invitations=SqlInvitationStore(session, Invitation),
            )

    async def sweep_uploads(before: datetime) -> int:
        async with database.sessions() as session, session.begin():
            storage = attachment_storage_on(session, objects)
            swept = await storage.prune(before=before)
        await purge_objects(objects, [storage.object_key(key) for key in swept.keys], reason="upload_sweep")
        return swept.uploads

    return AccountJobsDeps(
        token=lambda: settings.jobs_token, prune=prune, erase_due=erase_due, sweep_uploads=sweep_uploads
    )
