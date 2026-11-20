"""The site's budgets, per address: the calculations (the exhibits' and the
course's), and every account route.

Every route is public, so every route's cost is a stranger's to spend. The
time simulations run in the browser and cost nothing here; the figures a slider
asks for cost a millisecond to a couple of hundred, and a debounced slider asks
at most once per :data:`PAGE_SETTLE_S`. The account routes and the admin's
(server-kit's ``auth_router``, ``invitations_admin_router``,
``user_admin_router``) charge the kit's own windows where a route hashes, mails
or redeems a token (``AuthLimiters``, on ``app.state.auth_limiters``); the rest
read a row or two and had none, so :data:`ACCOUNT_REQUESTS` spans them all.
Every window forgets everything on a restart, which for a limiter is the right
failure.
"""

from __future__ import annotations

from collections.abc import Callable
from time import monotonic

from eifi1_server_kit.auth.limits import Budget
from eifi1_server_kit.limiter import charge, client_ip, vouched_hops
from fastapi import Request

from staunlabor.settings import get_settings

#: How long a slider holds still before a page asks again: **served** to the
#: pages as ``settle_s`` on ``/experiments/defaults`` and ``/course/defaults``,
#: which debounce by it, because it is the number :data:`EXPERIMENT_RUNS` is
#: derived from.
PAGE_SETTLE_S = 0.150

#: A hundred and eighty per ten seconds per address: two readers dragging a
#: slider behind one address (an office, a proxy), each debounced to at most
#: ``1 + 10/0.150 = 67`` requests in ten seconds, with room for their pages.
#: It was ninety until 2026-11-20, when the load analysis found that a
#: LinkedIn post's readers at work share their company's address (Marcel:
#: "Budget pro Adresse lockern", approved). A kept answer costs nothing
#: (``answer_cache``), so the front page's questions, the same for everyone,
#: never reach it; it guards what costs: questions not yet asked. The course's
#: routes spend it too (``api/course_router.py``): one window for every
#: calculation, so asking two kinds of page buys an address no more.
EXPERIMENT_RUNS = Budget(180, 10)


#: Every account route, per address: sixty a minute. A person's page asks for
#: a handful (``/auth/me``, a refresh, the sessions; an admin's the roster, the
#: log, the invitations); the
#: limit is what a script gets for nothing, each request holding one of the
#: instance's two connections (``settings.db_pool_size`` + ``db_max_overflow``)
#: while it runs. Charged before the kit's own windows,
#: which stay tighter where a route costs more (five sign-ups in five minutes).
ACCOUNT_REQUESTS = Budget(60, 60)


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


class AccountLimiters:
    """The account routes' budget, one per process."""

    def __init__(self, *, clock: Callable[[], float] = monotonic) -> None:
        self.requests = ACCOUNT_REQUESTS.limiter(clock)


def limit_account_request(request: Request) -> None:
    """Spend one of this address's account requests, or refuse with the wait."""
    charge(
        request.app.state.account_limiters.requests,
        caller_address(request),
        lambda seconds: f"Too many requests from this address. Try again in {seconds} seconds.",
    )
