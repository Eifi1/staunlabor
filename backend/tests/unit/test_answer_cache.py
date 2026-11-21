"""The kept answers (``staunlabor.answer_cache``): one calculation per question."""

from __future__ import annotations

import asyncio

import pytest
from fastapi import FastAPI, HTTPException
from httpx import ASGITransport, AsyncClient

from staunlabor.answer_cache import CACHE_HEADER, MAX_ANSWER_BYTES, AnswerCacheMiddleware, AnswerStore, question

PREFIX = "/api/v1"


def _site(**cache: int) -> tuple[FastAPI, dict[str, int]]:
    """A small app with routes like the engine's, counting its calculations."""
    app = FastAPI()
    computed = {"n": 0}

    @app.post(f"{PREFIX}/experiments/square")
    async def square(body: dict[str, float]) -> dict[str, float]:
        computed["n"] += 1
        await asyncio.sleep(0.05)
        return {"square": body["x"] ** 2}

    @app.post(f"{PREFIX}/experiments/refuse")
    async def refuse(body: dict[str, float]) -> dict[str, float]:
        computed["n"] += 1
        raise HTTPException(status_code=400, detail="no")

    @app.get(f"{PREFIX}/experiments/defaults")
    async def defaults() -> dict[str, int]:
        computed["n"] += 1
        return {"x": 1}

    @app.get(f"{PREFIX}/experiments/checks")
    async def checks() -> dict[str, int]:
        computed["n"] += 1
        return {"checked": computed["n"]}

    app.add_middleware(AnswerCacheMiddleware, prefix=PREFIX, **cache)
    return app, computed


def _client(app: FastAPI) -> AsyncClient:
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


async def test_the_same_question_is_computed_once_and_says_so():
    app, computed = _site()
    async with _client(app) as client:
        first = await client.post(f"{PREFIX}/experiments/square", json={"x": 3})
        again = await client.post(f"{PREFIX}/experiments/square", content=b'{ "x" : 3 }')
    assert first.json() == again.json() == {"square": 9}
    assert computed["n"] == 1
    assert first.headers[CACHE_HEADER.decode()] == "miss"
    assert again.headers[CACHE_HEADER.decode()] == "hit"
    assert again.headers["content-type"] == "application/json"


async def test_a_different_question_is_computed_on_its_own():
    app, computed = _site()
    async with _client(app) as client:
        await client.post(f"{PREFIX}/experiments/square", json={"x": 3})
        other = await client.post(f"{PREFIX}/experiments/square", json={"x": 4})
    assert other.json() == {"square": 16}
    assert computed["n"] == 2


async def test_a_crowd_asking_at_once_waits_for_one_calculation():
    app, computed = _site()
    async with _client(app) as client:
        answers = await asyncio.gather(*(client.post(f"{PREFIX}/experiments/square", json={"x": 5}) for _ in range(20)))
    assert [a.json() for a in answers] == [{"square": 25}] * 20
    assert computed["n"] == 1


async def test_a_refusal_is_not_kept():
    app, computed = _site()
    async with _client(app) as client:
        for _ in range(2):
            assert (await client.post(f"{PREFIX}/experiments/refuse", json={"x": 1})).status_code == 400
    assert computed["n"] == 2


@pytest.mark.parametrize("path", ["/experiments/defaults", "/experiments/checks"])
async def test_the_defaults_and_the_checks_are_never_kept(path: str):
    app, computed = _site()
    async with _client(app) as client:
        for _ in range(2):
            response = await client.get(PREFIX + path)
            assert CACHE_HEADER.decode() not in response.headers
    assert computed["n"] == 2


async def test_a_body_that_is_not_json_is_passed_on_and_not_kept():
    app, computed = _site()
    async with _client(app) as client:
        for _ in range(2):
            response = await client.post(f"{PREFIX}/experiments/square", content=b"not json")
            assert response.status_code == 422
    assert computed["n"] == 0
    assert question({"method": "POST", "path": "/x"}, b"not json") is None


def test_the_store_lets_the_least_recently_asked_go_first():
    store = AnswerStore(max_bytes=10)
    store.put("a", b"1234", None)
    store.put("b", b"1234", None)
    assert store.get("a") is not None  # a is now the more recent
    store.put("c", b"1234", None)
    assert store.get("b") is None
    assert store.get("a") is not None and store.get("c") is not None
    assert (len(store), store.size) == (2, 8)


def test_the_store_keeps_no_answer_too_big_for_it():
    store = AnswerStore()
    store.put("big", b"x" * (MAX_ANSWER_BYTES + 1), None)
    store.put("small", b"x", None)
    store.put("small", b"xy", None)
    assert store.get("big") is None
    assert (len(store), store.size) == (1, 2)
