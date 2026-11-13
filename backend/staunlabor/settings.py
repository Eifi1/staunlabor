"""What a deployment says about itself, prefixed ``STAUNLABOR_``.

Where the site is served from, which the CORS check reads in development (in
production the web service proxies ``/api`` on the same origin), and how many
proxies stand in front with the one secret that proves a request came through
them, which the address budget reads.

And the accounts (server-kit 0.29's account layer, ``staunlabor.accounts``):
their database (``staunlabor.database``), the signing key, the mail transport,
who may claim an empty database as its admin, and the passkeys' relying party.
The exhibits read none of these and answer with no database at all.

**The pool is one connection and one more, waiting ten seconds at most**
(``db_pool_size``, ``db_max_overflow``, ``db_pool_timeout_s``; the owner's
decision of 2026-11-13). The database is one of its own on the shared Cloud
SQL instance keksdose-db, a db-f1-micro with about 22 usable connections for
every app on it, and every app gets the same cap. A full instance refuses a
new connection at once, so a pool must never grow to meet a burst, and a
request that finds the pool busy fails after ten seconds rather than thirty.

**A deployment is any instance served from an origin that is not this machine,
or any that Cloud Run runs** (:attr:`Settings.deployed`). Both signals fail
towards "deployed", so an instance that forgot a variable is still treated as
the one the internet reaches, and ``main.check_deployment`` refuses it the
signing key in this repository and an open first sign-up.
"""

from __future__ import annotations

from functools import lru_cache
from ipaddress import ip_address
from typing import Literal
from urllib.parse import urlsplit

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

#: The local development database ``npm run db:setup`` makes; its password is
#: a laptop's, in this repository.
DEV_DATABASE_URL = "postgresql+asyncpg://staunlabor:staunlabor_dev@127.0.0.1:5432/staunlabor"

#: The signing key of a laptop: in this repository, so no secret. Server-kit's
#: ``secret_problems`` names it a placeholder by its "change-me", and
#: ``check_deployment`` refuses that on a deployment: whoever holds this file
#: could sign a session for any account.
DEV_JWT_SECRET = "dev-only-change-me-staunlabor-signing-key"

#: Host names that are somebody's own machine, and suffixes the DNS root does
#: not answer for: a name under one is a desk or a LAN, never the internet.
_LOCAL_NAMES = frozenset({"localhost", "0.0.0.0"})
_LOCAL_SUFFIXES = (".localhost", ".local", ".internal", ".test")


def origin_is_local(url: str) -> bool:
    """Is ``url`` served from this machine or a private network, never the
    internet? A loopback, private or link-local address, ``localhost``, or a
    name under a suffix no public DNS answers for. Anything unreadable is not
    local: the doubt counts as a deployment."""
    host = (urlsplit(url).hostname or "").lower()
    if not host:
        return False
    if host in _LOCAL_NAMES or host.endswith(_LOCAL_SUFFIXES):
        return True
    try:
        address = ip_address(host)
    except ValueError:
        return False
    return address.is_loopback or address.is_private or address.is_link_local


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="STAUNLABOR_", env_file=".env", extra="ignore")

    #: The origin the site is served from: the CORS origin for a browser that
    #: calls the API from another origin, as the Vite dev server does.
    app_base_url: str = Field(default="http://localhost:5176")
    #: How many proxies append to ``X-Forwarded-For`` before this process: the
    #: address budget reads that many entries from the right, where they wrote,
    #: never the left, where the client does. On Cloud Run behind the web
    #: service it is 3 (the web's front end, Caddy, the backend's front end).
    trusted_proxy_hops: int = Field(default=0, ge=0, le=10)
    #: The secret the web service's Caddy sets on every request it proxies
    #: (``security.EDGE_HEADER``): only with it does a request vouch for
    #: ``trusted_proxy_hops``; without it, it is counted from the one entry
    #: its own front end appended. Empty with more than one hop means every
    #: request shares one budget, the safe error.
    edge_token: str = Field(default="", repr=False)

    # ── The accounts' database ───────────────────────────────────────────────

    #: asyncpg's URL. On Cloud Run the app role's, from Secret Manager, with the
    #: Cloud SQL socket in it (``…@/staunlabor?host=/cloudsql/…``).
    database_url: str = Field(default=DEV_DATABASE_URL, repr=False)
    #: One connection kept per instance: keksdose-db (a db-f1-micro) has about 22
    #: usable connections for every app on it, and every app gets this cap.
    db_pool_size: int = Field(default=1, ge=1, le=5)
    #: One more under load, closed again after, and never a third: a full
    #: instance refuses a new connection at once, the other apps' included.
    db_max_overflow: int = Field(default=1, ge=0, le=5)
    #: How long a request waits for a free connection: 10 s, not SQLAlchemy's
    #: 30, so a full pool fails while the caller is still waiting for the answer.
    db_pool_timeout_s: float = Field(default=10, gt=0, le=60)

    # ── The accounts ─────────────────────────────────────────────────────────

    #: The HS256 key the session tokens are signed with: 32 characters or more,
    #: never the repository's (``check_deployment``).
    jwt_secret: str = Field(default=DEV_JWT_SECRET, repr=False)
    #: bcrypt's cost: 12, bcrypt's own default and every sibling app's. The suite
    #: sets 4; a hash carries its cost, so a row hashed at 12 still verifies.
    bcrypt_rounds: int = Field(default=12, ge=4, le=16)
    #: ``console`` logs each mail, link included: development, and a deployment
    #: until Resend has verified the domain, where an admin's answer shows an
    #: invitation's link once. ``resend`` sends from :attr:`mail_from`.
    mail_backend: Literal["console", "resend"] = Field(default="console")
    #: The sender, on the domain Resend verifies.
    mail_from: str = Field(default="Staunlabor <noreply@staunlabor.app>")
    #: The address every account mail names and a reply goes to: the imprint's,
    #: which Cloudflare forwards (``deploy/README.md`` §5). Not the kit's
    #: ``support@`` default, which nothing forwards here.
    contact_email: str = Field(default="kontakt@staunlabor.app")
    #: Resend's API key, read only by the ``resend`` transport.
    resend_api_key: str = Field(default="", repr=False)
    #: The addresses (comma- or space-separated) that may claim an EMPTY database
    #: as its first admin; after that only an invitation lets anybody in. Empty,
    #: whoever signs up first on an empty database is its admin, which
    #: ``check_deployment`` refuses on a deployment.
    registration_allowlist: str = Field(default="")
    #: The passkeys' relying party: the site's host (or a registrable suffix of
    #: it) and the name an authenticator shows.
    webauthn_rp_id: str = Field(default="localhost")
    webauthn_rp_name: str = Field(default="Staunlabor")

    #: Set by Cloud Run in every service's container and every job's.
    cloud_run_service: str | None = Field(default=None, validation_alias="K_SERVICE")
    cloud_run_job: str | None = Field(default=None, validation_alias="CLOUD_RUN_JOB")

    @property
    def deployed(self) -> bool:
        """Served from an origin the internet can reach, or run by Cloud Run."""
        return bool(self.cloud_run_service or self.cloud_run_job) or not origin_is_local(self.app_base_url)

    @property
    def site_origin(self) -> str:
        """The origin a passkey ceremony must come from: the site's own."""
        parts = urlsplit(self.app_base_url)
        return f"{parts.scheme}://{parts.netloc}"

    @property
    def webauthn_rp_id_fits(self) -> bool:
        """Is the RP id the site's host, or a suffix of it at a dot? A browser
        refuses every ceremony otherwise, in the browser and in no log."""
        host = (urlsplit(self.app_base_url).hostname or "").lower()
        rp_id = self.webauthn_rp_id.strip().lower()
        return bool(rp_id) and (host == rp_id or host.endswith("." + rp_id))


@lru_cache
def get_settings() -> Settings:
    return Settings()
