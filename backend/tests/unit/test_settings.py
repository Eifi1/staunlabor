"""What counts as a deployment, and the pool's cap."""

from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient

from staunlabor.main import create_app
from staunlabor.settings import Settings, get_settings, origin_is_local

pytestmark = pytest.mark.unit


@pytest.mark.parametrize(
    "url",
    [
        "http://localhost:5176",
        "http://127.0.0.1:8002",
        "http://[::1]:5176",
        "http://192.168.1.20:5176",
        "http://10.0.0.7",
        "http://staunlabor.local",
        "http://site.test",
        "http://0.0.0.0:8002",
    ],
)
def test_a_site_served_from_this_machine_or_a_private_network_is_local(url: str):
    assert origin_is_local(url)


@pytest.mark.parametrize(
    "url", ["https://staunlabor.app", "http://staunlabor.app", "https://8.8.8.8", "not a url", "http://"]
)
def test_a_public_origin_or_one_that_cannot_be_read_is_not_local(url: str):
    assert not origin_is_local(url)


def test_a_laptop_is_no_deployment(monkeypatch: pytest.MonkeyPatch):
    for name in ("K_SERVICE", "CLOUD_RUN_JOB", "STAUNLABOR_APP_BASE_URL"):
        monkeypatch.delenv(name, raising=False)
    assert not Settings().deployed


def test_the_public_origin_makes_a_deployment(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("STAUNLABOR_APP_BASE_URL", "https://staunlabor.app")
    assert Settings().deployed


@pytest.mark.parametrize("variable", ["K_SERVICE", "CLOUD_RUN_JOB"])
def test_cloud_run_makes_a_deployment_even_with_the_development_origin(monkeypatch: pytest.MonkeyPatch, variable: str):
    """A deployment that forgot its base URL still counts as one."""
    monkeypatch.delenv("STAUNLABOR_APP_BASE_URL", raising=False)
    monkeypatch.setenv(variable, "staunlabor-backend")
    assert Settings().deployed


def test_the_pool_keeps_one_connection_opens_one_more_and_waits_ten_seconds():
    """The shared instance's cap for every app on it (owner, 2026-11-13)."""
    pool = create_app().state.database.engine.pool
    assert (pool.size(), pool._max_overflow, pool._timeout) == (1, 1, 10)


async def test_the_app_starts_and_stops_with_no_database_and_the_exhibits_answer(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("STAUNLABOR_DATABASE_URL", "postgresql+asyncpg://nobody:nothing@127.0.0.1:1/none")
    get_settings.cache_clear()
    app = create_app()
    async with (
        app.router.lifespan_context(app),
        AsyncClient(transport=ASGITransport(app=app), base_url="http://t") as client,
    ):
        assert (await client.get("/api/v1/health")).status_code == 200
        assert (await client.get("/api/v1/experiments/chair")).status_code == 200
