"""The translation review: server-kit's review routes (0.31) on this app's table.

Six of the seven catalogues were machine-translated (``docs/translations.md``),
and nobody has read them. The kit runs the three routes (the verdicts a
reviewer may see, saving and clearing them), every rule and every refusal. What
is here is what the kit leaves to an app:

- who reviews: the signed-in account (server-kit's ``current_user``), an ADMIN
  every language and every area, a REVIEWER the languages and areas an admin
  granted (``PUT /admin/users/{id}/reviewer``), anyone else nothing;
- the store: ``translation_review.sql``'s, over ``staunlabor.models``, on the
  request's session.

The strings are not here: they are the site's catalogues and the kit's, which
the page reads from what the site ships. The server keeps only the verdicts,
each with the wording it was given on. Corrections are never applied by the
app; the page exports them for a developer.
"""

# No `from __future__ import annotations` here, as in `feedback.py`: the reviewer's
# parameter names a dependency built inside `translation_review_deps`, and FastAPI resolves
# a string annotation in the module's globals, where it is not.

from typing import Annotated

from eifi1_server_kit.auth.router import AuthDeps, current_user
from eifi1_server_kit.translation_review import TranslationReviewer, review_grant
from eifi1_server_kit.translation_review.router import TranslationReviewDeps
from eifi1_server_kit.translation_review.sql import SqlTranslationReviewStore
from fastapi import Depends

from staunlabor.accounts import LANGUAGES
from staunlabor.database import RequestSession
from staunlabor.models import Role, TranslationReview, User


def translation_review_deps(accounts: AuthDeps) -> TranslationReviewDeps[TranslationReview]:
    """Everything ``translation_review_router`` is built from, on the account layer's sign-in."""
    signed_in = current_user(accounts)

    async def reviewer(user: Annotated[User, Depends(signed_in)]) -> TranslationReviewer:
        grant = review_grant(
            user, is_admin=user.role == Role.ADMIN, is_reviewer=user.role == Role.REVIEWER, locale_codes=LANGUAGES
        )
        return TranslationReviewer(
            id=user.id, first_name=user.first_name, last_name=user.last_name, locale=user.locale, grant=grant
        )

    async def store(session: RequestSession) -> SqlTranslationReviewStore[TranslationReview]:
        return SqlTranslationReviewStore(session, TranslationReview, accounts=User)

    return TranslationReviewDeps(reviewer=reviewer, store=store, locale_codes=LANGUAGES)
