"""What the app chooses beside the kit's account layer: the transport, and the
boot check that refuses a deployment anybody could take over. No database. The
signer and the hasher are server-kit's (0.30), tested there; the routes' tests
(``tests/api/test_accounts_api.py``) show they are wired with this app's key
and cost."""

from __future__ import annotations

import logging

import pytest
from eifi1_server_kit.mail import ConsoleMailer, MailMessage, ResendClient

from staunlabor.accounts import mailer_for
from staunlabor.main import check_deployment, create_app
from staunlabor.settings import DEV_JWT_SECRET, DEV_TOTP_KEYS, Settings, get_settings

pytestmark = pytest.mark.unit


def test_mail_goes_to_the_log_until_resend_is_chosen(monkeypatch: pytest.MonkeyPatch):
    assert isinstance(mailer_for(Settings()), ConsoleMailer)
    monkeypatch.setenv("STAUNLABOR_MAIL_BACKEND", "resend")
    monkeypatch.setenv("STAUNLABOR_RESEND_API_KEY", "re_test_key")
    assert isinstance(mailer_for(Settings()), ResendClient)


LINK = "http://localhost:5176/verify-email?token=the-unspent-token"
MAIL = MailMessage(subject="Bitte bestätigen Sie Ihre Adresse", text=f"Bestätigen: {LINK}")


async def _logged(caplog: pytest.LogCaptureFixture) -> logging.LogRecord:
    with caplog.at_level(logging.DEBUG, logger="eifi1_server_kit.mail"):
        assert await mailer_for(Settings()).send("ada@example.com", MAIL, kind="verification") is True
    [record] = [record for record in caplog.records if record.name == "eifi1_server_kit.mail"]
    return record


async def test_a_laptop_s_console_shows_the_whole_mail_as_a_warning_a_developer_sees(
    caplog: pytest.LogCaptureFixture,
):
    record = await _logged(caplog)
    assert record.levelno == logging.WARNING
    assert LINK in record.getMessage() and "ada@example.com" in record.getMessage()


async def test_a_deployment_s_console_logs_the_mail_s_kind_and_never_its_link_or_address(
    deployed: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
):
    record = await _logged(caplog)
    assert record.levelno == logging.WARNING and "verification" in record.getMessage()
    assert "token" not in record.getMessage() and "ada@" not in record.getMessage()


# ── The boot check ───────────────────────────────────────────────────────────

DEPLOYED = {
    "STAUNLABOR_APP_BASE_URL": "https://staunlabor.app",
    "STAUNLABOR_WEBAUTHN_RP_ID": "staunlabor.app",
    "STAUNLABOR_REGISTRATION_ALLOWLIST": "owner@example.com",
    "STAUNLABOR_JOBS_TOKEN": "a-jobs-token-long-enough-for-a-deployment-0123",
    "STAUNLABOR_TOTP_KEYS": "a-seal-key-long-enough-for-a-deployment-4567",
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
    [said] = [record.message for record in caplog.records]
    assert said.startswith("Mail is not sent (STAUNLABOR_MAIL_BACKEND=console): the log names each mail's kind alone")


@pytest.mark.parametrize(
    ("variable", "value", "named"),
    [
        ("STAUNLABOR_JWT_SECRET", DEV_JWT_SECRET, "STAUNLABOR_JWT_SECRET is a placeholder"),
        ("STAUNLABOR_JWT_SECRET", "short", "STAUNLABOR_JWT_SECRET is too short"),
        ("STAUNLABOR_REGISTRATION_ALLOWLIST", " , ", "STAUNLABOR_REGISTRATION_ALLOWLIST is empty"),
        ("STAUNLABOR_WEBAUTHN_RP_ID", "localhost", "STAUNLABOR_WEBAUTHN_RP_ID ('localhost') is neither"),
        ("STAUNLABOR_JOBS_TOKEN", "short", "STAUNLABOR_JOBS_TOKEN is too short"),
        ("STAUNLABOR_TOTP_KEYS", DEV_TOTP_KEYS, "STAUNLABOR_TOTP_KEYS is a placeholder"),
        ("STAUNLABOR_TOTP_KEYS", " ", "STAUNLABOR_TOTP_KEYS is not set"),
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
