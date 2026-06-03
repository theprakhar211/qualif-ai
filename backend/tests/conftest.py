"""
tests/conftest.py
Shared test infrastructure for all test modules.

Fixtures available to every test file automatically:
  - mock_user        : fake authenticated user dict
  - mock_session     : fake interview session dict
  - mock_db          : AsyncMock patching db_instance (no real MongoDB)
  - test_client      : FastAPI TestClient with auth bypassed
"""

import sys
import os
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch
from bson import ObjectId

import pytest
from fastapi.testclient import TestClient

# Allow `from services.xxx import ...` to resolve from backend/
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


# ── Shared fake data ──────────────────────────────────────────────────────────

USER_OID = ObjectId()
SESSION_OID = ObjectId()


@pytest.fixture
def mock_user():
    """Fake authenticated user — reused across all router tests."""
    return {
        "_id": USER_OID,
        "name": "Test User",
        "email": "test@example.com",
        "resume": {},
        "seen_question_hashes": [],
    }


@pytest.fixture
def mock_session():
    """Fake interview session document — reused across all router tests."""
    return {
        "_id": SESSION_OID,
        "user_id": str(USER_OID),
        "role": "Software Engineer",
        "topics": ["Data Structures"],
        "difficulty": "medium",
        "interview_type": "quick",
        "current_phase": "technical",
        "status": "active",
        "current_question": "Explain how a hash map works.",
        "asked_questions": ["Explain how a hash map works."],
        "session_skills_covered": ["Data Structures"],
        "answers": [],
        "resume_data": {},
        "evaluated": False,
        "overall_score": 0,
        "created_at": datetime.utcnow(),
    }


# ── Database mock ─────────────────────────────────────────────────────────────

@pytest.fixture
def mock_db(mock_user, mock_session):
    """
    Patches db_instance with AsyncMocks so no real MongoDB calls are made.
    Wires up the most common query results used across router tests.
    Each test can override individual methods as needed.
    """
    with patch("routers.interview.db_instance") as mock:
        # users_col
        mock.users_col.find_one = AsyncMock(return_value=mock_user)
        mock.users_col.update_one = AsyncMock(return_value=MagicMock())

        # sessions_col
        insert_result = MagicMock()
        insert_result.inserted_id = SESSION_OID
        mock.sessions_col.insert_one = AsyncMock(return_value=insert_result)
        mock.sessions_col.find_one = AsyncMock(return_value={**mock_session})
        mock.sessions_col.update_one = AsyncMock(return_value=MagicMock())

        yield mock


# ── TestClient with auth bypassed ─────────────────────────────────────────────

@pytest.fixture
def test_client(mock_user):
    """
    FastAPI TestClient with get_current_user dependency overridden.
    Auth is not what we're testing here — we test route logic.
    Import is inside the fixture so sys.path is already set up.
    """
    from main import app
    from services.dependencies import get_current_user

    async def override_auth():
        return mock_user

    app.dependency_overrides[get_current_user] = override_auth
    client = TestClient(app, raise_server_exceptions=False)
    yield client
    app.dependency_overrides.clear()
