"""What the app chooses beside the kit's account layer: the transport, and the
boot check that refuses a deployment anybody could take over. No database. The
signer and the hasher are server-kit's (0.30), tested there; the routes' tests
(``tests/api/test_accounts_api.py``) show they are wired with this app's key
and cost."""

from __future__ import annotations

import logging

import pytest
from eifi1_server_kit.mail import ConsoleMailer, ResendClient

from staunlabor.accounts import mailer_for
from staunlabor.main import check_deployment, create_app
from staunlabor.settings import DEV_JWT_SECRET, Settings, get_settings

pytestmark = pytest.mark.unit


def test_mail_goes_to_the_log_until_resend_is_chosen(monkeypatch: pytest.MonkeyPatch):
    assert isinstance(mailer_for(Settings()), ConsoleMailer)
    monkeypatch.setenv("STAUNLABOR_MAIL_BACKEND", "resend")
    monkeypatch.setenv("STAUNLABOR_RESEND_API_KEY", "re_test_key")
    assert isinstance(mailer_for(Settings()), ResendClient)


# ── The boot check ───────────────────────────────────────────────────────────

DEPLOYED = {
    "STAUNLABOR_APP_BASE_URL": "https://staunlabor.app",
    "STAUNLABOR_WEBAUTHN_RP_ID": "staunlabor.app",
    "STAUNLABOR_REGISTRATION_ALLOWLIST": "owner@example.com",
}


@pytest.fixture
def deployed(monkeypatch: pytest.MonkeyPatch) -> pytest.MonkeyPatch:
    for name, value in DEPLOYED.items():
        monkeypatch.setenv(name, value)
    return monkeypatch


def test_a_deployment_with_its_key_its_list_and_its_host_starts(deployed: pytest.MonkeyPatch, caplog):
    with caplog.at_level(logging.WARNING, logger="staunlabor.main"):
        check_deployment(Settings())
    # The console stand-in is allowed, and said once.
    assert [record.message for record in caplog.records] == [
        "Mail goes to the log (STAUNLABOR_MAIL_BACKEND=console): each line carries the mail's link."
    ]


@pytest.mark.parametrize(
    ("variable", "value", "named"),
    [
        ("STAUNLABOR_JWT_SECRET", DEV_JWT_SECRET, "STAUNLABOR_JWT_SECRET is a placeholder"),
        ("STAUNLABOR_JWT_SECRET", "short", "STAUNLABOR_JWT_SECRET is too short"),
        ("STAUNLABOR_REGISTRATION_ALLOWLIST", " , ", "STAUNLABOR_REGISTRATION_ALLOWLIST is empty"),
        ("STAUNLABOR_WEBAUTHN_RP_ID", "localhost", "STAUNLABOR_WEBAUTHN_RP_ID ('localhost') is neither"),
    ],
)
def test_a_deployment_anybody_could_take_over_refuses_to_start(
    deployed: pytest.MonkeyPatch, variable: str, value: str, named: str
):
    deployed.setenv(variable, value)
    get_settings.cache_clear()
    with pytest.raises(RuntimeError, match="Refusing to start a deployment") as refused:
        create_app()
    assert named in str(refused.value)


def test_cloud_run_with_the_development_defaults_refuses_to_start(monkeypatch: pytest.MonkeyPatch):
    """A deployment that forgot every variable: the repository's key, no list."""
    monkeypatch.setenv("K_SERVICE", "staunlabor-backend")
    monkeypatch.setenv("STAUNLABOR_JWT_SECRET", DEV_JWT_SECRET)
    with pytest.raises(RuntimeError, match=r"placeholder.*REGISTRATION_ALLOWLIST is empty") as refused:
        check_deployment(Settings())
    # The refusal goes to the log: it names the variable, never the key.
    assert DEV_JWT_SECRET not in str(refused.value)


def test_a_laptop_starts_with_the_repository_s_key_and_says_so(monkeypatch: pytest.MonkeyPatch, caplog):
    monkeypatch.setenv("STAUNLABOR_JWT_SECRET", DEV_JWT_SECRET)
    monkeypatch.setenv("STAUNLABOR_APP_BASE_URL", "http://192.168.1.20:5176")
    with caplog.at_level(logging.WARNING, logger="staunlabor.main"):
        check_deployment(Settings())
    messages = " ".join(record.message for record in caplog.records)
    assert "STAUNLABOR_JWT_SECRET is a placeholder" in messages and "STAUNLABOR_WEBAUTHN_RP_ID" in messages
    assert DEV_JWT_SECRET not in messages
