"""The one budget the site has: the exhibits' calculations, per address.

Every route is public, so every route's cost is a stranger's to spend. The
time simulations run in the browser and cost nothing here; the figures a slider
asks for cost a millisecond to a couple of hundred, and a debounced slider asks
at most once per :data:`PAGE_SETTLE_S`. The window forgets everything on a
restart, which for a limiter is the right failure.
"""

from __future__ import annotations

from collections.abc import Callable
from time import monotonic

from eifi1_server_kit.auth.limits import Budget
from eifi1_server_kit.limiter import client_ip, vouched_hops
from fastapi import Request

from staunlabor.settings import get_settings

#: How long a slider holds still before a page asks again: **served** to the
#: pages as ``settle_s`` on ``/experiments/defaults``, which debounce by it,
#: because it is the number :data:`EXPERIMENT_RUNS` is derived from.
PAGE_SETTLE_S = 0.150

#: Ninety per ten seconds per address. A debounced slider makes at most
#: ``1 + 10/0.150 = 67`` requests in ten seconds; the dearest routes take up to
#: two hundred milliseconds, the most an address can keep one core busy for.
EXPERIMENT_RUNS = Budget(90, 10)


#: The header the web service's Caddy SETS on every request it proxies, to the
#: edge token (``deploy/Caddyfile``): a value the browser sent is replaced,
#: never passed on.
EDGE_HEADER = "x-staunlabor-edge"


def caller_address(request: Request) -> str:
    """Whose attempt this is: server-kit's ``client_ip``, counted from the right
    of ``X-Forwarded-For``, never from the left, which the client writes.

    ``trusted_proxy_hops`` describes one path, the site's (its front end, Caddy,
    the backend's front end). A request that skipped Caddy gets one entry
    appended, not three, and with three trusted the client's own forged entry
    would key the budget: 150 of 150 forged requests got through on 2026-11-13.
    So only a request carrying the edge token counts the proxies; any other is
    counted from the entry its own front end wrote (server-kit's
    ``vouched_hops``)."""
    settings = get_settings()
    hops = vouched_hops(
        request.headers,
        trusted_hops=settings.trusted_proxy_hops,
        edge_header=EDGE_HEADER,
        edge_token=settings.edge_token,
    )
    peer = request.client.host if request.client else None
    return client_ip(request.headers, peer, trusted_hops=hops) or "unknown"


class ExperimentsLimiters:
    """The calculations' budget, one per process."""

    def __init__(self, *, clock: Callable[[], float] = monotonic) -> None:
        self.runs = EXPERIMENT_RUNS.limiter(clock)
