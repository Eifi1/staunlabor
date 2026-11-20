"""The app: the exhibits' routes and the accounts' and their admin's (server-kit's)
under ``/api/v1``, a health check, and the two answers an error can get.

No middleware beyond CORS, which only the development server needs: in
production the web service proxies ``/api`` on the site's own origin. The
accounts' database is built with the app and connects only when an account
route asks for it (``staunlabor.database``): the exhibits and the health check
never do.
"""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from uuid import uuid4

from eifi1_server_kit.auth import AuthLimiters, parse_env_list
from eifi1_server_kit.auth.jobs import account_jobs_router
from eifi1_server_kit.auth.passkeys import rp_id_fits
from eifi1_server_kit.auth.router import auth_router, invitations_admin_router
from eifi1_server_kit.errors import install_contract_error_handlers
from eifi1_server_kit.feedback.router import feedback_router
from eifi1_server_kit.limiter import FeedbackLimiters
from eifi1_server_kit.settings import secret_problems
from eifi1_server_kit.translation_review.router import translation_review_router
from eifi1_server_kit.user_admin.router import user_admin_router
from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from staunlabor import __version__
from staunlabor.accounts import account_deps, admin_deps, jobs_deps
from staunlabor.api.course_router import router as course_router
from staunlabor.api.experiments_router import router as experiments_router
from staunlabor.database import Database
from staunlabor.exhibit_checks import exhibit_checks_router
from staunlabor.feedback import feedback_deps
from staunlabor.security import AccountLimiters, ExperimentsLimiters, limit_account_request
from staunlabor.settings import Settings, get_settings
from staunlabor.translations import translation_review_deps

logger = logging.getLogger(__name__)

API_PREFIX = "/api/v1"


def check_deployment(settings: Settings) -> None:
    """Refuse to start a deployment anybody could take over; on a laptop, say so.

    * **The signing key** unset, the one in this repository, or under 32
      characters (server-kit's ``secret_problems``): whoever holds it signs a
      session for any account, the admin's included.
    * **An empty allow-list**: whoever signs up first on an empty database is
      its admin, a stranger who finds the deployment first too.
    * **A passkey RP id that is not the site's host** (server-kit's
      ``rp_id_fits``): every ceremony fails, in the person's browser and in no
      log. The kit's ``RelyingParty`` only warns about it, so that a dev server
      opened over the LAN still starts; a deployment must not.
    * **A jobs token unset or weak**: the daily call, which deletes an ended
      session's address after 30 days, would answer nobody, or anybody.
    * **The second factor's keys unset, the repository's, or under 32
      characters**: unset, nobody could switch it on (``503``); the
      repository's, whoever reads this file opens every sealed secret and makes
      the codes of every account that has it on.
    * **No bucket for feedback's files**: the instance's own directory goes
      with the instance, and a report's screenshot with it.

    A deployment (``Settings.deployed``) refuses to start on any of them. A
    laptop boots with nothing configured, and hears about the key and the RP id.
    A console transport on a deployment is the plan's stand-in until Resend has
    verified the domain, so it is allowed, and said once: nothing is sent, and
    the log names each mail's kind alone (``accounts.mailer_for``), so a link
    reaches a person only from an admin's answer.
    """
    problems = secret_problems(settings.jwt_secret, name="STAUNLABOR_JWT_SECRET")
    if not rp_id_fits(settings.webauthn_rp_id, settings.app_base_url):
        problems.append(
            f"STAUNLABOR_WEBAUTHN_RP_ID ({settings.webauthn_rp_id!r}) is neither the host of STAUNLABOR_APP_BASE_URL"
            f" ({settings.app_base_url}) nor a suffix of it: no browser uses a passkey here"
        )
    if not settings.deployed:
        for problem in problems:
            logger.warning("%s. Development only.", problem)
        return
    if not parse_env_list(settings.registration_allowlist):
        problems.append(
            "STAUNLABOR_REGISTRATION_ALLOWLIST is empty: whoever signs up first on an empty database is its admin"
        )
    problems += secret_problems(settings.jobs_token, name="STAUNLABOR_JOBS_TOKEN")
    problems += secret_problems(settings.totp_keys, name="STAUNLABOR_TOTP_KEYS")
    if not settings.feedback_bucket.strip():
        problems.append(
            "STAUNLABOR_FEEDBACK_BUCKET is empty: a report's files would go with the instance they were uploaded to"
        )
    if problems:
        raise RuntimeError("Refusing to start a deployment: " + "; ".join(problems) + ".")
    if settings.mail_backend == "console":
        logger.warning(
            "Mail is not sent (STAUNLABOR_MAIL_BACKEND=console): the log names each mail's kind alone,"
            " and an admin hands an invitation's or a reset's link on from the admin's answer."
        )


@asynccontextmanager
async def _lifespan(app: FastAPI) -> AsyncIterator[None]:
    yield
    await app.state.database.dispose()


def create_app() -> FastAPI:
    settings = get_settings()
    check_deployment(settings)
    app = FastAPI(
        title="Staunlabor",
        version=__version__,
        docs_url=f"{API_PREFIX}/docs",
        openapi_url=f"{API_PREFIX}/openapi.json",
        lifespan=_lifespan,
    )
    app.state.experiments_limiters = ExperimentsLimiters()
    app.state.account_limiters = AccountLimiters()
    app.state.auth_limiters = AuthLimiters()
    app.state.feedback_limiters = FeedbackLimiters()
    app.state.database = Database(settings)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[settings.app_base_url.rstrip("/")],
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type"],
    )

    @app.get(f"{API_PREFIX}/health")
    async def health() -> dict[str, str]:
        return {"status": "ok", "version": __version__}

    app.include_router(experiments_router, prefix=API_PREFIX)
    # The course's lessons, under the exhibits' calculation budget (course_router).
    app.include_router(course_router, prefix=API_PREFIX)
    # Every account route spends the address's budget first, the kit's own
    # windows after it (security.ACCOUNT_REQUESTS).
    accounts = account_deps(app.state.database, settings)
    budget = [Depends(limit_account_request)]
    app.include_router(auth_router(accounts), prefix=API_PREFIX, dependencies=budget)
    # The admin's two routers, behind the kit's one admin guard: the invitations
    # (0.29) and the roster with its actions, the log, the overview and the mail (0.30).
    app.include_router(invitations_admin_router(accounts), prefix=API_PREFIX, dependencies=budget)
    app.include_router(user_admin_router(admin_deps(accounts)), prefix=API_PREFIX, dependencies=budget)
    # The daily call (Cloud Scheduler's, with the jobs token): the erasures due 30 days
    # after a deletion request, the prune of the account rows done with for 30 days, the
    # sweep of uploads no report names. Under the budget too: every route is public.
    app.include_router(
        account_jobs_router(jobs_deps(app.state.database, settings, accounts)), prefix=API_PREFIX, dependencies=budget
    )
    # Feedback (server-kit 0.31's feedback.sql): the reports, the inbox, the public list,
    # on the account layer's own sign-in.
    app.include_router(feedback_router(feedback_deps(accounts, settings)), prefix=API_PREFIX, dependencies=budget)
    # The translation review (server-kit 0.31's translation_review.sql): the verdicts on the
    # seven catalogues, an admin's and the reviewers' an admin granted. Under the budget too.
    app.include_router(
        translation_review_router(translation_review_deps(accounts)), prefix=API_PREFIX, dependencies=budget
    )
    # Which exhibits' calculations are checked: the public list every page asks
    # for its notice, and an admin's verdict, kept with the code's fingerprint.
    app.include_router(exhibit_checks_router(accounts), prefix=API_PREFIX)
    # The kit's refusals — the budget's 429 with its Retry-After — are
    # ValueErrors too; the kit's handlers answer them at their own status,
    # beside the engine's 400 below.
    install_contract_error_handlers(app)

    @app.exception_handler(ValueError)
    async def _value_error_to_400(_request: Request, exc: ValueError) -> JSONResponse:
        # The engine raises ValueError for a build no exhibit can be: a ball
        # too big for its sphere, a coil with no turns. The schemas bound each
        # field; this is the combination, said in the engine's own words.
        return JSONResponse(status_code=400, content={"detail": str(exc)})

    @app.exception_handler(Exception)
    async def _unhandled(request: Request, exc: Exception) -> JSONResponse:
        # A short reference instead of the exception: the log has the rest.
        error_id = uuid4().hex[:8]
        logger.error("[%s] unhandled error on %s %s", error_id, request.method, request.url.path, exc_info=exc)
        return JSONResponse(status_code=500, content={"detail": "Internal server error", "error_id": error_id})

    return app


app = create_app()
