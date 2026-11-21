"""One structured line per API request, so the dashboards can tell the routes
apart (``deploy/grafana``).

Cloud Run's own metrics count and time requests per service, never per route,
so they cannot say which exhibit's calculation holds an instance's one core.
This middleware writes one JSON line to standard output for every request under
``/api``; Cloud Run's logging agent parses a single-line JSON object into the
entry's ``jsonPayload`` and moves ``severity`` to the entry's severity, and the
log-based metrics of ``deploy/grafana/create-log-metrics.sh`` turn the lines
into per-route distributions.

The line records nothing about a visitor: the site promises no tracking, and
the privacy policy lists what is logged. It holds the route's **template** as
FastAPI matched it (``/api/v1/admin/experiments/checks/{exhibit}``), never the
path as sent and never its query; the method; the status; the time in the app;
the CPU time; whether it was the process's first request; whether a
per-address budget refused it; and whether the answer was a kept one
(``answer_cache``), which took no calculation. No address, header, query, body or identifier
is read here, the budget's key (``security.caller_address``) included.

What it deliberately does not do: time anything outside ``/api`` (in
production Caddy sends only ``/api`` here), sample, buffer, or send anything
anywhere but standard output.
"""

from __future__ import annotations

import contextlib
import json
import sys
import time
from collections.abc import Callable
from typing import TextIO

from starlette.types import ASGIApp, Message, Receive, Scope, Send

from staunlabor.answer_cache import CACHE_HEADER

#: What the log metrics select the lines by (``deploy/grafana/create-log-metrics.sh``).
EVENT = "api_request"
#: The route of a request no route matched. A 404's path is the sender's own
#: text, so it is never written; one label also keeps the metrics' streams few.
UNMATCHED = "unmatched"
#: The methods a route can have; any other a client invents is ``OTHER``, for
#: the same two reasons.
_METHODS = frozenset({"GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"})
#: What the web service proxies to the backend (``deploy/Caddyfile``).
_API_ROOT = "/api"


class CpuShares:
    """The process's CPU time, shared out among the requests in flight.

    Neither clock measures one request on its own. ``time.thread_time`` in the
    middleware sees only the event loop's thread, while FastAPI runs every
    ``def`` route (the engine's) in a worker thread: a cannon call that costs
    175 ms of CPU showed 1.3 ms there. ``time.process_time`` sees every thread,
    so a request that overlaps others would be charged their CPU as well, and
    under load, when the figure matters, each would count several times.

    So every stretch of process CPU between two starts or ends is divided
    equally among the requests in flight during it. A request that ran alone
    gets exactly its own CPU; overlapping ones get a fair share, and the shares
    add up to the process's CPU while it answered, so a stacked "CPU by route"
    adds up to what the instance used. CPU spent with nothing in flight is
    nobody's. Called only from the event loop's thread, so it needs no lock.
    """

    def __init__(self, clock: Callable[[], float] = time.process_time) -> None:
        self._clock = clock
        self._in_flight = 0
        self._last = clock()
        #: The CPU each request in flight has been charged since the process
        #: began (a fair-queueing "virtual time"): a request's own share is the
        #: difference between its end and its start.
        self._per_request = 0.0

    def _advance(self) -> None:
        now = self._clock()
        if self._in_flight:
            self._per_request += (now - self._last) / self._in_flight
        self._last = now

    def enter(self) -> float:
        """A request starts; the mark to hand back to :meth:`leave`."""
        self._advance()
        self._in_flight += 1
        return self._per_request

    def leave(self, mark: float) -> float:
        """A request ends: its share of the CPU since ``mark``, in seconds."""
        self._advance()
        self._in_flight -= 1
        return self._per_request - mark


def route_template(scope: Scope, prefix: str) -> str:
    """The matched route's path template, under ``prefix`` when FastAPI kept
    the router's own path.

    FastAPI (0.162) no longer copies an included router's routes: the matched
    route says ``/experiments/checks/{exhibit}``, without the ``/api/v1`` it
    was included at. Every router here is included at the API's prefix
    (``main.API_PREFIX``), so the prefix is added from configuration, never
    taken from the path as sent, which is the visitor's own text.
    """
    template = getattr(scope.get("route"), "path_format", None)
    if not isinstance(template, str):
        return UNMATCHED
    return template if template.startswith(prefix) else prefix + template


def _severity(status: int) -> str:
    if status >= 500:
        return "ERROR"
    if status == 429:
        return "WARNING"
    return "INFO"


class RequestLogMiddleware:
    """Writes the line for every request under ``/api`` (the module's docstring).

    ``cold`` is true for the first request this middleware sees; it is built
    once per app, and the backend runs one app in one process (one uvicorn
    worker, ``deploy/Dockerfile.backend``), so it marks the request that met a
    fresh instance. ``budget_refused`` is a 429 from the app itself: the only
    ones it answers are the per-address budgets' (``security``, the kit's
    windows on the account routes), while Cloud Run's own 429 for want of an
    instance never reaches the container.
    """

    def __init__(
        self,
        app: ASGIApp,
        *,
        prefix: str,
        stream: TextIO | None = None,
        clock: Callable[[], float] = time.perf_counter,
        cpu: CpuShares | None = None,
    ) -> None:
        self.app = app
        self._prefix = prefix
        self._stream = stream
        self._clock = clock
        self._cpu = cpu or CpuShares()
        self._served = False

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        path = scope.get("path", "")
        if scope["type"] != "http" or not (path == _API_ROOT or path.startswith(_API_ROOT + "/")):
            await self.app(scope, receive, send)
            return
        cold = not self._served
        self._served = True
        # What the client gets when the app raises before it answers: the
        # outermost handler (main._unhandled) turns that into a 500.
        status = 500
        cached = False

        async def send_and_note_status(message: Message) -> None:
            nonlocal status, cached
            if message["type"] == "http.response.start":
                status = message["status"]
                cached = any(name == CACHE_HEADER and value == b"hit" for name, value in message.get("headers", []))
            await send(message)

        started = self._clock()
        mark = self._cpu.enter()
        try:
            await self.app(scope, receive, send_and_note_status)
        finally:
            self._write(scope, status, self._clock() - started, self._cpu.leave(mark), cold, cached)

    def _write(self, scope: Scope, status: int, seconds: float, cpu_seconds: float, cold: bool, cached: bool) -> None:
        route = route_template(scope, self._prefix)
        method = scope["method"] if scope["method"] in _METHODS else "OTHER"
        duration_ms = round(seconds * 1000, 1)
        line = json.dumps(
            {
                "severity": _severity(status),
                "message": f"{method} {route} {status} {duration_ms:.0f} ms",
                "event": EVENT,
                "route": route,
                "method": method,
                "status": status,
                "duration_ms": duration_ms,
                "cpu_ms": round(cpu_seconds * 1000, 1),
                "cold": cold,
                "budget_refused": status == 429,
                "cached": cached,
            },
            separators=(",", ":"),
        )
        stream = self._stream or sys.stdout
        # A closed or broken standard output must not turn an answer that has
        # already gone out into an error: the line is only a measure.
        with contextlib.suppress(OSError, ValueError):
            stream.write(line + "\n")
            stream.flush()
