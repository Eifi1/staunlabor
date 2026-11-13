"""What a deployment says about itself, prefixed ``STAUNLABOR_``.

There is little to say: the site has no database, no accounts and no mail.
What is left is where it is served from, which the CORS check reads in
development (in production the web service proxies ``/api`` on the same
origin), and how many proxies stand in front with the one secret that proves
a request came through them, which the address budget reads.
"""

from __future__ import annotations

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


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


@lru_cache
def get_settings() -> Settings:
    return Settings()
