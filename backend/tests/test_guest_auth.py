"""
tests/test_guest_auth.py
Tests for guest/demo mode authentication.
Covers: /auth/guest endpoint, token structure, response shape.
"""
import jwt
import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture
def client():
    from main import app
    with patch("services.rate_limiter.limiter.limit", return_value=lambda f: f):
        with patch("slowapi.extension.Limiter._check_request_limit"):
            yield TestClient(app, raise_server_exceptions=True)


@pytest.fixture
def guest_response(client):
    """Cached guest login response used across multiple tests."""
    return client.post("/auth/guest")


# ── Endpoint tests ────────────────────────────────────────────────────────────

def test_guest_login_returns_200(guest_response):
    assert guest_response.status_code == 200


def test_guest_response_has_required_keys(guest_response):
    data = guest_response.json()
    assert "token" in data
    assert "user" in data
    assert "limits" in data


def test_guest_user_fields(guest_response):
    user = guest_response.json()["user"]
    assert user["id"] == "guest"
    assert user["email"] == "guest@qualif.ai"
    assert user["is_guest"] is True


def test_guest_limits(guest_response):
    limits = guest_response.json()["limits"]
    assert limits["max_questions"] == 3
    assert limits["mode"] == "quick"
    assert limits["expires_hours"] == 2


# ── Token structure tests ─────────────────────────────────────────────────────

def test_guest_token_is_valid_jwt(guest_response):
    from config import settings
    token = guest_response.json()["token"]
    payload = jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
    assert payload["sub"] == "guest"
    assert payload["role"] == "guest"


def test_guest_token_has_expiry(guest_response):
    from config import settings
    token = guest_response.json()["token"]
    payload = jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
    assert "exp" in payload


# ── Unit test: create_guest_token ─────────────────────────────────────────────

def test_create_guest_token_payload():
    from config import settings
    from services.auth_service import create_guest_token
    token = create_guest_token()
    payload = jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
    assert payload["sub"] == "guest"
    assert payload["role"] == "guest"
    assert "exp" in payload
