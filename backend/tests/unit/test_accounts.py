"""What the app writes beside the kit's account layer: the signer, the hasher,
the transport, and the boot check that refuses a deployment anybody could take
over. No database."""

from __future__ import annotations

import logging
import time

import jwt
import pytest
from eifi1_server_kit.mail import ConsoleMailer, ResendClient

from staunlabor.accounts import BcryptHasher, JwtSigner, mailer_for
from staunlabor.main import check_deployment, create_app
from staunlabor.settings import DEV_JWT_SECRET, Settings, get_settings

pytestmark = pytest.mark.unit

KEY = "a-signing-key-of-thirty-two-characters-at-least"


def _claims(**extra: object) -> dict[str, object]:
    return {"sub": "1", "type": "access", "iat": time.time(), "exp": int(time.time()) + 60, **extra}


def test_a_token_this_app_signed_verifies_to_its_claims():
    signer = JwtSigner(KEY)
    claims = _claims(sid="abc")
    assert signer.verify(signer.sign(claims)) == claims


@pytest.mark.parametrize(
    "token",
    [
        jwt.encode(_claims(), "another-app-s-key-of-thirty-two-characters", algorithm="HS256"),
        jwt.encode(_claims(), key=None, algorithm="none"),
        jwt.encode({"sub": "1", "type": "access"}, KEY, algorithm="HS256"),
        jwt.encode(_claims(exp=int(time.time()) - 1), KEY, algorithm="HS256"),
        "not.a.token",
        "",
    ],
    ids=["another key", "unsigned", "never ends", "expired", "no JWT", "empty"],
)
def test_a_token_this_app_did_not_sign_or_that_ended_is_nothing(token: str):
    assert JwtSigner(KEY).verify(token) is None


def test_a_password_verifies_against_its_own_hash_and_nothing_else():
    hasher = BcryptHasher(4)
    hashed = hasher.hash("correct horse battery staple")
    assert hashed.startswith("$2b$04$")
    assert hasher.verify("correct horse battery staple", hashed)
    assert not hasher.verify("Correct horse battery staple", hashed)


@pytest.mark.parametrize(
    ("password", "stored"),
    [("x", "not a bcrypt hash"), ("x" * 100, BcryptHasher(4).hash("x")), ("\ud800", BcryptHasher(4).hash("x"))],
    ids=["malformed hash", "over 72 bytes", "not encodable"],
)
def test_what_bcrypt_refuses_is_no_match_never_an_error(password: str, stored: str):
    assert BcryptHasher(4).verify(password, stored) is False


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
