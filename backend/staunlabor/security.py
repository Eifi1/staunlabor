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
from eifi1_server_kit.limiter import client_ip
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


def caller_address(request: Request) -> str:
    """Whose attempt this is: server-kit's ``client_ip``, ``trusted_proxy_hops``
    entries from the right of ``X-Forwarded-For``, where this deployment's own
    proxies wrote them — never the left-most, which the client writes."""
    peer = request.client.host if request.client else None
    return client_ip(request.headers, peer, trusted_hops=get_settings().trusted_proxy_hops) or "unknown"


class ExperimentsLimiters:
    """The calculations' budget, one per process."""

    def __init__(self, *, clock: Callable[[], float] = monotonic) -> None:
        self.runs = EXPERIMENT_RUNS.limiter(clock)
