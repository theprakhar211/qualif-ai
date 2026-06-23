"""
tests/test_guest_auth.py
Tests for guest/demo mode authentication.
Covers: token structure and payload via direct service calls.
Note: /auth/guest endpoint is rate-limited by slowapi which conflicts with
TestClient; endpoint integration is covered by Playwright E2E tests instead.
"""
import time
import jwt
from services.auth_service import create_guest_token
from config import settings


def test_guest_token_is_string():
    token = create_guest_token()
    assert isinstance(token, str)
    assert len(token) > 0


def test_guest_token_is_valid_jwt():
    token = create_guest_token()
    payload = jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
    assert payload["sub"] == "guest"
    assert payload["role"] == "guest"


def test_guest_token_has_expiry():
    token = create_guest_token()
    payload = jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
    assert "exp" in payload


def test_guest_token_sub_is_guest():
    token = create_guest_token()
    payload = jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
    assert payload["sub"] == "guest"


def test_guest_token_role_is_guest():
    token = create_guest_token()
    payload = jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
    assert payload["role"] == "guest"


def test_guest_tokens_are_unique():
    """Each call produces a different token (different exp timestamp)."""
    token1 = create_guest_token()
    time.sleep(1)
    token2 = create_guest_token()
    assert token1 != token2
