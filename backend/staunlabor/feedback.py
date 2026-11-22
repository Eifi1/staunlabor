"""Feedback: server-kit's feedback layer (0.31) on this app's tables.

The kit runs every route (``feedback_router``: a report and its files, the
admin's inbox and its replies, the author's own list and reworks, and the public
list with its comments and votes), every rule and every refusal. What is here is
what the kit leaves to an app, and nothing more:

- the stores: ``feedback.sql``'s, over ``staunlabor.models``, each on the
  request's session, with the uploads table so a writer names only a file they
  uploaded;
- the files' bytes: a Cloud Storage bucket on a deployment
  (``settings.feedback_bucket``), a directory on a laptop
  (``settings.feedback_files_dir``);
- who is who: the signed-in account (server-kit's ``app_feedback_actor``, on the
  ``current_user`` the account routes use) as the feedback's actor, an ADMIN as its
  admin;
- who sees the public list: everybody signed in, since every account here came
  by invitation.

No demo, so no demo guard refuses anything; no mails yet (a reply or a comment
tells nobody), so no alerts. The reports are the site's own to-do list too:
the planned exhibits are filed here as ideas (plan, second stage).
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable, Sequence
from functools import lru_cache
from typing import Any

from eifi1_server_kit.auth.router import app_admin, app_feedback_actor
from eifi1_server_kit.feedback import AttachmentUrlPolicy, FeedbackActor, feedback_attention
from eifi1_server_kit.feedback.router import FeedbackDeps
from eifi1_server_kit.feedback.service import FeedbackService
from eifi1_server_kit.feedback.sql import (
    SqlAttachmentStorage,
    SqlFeedbackCommentStore,
    SqlFeedbackReplyStore,
    SqlFeedbackRepository,
    SqlFeedbackVoteStore,
    SqlPeopleLookup,
)
from eifi1_server_kit.objects import GcsObjectStore, LocalObjectStore, ObjectStore, purge_objects
from eifi1_server_kit.user_admin.service import UserAdminHooks
from sqlalchemy.ext.asyncio import AsyncSession

from staunlabor.database import Database, RequestSession
from staunlabor.models import (
    Feedback,
    FeedbackAttachment,
    FeedbackComment,
    FeedbackReply,
    FeedbackVote,
    User,
)
from staunlabor.settings import Settings

#: The kit's default: the files' URLs under the mounted feedback router.
POLICY = AttachmentUrlPolicy()


def everybody_signed_in(actor: FeedbackActor) -> bool:
    """Who sees the public list: every account, since each came by invitation."""
    return True


def no_demo(_scope: str) -> Any:
    """The demo guard's factory, for a site without a demo: a guard that refuses nothing."""

    async def nothing_to_refuse() -> None:
        return None

    return nothing_to_refuse


def objects_for(settings: Settings) -> ObjectStore:
    """Where the files' bytes go: the deployment's bucket, or a directory on this machine."""
    if settings.feedback_bucket:
        return _bucket(settings.feedback_bucket)
    return LocalObjectStore(settings.feedback_files_dir)


@lru_cache
def _bucket(name: str) -> GcsObjectStore:
    """One store, so one Cloud Storage client, per process: the routes, the erasure's purge
    and the daily sweep each ask for the store, and each client keeps its own connections."""
    return GcsObjectStore(name)


def attachment_storage_on(session: AsyncSession, objects: ObjectStore) -> SqlAttachmentStorage[FeedbackAttachment]:
    """The files and who uploaded which, on a session: the routes', the erasure's purge's
    and the daily sweep's alike, so all three read the reports, entries and comments that
    name a file the same way."""
    return SqlAttachmentStorage(
        session,
        FeedbackAttachment,
        objects=objects,
        reports=Feedback,
        replies=FeedbackReply,
        comments=FeedbackComment,
        policy=POLICY,
        public_viewer=everybody_signed_in,
    )


def erased_files_purge(database: Database, settings: Settings) -> Callable[[Sequence[str]], Awaitable[None]]:
    """What an erasure does with the files the person attached (``AuthHooks.purge_files``):
    removes them from the store after the erasure has committed. Without it the rows would
    lose the files' names and the files would stay in the store for good, which the privacy
    policy does not say.

    The kit hands over the keys no report, entry or comment names any more; but a file's key
    is its content's, so the same bytes somebody else uploaded and has not filed yet (an
    upload waits a day for its report) are the same object. So the keys an upload of a
    living account still holds are kept (server-kit's ``keys_in_use``, asked on a session of
    its own, since the hook runs after the erasure's commit).

    The kit's purge never raises (the database is already emptied) and logs every key it
    could not remove, to remove by hand. It spares a file written in the last five minutes,
    which an upload of the same bytes may be about to name."""
    objects = objects_for(settings)

    async def purge(keys: Sequence[str]) -> None:
        async with database.sessions() as session:
            storage = attachment_storage_on(session, objects)
            held = await storage.keys_in_use(keys)
        await purge_objects(
            objects,
            [storage.object_key(key) for key in keys if key not in held],
            reason="an erased account's feedback files",
        )

    return purge


def repository_on(session: AsyncSession) -> SqlFeedbackRepository[Feedback]:
    """The reports on a session: the router's, the erasure's and the counts' alike."""
    return SqlFeedbackRepository(
        session,
        Feedback,
        accounts=User,
        policy=POLICY,
        replies=FeedbackReply,
        comments=FeedbackComment,
        votes=FeedbackVote,
        uploads=FeedbackAttachment,
    )


def replies_on(session: AsyncSession) -> SqlFeedbackReplyStore[FeedbackReply]:
    return SqlFeedbackReplyStore(session, FeedbackReply, uploads=FeedbackAttachment, policy=POLICY)


def comments_on(session: AsyncSession) -> SqlFeedbackCommentStore[FeedbackComment]:
    return SqlFeedbackCommentStore(session, FeedbackComment, uploads=FeedbackAttachment, policy=POLICY)


async def erasing_feedback(session: RequestSession) -> FeedbackService[Feedback]:
    """The kit's feedback flows on the request's session, for the admin's ``Erase now``
    (``UserAdminDeps.feedback``): the erasure anonymises what the person wrote — their reports,
    replies and comments, their name in them, the files they uploaded — through it, in the
    erasure's own transaction. Without it the rows would stay as written, the account gone."""
    return FeedbackService(
        repository_on(session),
        policy=POLICY,
        replies=replies_on(session),
        comments=comments_on(session),
        votes=SqlFeedbackVoteStore(session, FeedbackVote),
        people=SqlPeopleLookup(session, User),
        public_viewer=everybody_signed_in,
    )


async def admin_hooks(session: RequestSession) -> UserAdminHooks[User]:
    """The admin's hooks on the request's session (``UserAdminDeps.hooks``): the overview's
    "To triage" tile, the reports nobody has looked at yet (``OPEN``, by the kit's
    ``feedback_attention``) — the planned exhibits filed as ideas among them."""

    async def attention(_admin: User) -> dict[str, Any]:
        tiles = feedback_attention(await repository_on(session).count_by_status())
        return {"feedback_waiting": tiles.to_triage}

    return UserAdminHooks(attention=attention)


def feedback_deps(settings: Settings) -> FeedbackDeps:
    """Everything ``feedback_router`` is built from, on the account layer's own sign-in:
    the kit's ``app_feedback_actor`` (the signed-in account, its name in its language, an
    ADMIN as the feedback's admin) and ``app_admin``, both bound by
    ``install_account_layer`` in ``create_app``."""
    objects = objects_for(settings)

    async def repository(session: RequestSession) -> SqlFeedbackRepository[Feedback]:
        return repository_on(session)

    async def storage(session: RequestSession) -> SqlAttachmentStorage[FeedbackAttachment]:
        return attachment_storage_on(session, objects)

    async def replies(session: RequestSession) -> SqlFeedbackReplyStore[FeedbackReply]:
        return replies_on(session)

    async def comments(session: RequestSession) -> SqlFeedbackCommentStore[FeedbackComment]:
        return comments_on(session)

    async def votes(session: RequestSession) -> SqlFeedbackVoteStore[FeedbackVote]:
        return SqlFeedbackVoteStore(session, FeedbackVote)

    async def people(session: RequestSession) -> SqlPeopleLookup:
        return SqlPeopleLookup(session, User)

    return FeedbackDeps(
        actor=app_feedback_actor,
        repository=repository,
        storage=storage,
        demo_guard=no_demo,
        admin_guard=app_admin,
        policy=POLICY,
        replies=replies,
        comments=comments,
        votes=votes,
        people=people,
        public_viewer=everybody_signed_in,
    )
