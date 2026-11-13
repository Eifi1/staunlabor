"""Whose budget a request spends: the caller's address, as far as the proxies
can vouch for it.

Three proxies append to ``X-Forwarded-For`` on the site's own path (the web
service's front end, Caddy, the backend's front end), and the budget reads the
third entry from the right. That count is only true of requests that came
through Caddy, which proves it by the edge token it sets; any other request
(the backend's run.app URL reached directly, if it ever is public again) is
counted from the one entry its own front end appended, so a forged header buys
no fresh budget."""

from __future__ import annotations

import pytest
from starlette.requests import Request

from staunlabor.security import EDGE_HEADER, caller_address
from staunlabor.settings import get_settings

pytestmark = pytest.mark.unit

TOKEN = "edge-token-for-the-tests"


def _request(forwarded: str, *, edge: str | None = None, peer: str = "169.254.1.1") -> Request:
    headers = [(b"x-forwarded-for", forwarded.encode())]
    if edge is not None:
        headers.append((EDGE_HEADER.encode(), edge.encode("latin-1")))
    return Request({"type": "http", "headers": headers, "client": (peer, 1234)})


@pytest.fixture
def behind_the_site(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("STAUNLABOR_TRUSTED_PROXY_HOPS", "3")
    monkeypatch.setenv("STAUNLABOR_EDGE_TOKEN", TOKEN)
    get_settings.cache_clear()


@pytest.mark.usefixtures("behind_the_site")
def test_a_request_through_caddy_is_counted_three_entries_from_the_right():
    request = _request("198.51.100.9, 203.0.113.7, 169.254.8.1, 10.164.0.5", edge=TOKEN)
    assert caller_address(request) == "203.0.113.7"


@pytest.mark.usefixtures("behind_the_site")
def test_a_request_without_the_edge_token_is_counted_from_its_own_front_end():
    """The bypass of 2026-11-13: a direct request with a forged left part."""
    request = _request("203.0.113.1, 198.51.100.1, 192.0.2.44")
    assert caller_address(request) == "192.0.2.44"


@pytest.mark.usefixtures("behind_the_site")
def test_a_wrong_edge_token_proves_nothing():
    request = _request("203.0.113.1, 198.51.100.1, 192.0.2.44", edge="a-guess")
    assert caller_address(request) == "192.0.2.44"


def test_without_a_configured_token_every_request_shares_the_edge_s_window(monkeypatch: pytest.MonkeyPatch):
    """The safe error: it limits too much, never too little."""
    monkeypatch.setenv("STAUNLABOR_TRUSTED_PROXY_HOPS", "3")
    monkeypatch.delenv("STAUNLABOR_EDGE_TOKEN", raising=False)
    get_settings.cache_clear()
    request = _request("198.51.100.9, 203.0.113.7, 169.254.8.1, 10.164.0.5", edge=TOKEN)
    assert caller_address(request) == "10.164.0.5"


def test_in_development_with_no_proxy_the_peer_is_the_caller(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.delenv("STAUNLABOR_TRUSTED_PROXY_HOPS", raising=False)
    get_settings.cache_clear()
    assert caller_address(_request("203.0.113.1", peer="127.0.0.1")) == "127.0.0.1"
