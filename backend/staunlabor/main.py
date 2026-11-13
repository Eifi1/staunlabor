"""The app: the exhibits' routes under ``/api/v1``, a health check, and the
two answers an error can get.

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

from eifi1_server_kit.errors import install_contract_error_handlers
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from staunlabor import __version__
from staunlabor.api.experiments_router import router as experiments_router
from staunlabor.database import Database
from staunlabor.security import ExperimentsLimiters
from staunlabor.settings import get_settings

logger = logging.getLogger(__name__)

API_PREFIX = "/api/v1"


@asynccontextmanager
async def _lifespan(app: FastAPI) -> AsyncIterator[None]:
    yield
    await app.state.database.dispose()


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="Staunlabor",
        version=__version__,
        docs_url=f"{API_PREFIX}/docs",
        openapi_url=f"{API_PREFIX}/openapi.json",
        lifespan=_lifespan,
    )
    app.state.experiments_limiters = ExperimentsLimiters()
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
