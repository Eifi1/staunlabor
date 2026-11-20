"""The one line per API request the dashboards count (``staunlabor.request_log``).

What the line must never hold is the point of most of these: the site promises
no tracking, so a line names the route's template, never the path as sent, and
holds no address, agent, referrer, query or body. The rest pin what the
dashboards read from it: the status as the client got it, the cold start, the
budget's refusal, and CPU shared fairly among overlapping requests."""

from __future__ import annotations

import io
import json
from collections.abc import AsyncIterator, Iterator
from time import monotonic

import pytest
from eifi1_server_kit.auth.limits import Budget
from fastapi import APIRouter, FastAPI
from httpx import ASGITransport, AsyncClient

from staunlabor.request_log import EVENT, UNMATCHED, CpuShares, RequestLogMiddleware

pytestmark = pytest.mark.unit

#: Every key a line has; one more would be one more thing recorded.
KEYS = {
    "severity",
    "message",
    "event",
    "route",
    "method",
    "status",
    "duration_ms",
    "cpu_ms",
    "cold",
    "budget_refused",
    "cached",
}


def _lines(text: str) -> list[dict]:
    return [json.loads(line) for line in text.splitlines() if line.startswith("{")]


@pytest.fixture
async def site() -> AsyncIterator[tuple[FastAPI, AsyncClient]]:
    """The real app, as main.py installs the middleware."""
    from staunlabor.main import create_app

    app = create_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        yield app, client
    await app.state.database.dispose()


def _small_app(stream: io.StringIO) -> FastAPI:
    """A router included under the API's prefix, as main.py includes every one."""
    router = APIRouter(prefix="/experiments")

    @router.get("/checks/{exhibit}")
    async def one(exhibit: str) -> dict[str, str]:
        return {"exhibit": exhibit}

    @router.get("/broken")
    async def broken() -> None:
        raise RuntimeError("the engine's bug")

    app = FastAPI()
    app.include_router(router, prefix="/api/v1")

    @app.get("/")
    async def home() -> dict[str, str]:
        return {}

    app.add_middleware(RequestLogMiddleware, prefix="/api/v1", stream=stream)
    return app


@pytest.fixture
def small() -> Iterator[tuple[FastAPI, io.StringIO]]:
    stream = io.StringIO()
    yield _small_app(stream), stream


async def test_a_line_names_the_route_s_template_never_the_path_as_sent(small):
    app, stream = small
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        assert (await client.get("/api/v1/experiments/checks/someones-name")).status_code == 200

    [line] = _lines(stream.getvalue())
    assert line["route"] == "/api/v1/experiments/checks/{exhibit}"
    assert "someones-name" not in stream.getvalue()


async def test_the_line_holds_no_address_agent_referrer_query_or_body(site, capsys):
    _, client = site
    defaults = (await client.get("/api/v1/experiments/defaults")).json()
    capsys.readouterr()
    headers = {
        "X-Forwarded-For": "203.0.113.77, 198.51.100.23",
        "User-Agent": "Mozilla/5.0 (a-visitors-browser)",
        "Referer": "https://example.org/the-visitors-post",
        "Cookie": "session=the-visitors-cookie",
    }
    sphere = await client.post("/api/v1/experiments/sphere?visitor=alice", json=defaults["sphere"], headers=headers)
    assert sphere.status_code == 200

    out = capsys.readouterr().out
    [line] = _lines(out)
    assert set(line) == KEYS
    assert line["event"] == EVENT
    assert line["route"] == "/api/v1/experiments/sphere"
    assert line["method"] == "POST"
    for secret in ("203.0.113.77", "198.51.100.23", "a-visitors-browser", "the-visitors-post", "the-visitors-cookie"):
        assert secret not in out
    assert "visitor=alice" not in out
    assert "?" not in out


async def test_a_line_is_one_json_object_on_one_line(site, capsys):
    _, client = site
    await client.get("/api/v1/health")

    out = capsys.readouterr().out
    assert out.count("\n") == 1
    line = json.loads(out)
    assert line["route"] == "/api/v1/health"
    assert line["severity"] == "INFO"
    assert line["message"].startswith("GET /api/v1/health 200 ")
    assert line["duration_ms"] >= 0
    assert line["cpu_ms"] >= 0


async def test_only_the_process_s_first_request_is_cold(site, capsys):
    _, client = site
    await client.get("/api/v1/health")
    await client.get("/api/v1/experiments/chair")
    await client.get("/api/v1/health")

    assert [line["cold"] for line in _lines(capsys.readouterr().out)] == [True, False, False]


async def test_a_refusal_by_the_address_budget_is_marked(site, capsys):
    app, client = site
    app.state.experiments_limiters.runs = Budget(1, 60).limiter(monotonic)
    # Two questions not asked before: a kept answer would cost no budget.
    assert (await client.post("/api/v1/experiments/sphere", json={"shell_radius_m": 0.21})).status_code == 200
    assert (await client.post("/api/v1/experiments/sphere", json={"shell_radius_m": 0.22})).status_code == 429

    answered, refused = _lines(capsys.readouterr().out)
    assert (answered["status"], answered["budget_refused"], answered["cached"]) == (200, False, False)
    assert (refused["status"], refused["budget_refused"], refused["severity"]) == (429, True, "WARNING")
    assert refused["route"] == "/api/v1/experiments/sphere"


async def test_a_kept_answer_is_marked_and_keeps_its_route(site, capsys):
    _, client = site
    await client.get("/api/v1/experiments/chair")
    await client.get("/api/v1/experiments/chair")

    computed, kept = _lines(capsys.readouterr().out)
    assert (computed["cached"], kept["cached"]) == (False, True)
    assert kept["route"] == computed["route"] == "/api/v1/experiments/chair"
    assert kept["status"] == 200


async def test_a_path_no_route_matches_is_logged_as_unmatched(site, capsys):
    _, client = site
    assert (await client.get("/api/v1/whatever/a-visitor-typed?x=1")).status_code == 404

    out = capsys.readouterr().out
    [line] = _lines(out)
    assert (line["route"], line["status"]) == (UNMATCHED, 404)
    assert "a-visitor-typed" not in out


async def test_a_method_no_route_has_is_logged_as_other(site, capsys):
    _, client = site
    assert (await client.request("PROPFIND", "/api/v1/health")).status_code == 405

    [line] = _lines(capsys.readouterr().out)
    assert (line["method"], line["route"], line["status"]) == ("OTHER", "/api/v1/health", 405)


async def test_an_unhandled_error_is_logged_as_the_500_the_client_gets(small):
    app, stream = small
    transport = ASGITransport(app=app, raise_app_exceptions=False)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        assert (await client.get("/api/v1/experiments/broken")).status_code == 500

    [line] = _lines(stream.getvalue())
    assert (line["route"], line["status"], line["severity"]) == ("/api/v1/experiments/broken", 500, "ERROR")


async def test_nothing_outside_the_api_is_logged(small):
    app, stream = small
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        assert (await client.get("/")).status_code == 200
        assert (await client.get("/apiary")).status_code == 404

    assert stream.getvalue() == ""


async def test_a_log_that_cannot_be_written_does_not_fail_the_answer():
    class Closed(io.StringIO):
        def write(self, _text: str) -> int:
            raise OSError("standard output is gone")

    app = _small_app(Closed())
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        assert (await client.get("/api/v1/experiments/checks/sky")).status_code == 200


class _Clock:
    """A CPU clock the test moves by hand."""

    def __init__(self) -> None:
        self.now = 0.0

    def __call__(self) -> float:
        return self.now


def test_a_request_that_ran_alone_is_charged_exactly_its_own_cpu():
    clock = _Clock()
    shares = CpuShares(clock)
    mark = shares.enter()
    clock.now += 0.180
    assert shares.leave(mark) == pytest.approx(0.180)


def test_overlapping_requests_share_the_cpu_and_the_shares_add_up():
    """A 160 ms calculation overlapped by a 20 ms one for 40 ms of its time."""
    clock = _Clock()
    shares = CpuShares(clock)
    heavy = shares.enter()
    clock.now += 0.120  # the heavy one alone
    light = shares.enter()
    clock.now += 0.040  # both in flight
    light_cpu = shares.leave(light)
    clock.now += 0.020  # the heavy one alone again
    heavy_cpu = shares.leave(heavy)

    assert light_cpu == pytest.approx(0.020)
    assert heavy_cpu == pytest.approx(0.160)
    assert light_cpu + heavy_cpu == pytest.approx(clock.now)


def test_cpu_spent_with_nothing_in_flight_is_nobody_s():
    clock = _Clock()
    shares = CpuShares(clock)
    clock.now += 5.0  # the import, a garbage collection, the idle loop
    mark = shares.enter()
    clock.now += 0.010
    assert shares.leave(mark) == pytest.approx(0.010)
