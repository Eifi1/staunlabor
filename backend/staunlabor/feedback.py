"""Feedback: server-kit's feedback layer (0.31) on this app's tables.

The kit runs every route (``feedback_router``: a report and its files, the
admin's inbox and its replies, the author's own list and reworks, and the public
list with its comments and votes), every rule and every refusal. What is here is
what the kit leaves to an app, and nothing more:

- the stores: ``feedback.sql``'s, over ``staunlabor.models``, each on the
  request's session, with the uploads table so a writer names only a file they
  uploaded;
- the files' bytes: a directory on the machine (``settings.feedback_files_dir``)
  until a deployment brings a bucket (``deploy/README.md``);
- who is who: the signed-in account (server-kit's ``current_user``, the one the
  account routes use) as the feedback's actor, an ADMIN as its admin;
- who sees the public list: everybody signed in, since every account here came
  by invitation.

No demo, so no demo guard refuses anything; no mails yet (a reply or a comment
tells nobody), so no alerts. The reports are the site's own to-do list too:
the planned exhibits are filed here as ideas (plan, second stage).
"""

# No `from __future__ import annotations` here: the actor's parameter names a dependency
# built inside `feedback_deps` (`Depends(signed_in)`), and FastAPI resolves a string
# annotation in the module's globals, where `signed_in` is not. Evaluated at definition,
# the annotation holds the dependency itself.

from collections.abc import Awaitable, Callable, Sequence
from typing import Annotated, Any

from eifi1_server_kit.auth.accounts import full_name
from eifi1_server_kit.auth.router import AuthDeps, admin_guard, current_user
from eifi1_server_kit.feedback import AttachmentUrlPolicy, FeedbackActor, feedback_attention
from eifi1_server_kit.feedback.router import FeedbackDeps
from eifi1_server_kit.feedback.service import FeedbackService
from eifi1_server_kit.feedback.sql import (
    FEEDBACK_OBJECT_PREFIX,
    SqlAttachmentStorage,
    SqlFeedbackCommentStore,
    SqlFeedbackReplyStore,
    SqlFeedbackRepository,
    SqlFeedbackVoteStore,
    SqlPeopleLookup,
)
from eifi1_server_kit.objects import LocalObjectStore, ObjectStore, purge_objects
from eifi1_server_kit.user_admin.service import UserAdminHooks
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from staunlabor.database import RequestSession
from staunlabor.models import (
    Feedback,
    FeedbackAttachment,
    FeedbackComment,
    FeedbackReply,
    FeedbackVote,
    Role,
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
    """Where the files' bytes go: a directory on this machine."""
    return LocalObjectStore(settings.feedback_files_dir)


def erased_files_purge(settings: Settings) -> Callable[[Sequence[str]], Awaitable[None]]:
    """What an erasure does with the files the person attached (``AuthHooks.purge_files``):
    removes them from the store after the erasure has committed. The kit hands over the keys
    no other row names any more, so a file somebody else attached too stays. Without it the
    rows would lose the files' names and the files would stay in the store for good, which
    the privacy policy does not say.

    The kit's purge never raises (the database is already emptied) and logs every key it
    could not remove, to remove by hand. It spares a file written in the last five minutes,
    which an upload of the same bytes may be about to name."""
    objects = objects_for(settings)

    async def purge(keys: Sequence[str]) -> None:
        await purge_objects(
            objects,
            keys,
            reason="an erased account's feedback files",
            object_key=lambda key: f"{FEEDBACK_OBJECT_PREFIX}{key}",
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


def feedback_deps(accounts: AuthDeps, settings: Settings) -> FeedbackDeps:
    """Everything ``feedback_router`` is built from, on the account layer's own sign-in."""
    signed_in = current_user(accounts)
    objects = objects_for(settings)

    async def actor(user: Annotated[User, Depends(signed_in)]) -> FeedbackActor:
        return FeedbackActor(
            id=user.id,
            email=user.email,
            display_name=full_name(user.first_name, user.last_name, user.locale) or None,
            is_admin=user.role == Role.ADMIN,
            role=user.role,
        )

    async def repository(session: RequestSession) -> SqlFeedbackRepository[Feedback]:
        return repository_on(session)

    async def storage(session: RequestSession) -> SqlAttachmentStorage[FeedbackAttachment]:
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

    async def replies(session: RequestSession) -> SqlFeedbackReplyStore[FeedbackReply]:
        return replies_on(session)

    async def comments(session: RequestSession) -> SqlFeedbackCommentStore[FeedbackComment]:
        return comments_on(session)

    async def votes(session: RequestSession) -> SqlFeedbackVoteStore[FeedbackVote]:
        return SqlFeedbackVoteStore(session, FeedbackVote)

    async def people(session: RequestSession) -> SqlPeopleLookup:
        return SqlPeopleLookup(session, User)

    return FeedbackDeps(
        actor=actor,
        repository=repository,
        storage=storage,
        demo_guard=no_demo,
        admin_guard=admin_guard(accounts),
        policy=POLICY,
        replies=replies,
        comments=comments,
        votes=votes,
        people=people,
        public_viewer=everybody_signed_in,
    )
