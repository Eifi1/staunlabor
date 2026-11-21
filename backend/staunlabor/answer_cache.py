"""The engine's answers, kept: one calculation per question and process.

Every visitor's front page asks the same questions: each card's drawing is
its exhibit's default build, the week's exhibit too, and each was computed
again for every visitor, up to two hundred milliseconds of the only core
(the load analysis of 2026-11-20, the first bottleneck of a LinkedIn post;
Marcel: "Ja, einbauen"). The engine is pure, so an answer depends on nothing
but the question: the same route with the same body gets the same bytes.

So the answers of the calculation routes (``/experiments/…`` and
``/course/…``) are kept here, by route and body, up to :data:`MAX_BYTES` in
all, the least recently asked going first. Two things follow from it:

* **A kept answer costs no budget.** It is returned before the route and its
  per-address budget (``security.EXPERIMENT_RUNS``) are reached, so an office
  behind one address can load the front page as often as it likes; the
  budget still guards what costs: questions not yet asked.
* **One calculation for a crowd.** Questions that arrive while the same one
  is being computed wait for it rather than each computing it: the Chladni
  plate's first answer took sixteen seconds for twenty callers at once, one
  second for one.

Not kept: ``/defaults`` (cheap, and it carries no calculation), the checks
(an admin changes them), anything but a 200 in JSON, a body that is not JSON,
and an answer over :data:`MAX_ANSWER_BYTES`. What it deliberately is not: a
cache in front of the pages (Caddy serves those) or across instances (each
process keeps its own; ``--min-instances=1`` keeps one warm).

The answer says where it came from in :data:`CACHE_HEADER` (``hit`` or
``miss``), which ``request_log`` writes into its line.
"""

from __future__ import annotations

import asyncio
import json
from collections import OrderedDict
from collections.abc import Awaitable, Callable, MutableMapping
from typing import Any

Scope = MutableMapping[str, Any]
Message = MutableMapping[str, Any]
Receive = Callable[[], Awaitable[Message]]
Send = Callable[[Message], Awaitable[None]]
ASGIApp = Callable[[Scope, Receive, Send], Awaitable[None]]

#: All kept answers together: well inside the backend's 512 MiB, where the
#: process itself takes about 150 (measured 2026-11-20). The race's answer,
#: the largest, is 250 KiB; most are a few.
MAX_BYTES = 32 * 1024 * 1024

#: An answer larger than this is not kept: one would push out a hundred others.
MAX_ANSWER_BYTES = 2 * 1024 * 1024

#: The response header that says whether the answer was kept (``hit``) or
#: computed (``miss``).
CACHE_HEADER = b"x-answer-cache"

#: The routers whose answers are the engine's alone.
ROOTS = ("/experiments/", "/course/")


class AnswerStore:
    """The kept answers, least recently asked first out, within a byte budget."""

    def __init__(self, max_bytes: int = MAX_BYTES) -> None:
        self.max_bytes = max_bytes
        self._answers: OrderedDict[str, tuple[bytes, object]] = OrderedDict()
        self._bytes = 0

    def get(self, key: str) -> tuple[bytes, object] | None:
        found = self._answers.get(key)
        if found is not None:
            self._answers.move_to_end(key)
        return found

    def put(self, key: str, body: bytes, route: object) -> None:
        if len(body) > min(MAX_ANSWER_BYTES, self.max_bytes):
            return
        old = self._answers.pop(key, None)
        if old is not None:
            self._bytes -= len(old[0])
        self._answers[key] = (body, route)
        self._bytes += len(body)
        while self._bytes > self.max_bytes:
            _, (dropped, _) = self._answers.popitem(last=False)
            self._bytes -= len(dropped)

    @property
    def size(self) -> int:
        return self._bytes

    def __len__(self) -> int:
        return len(self._answers)


def question(scope: Scope, body: bytes) -> str | None:
    """The key a question is kept under: method, path, query and the body as
    JSON written one way (so key order and spacing do not make two questions
    of one). None when the body is not JSON: then it is not kept."""
    if body:
        try:
            written = json.dumps(json.loads(body), sort_keys=True, separators=(",", ":"), ensure_ascii=False)
        except ValueError:
            return None
    else:
        written = ""
    query = scope.get("query_string", b"").decode("latin-1")
    return f"{scope['method']} {scope['path']}?{query} {written}"


class AnswerCacheMiddleware:
    """Keeps the calculation routes' answers (the module's docstring)."""

    def __init__(self, app: ASGIApp, *, prefix: str, max_bytes: int = MAX_BYTES) -> None:
        self.app = app
        self.store = AnswerStore(max_bytes)
        self._roots = tuple(prefix + root for root in ROOTS)
        self._asked: dict[str, asyncio.Future[bool]] = {}

    def _keeps(self, scope: Scope) -> bool:
        path: str = scope.get("path", "")
        return (
            scope["type"] == "http"
            and scope.get("method") in ("GET", "POST")
            and path.startswith(self._roots)
            and not path.endswith("/defaults")
            and "/checks" not in path
        )

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if not self._keeps(scope):
            await self.app(scope, receive, send)
            return
        body = await _read_body(receive)
        key = question(scope, body)
        # Asked already, or being computed: that answer, once it is there.
        known = key is not None and (key in self._asked or self.store.get(key) is not None)
        if known and await self._kept(key, scope, send):  # type: ignore[arg-type]
            return
        await self._compute(scope, _replay(body, receive), send, key)

    async def _kept(self, key: str, scope: Scope, send: Send) -> bool:
        computing = self._asked.get(key)
        if computing is not None:
            await asyncio.shield(computing)
        found = self.store.get(key)
        if found is None:
            return False
        answer, route = found
        # The route the answer came from, so the request log can name it.
        scope["route"] = route
        await send(
            {
                "type": "http.response.start",
                "status": 200,
                "headers": [
                    (b"content-type", b"application/json"),
                    (b"content-length", str(len(answer)).encode()),
                    (CACHE_HEADER, b"hit"),
                ],
            }
        )
        await send({"type": "http.response.body", "body": answer, "more_body": False})
        return True

    async def _compute(self, scope: Scope, receive: Receive, send: Send, key: str | None) -> None:
        done: asyncio.Future[bool] | None = None
        if key is not None and key not in self._asked:
            done = asyncio.get_running_loop().create_future()
            self._asked[key] = done
        status = 500
        json_answer = False
        chunks: list[bytes] = []

        async def note(message: Message) -> None:
            nonlocal status, json_answer
            if message["type"] == "http.response.start":
                status = message["status"]
                headers = list(message.get("headers", []))
                json_answer = any(
                    name.lower() == b"content-type" and value.startswith(b"application/json") for name, value in headers
                )
                message["headers"] = [*headers, (CACHE_HEADER, b"miss")]
            elif message["type"] == "http.response.body":
                chunks.append(message.get("body", b""))
            await send(message)

        try:
            await self.app(scope, receive, note)
        finally:
            if key is not None and status == 200 and json_answer:
                self.store.put(key, b"".join(chunks), scope.get("route"))
            if done is not None:
                self._asked.pop(key, None)  # type: ignore[arg-type]
                done.set_result(True)


async def _read_body(receive: Receive) -> bytes:
    parts: list[bytes] = []
    while True:
        message = await receive()
        if message["type"] != "http.request":
            break
        parts.append(message.get("body", b""))
        if not message.get("more_body", False):
            break
    return b"".join(parts)


def _replay(body: bytes, receive: Receive) -> Receive:
    """The body once more for the app, then whatever the client sends next
    (a disconnect)."""
    given = False

    async def again() -> Message:
        nonlocal given
        if not given:
            given = True
            return {"type": "http.request", "body": body, "more_body": False}
        return await receive()

    return again
