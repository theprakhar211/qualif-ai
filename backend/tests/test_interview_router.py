"""
tests/test_interview_router.py

Tests for routers/interview.py covering:
  - _compute_communication_score  (pure function — no mocking needed)
  - get_phase                     (pure function — no mocking needed)
  - POST /interview/start
  - GET  /interview/session/{id}
  - POST /interview/end/{id}
  - POST /interview/submit-answer/{id}
  - POST /interview/evaluate/{id}

Fixtures (mock_user, mock_session, mock_db, test_client) come from conftest.py.
"""

from unittest.mock import AsyncMock, patch
from bson import ObjectId

from routers.interview import _compute_communication_score, get_phase


# ═══════════════════════════════════════════════════════════════════════════════
# _compute_communication_score — pure function tests
# ═══════════════════════════════════════════════════════════════════════════════

class TestComputeCommunicationScore:

    def test_returns_none_when_insufficient_data(self):
        """Returns None when word_count < 20 or wpm == 0."""
        assert _compute_communication_score(
            {"word_count": 10, "wpm": 120}) is None
        assert _compute_communication_score(
            {"word_count": 50, "wpm": 0}) is None

    def test_ideal_wpm_no_penalty(self):
        """WPM in 110-170 range incurs no penalty."""
        answer = {"wpm": 140, "word_count": 100, "ttr": 0.6,
                  "hedging_ratio": 0.0, "filler_words": [], "avg_sentence_len": 12}
        score = _compute_communication_score(answer)
        assert score is not None
        assert score >= 90  # no penalties applied

    def test_slow_wpm_penalty(self):
        """WPM below 80 incurs -20 penalty."""
        answer = {"wpm": 60, "word_count": 100, "ttr": 0.6,
                  "hedging_ratio": 0.0, "filler_words": [], "avg_sentence_len": 12}
        ideal_answer = {"wpm": 140, "word_count": 100, "ttr": 0.6,
                        "hedging_ratio": 0.0, "filler_words": [], "avg_sentence_len": 12}
        slow_score = _compute_communication_score(answer)
        ideal_score = _compute_communication_score(ideal_answer)
        assert slow_score < ideal_score

    def test_fast_wpm_penalty(self):
        """WPM above 200 incurs -15 penalty."""
        answer = {"wpm": 220, "word_count": 100, "ttr": 0.6,
                  "hedging_ratio": 0.0, "filler_words": [], "avg_sentence_len": 12}
        ideal = {"wpm": 140, "word_count": 100, "ttr": 0.6,
                 "hedging_ratio": 0.0, "filler_words": [], "avg_sentence_len": 12}
        assert _compute_communication_score(
            answer) < _compute_communication_score(ideal)

    def test_high_hedging_penalty(self):
        """Hedging ratio above 0.5 incurs -20 penalty."""
        hedgy = {"wpm": 140, "word_count": 100, "ttr": 0.6,
                 "hedging_ratio": 0.6, "filler_words": [], "avg_sentence_len": 12}
        confident = {"wpm": 140, "word_count": 100, "ttr": 0.6,
                     "hedging_ratio": 0.0, "filler_words": [], "avg_sentence_len": 12}
        assert _compute_communication_score(
            hedgy) < _compute_communication_score(confident)

    def test_low_ttr_penalty(self):
        """TTR below 0.35 incurs -20 penalty."""
        repetitive = {"wpm": 140, "word_count": 100, "ttr": 0.2,
                      "hedging_ratio": 0.0, "filler_words": [], "avg_sentence_len": 12}
        rich = {"wpm": 140, "word_count": 100, "ttr": 0.6,
                "hedging_ratio": 0.0, "filler_words": [], "avg_sentence_len": 12}
        assert _compute_communication_score(
            repetitive) < _compute_communication_score(rich)

    def test_score_clamped_to_0_100(self):
        """Score never goes below 0 or above 100."""
        terrible = {"wpm": 50, "word_count": 25, "ttr": 0.1,
                    "hedging_ratio": 1.0, "filler_words": ["um"] * 20, "avg_sentence_len": 2}
        score = _compute_communication_score(terrible)
        assert score is not None
        assert 0.0 <= score <= 100.0

    def test_high_ttr_bonus(self):
        """TTR >= 0.65 gives +5 bonus; TTR < 0.35 gives -20 penalty."""
        rich = {"wpm": 140, "word_count": 100, "ttr": 0.7,
                "hedging_ratio": 0.0, "filler_words": [], "avg_sentence_len": 12}
        poor = {"wpm": 140, "word_count": 100, "ttr": 0.2,
                "hedging_ratio": 0.0, "filler_words": [], "avg_sentence_len": 12}
        assert _compute_communication_score(
            rich) > _compute_communication_score(poor)


# ═══════════════════════════════════════════════════════════════════════════════
# get_phase — pure function tests
# ═══════════════════════════════════════════════════════════════════════════════

class TestGetPhase:

    def test_quick_always_technical(self):
        """Quick practice is always technical regardless of question number."""
        for q in range(1, 9):
            assert get_phase(q, "quick") == "technical"

    def test_complete_intro_phase(self):
        """Questions 1-2 are intro phase in complete interview."""
        assert get_phase(1, "complete") == "intro"
        assert get_phase(2, "complete") == "intro"

    def test_complete_resume_phase(self):
        """Questions 3-4 are resume phase in complete interview."""
        assert get_phase(3, "complete") == "resume"
        assert get_phase(4, "complete") == "resume"

    def test_complete_technical_phase(self):
        """Questions 5-7 are technical phase in complete interview."""
        assert get_phase(5, "complete") == "technical"
        assert get_phase(6, "complete") == "technical"
        assert get_phase(7, "complete") == "technical"

    def test_complete_behavioural_phase(self):
        """Question 8+ is behavioural phase in complete interview."""
        assert get_phase(8, "complete") == "behavioural"
        assert get_phase(9, "complete") == "behavioural"


# ═══════════════════════════════════════════════════════════════════════════════
# Route tests — require test_client + mock_db fixtures from conftest.py
# ═══════════════════════════════════════════════════════════════════════════════

class TestStartInterview:

    def test_start_quick_interview(self, test_client, mock_db):
        """POST /start returns session_id and first_question for quick interview."""
        with patch("routers.interview.generate_question_adaptive",
                   new=AsyncMock(return_value=("What is a hash map?", "Data Structures"))):
            response = test_client.post("/interview/start", json={
                "role": "Software Engineer",
                "topics": ["Data Structures"],
                "difficulty": "medium",
                "interview_type": "quick",
            })
        assert response.status_code == 200
        data = response.json()
        assert "session_id" in data
        assert "first_question" in data
        assert data["interview_type"] == "quick"
        assert data["phase"] == "technical"

    def test_start_complete_interview_uses_intro(self, test_client, mock_db):
        """Complete interview starts with intro phase."""
        with patch("routers.interview.generate_intro_question",
                   new=AsyncMock(return_value="Tell me about yourself.")):
            response = test_client.post("/interview/start", json={
                "role": "Software Engineer",
                "topics": ["System Design"],
                "difficulty": "hard",
                "interview_type": "complete",
            })
        assert response.status_code == 200
        data = response.json()
        assert data["phase"] == "intro"
        assert data["interview_type"] == "complete"

    def test_start_defaults_to_quick_if_type_missing(self, test_client, mock_db):
        """interview_type defaults to quick when not provided."""
        with patch("routers.interview.generate_question_adaptive",
                   new=AsyncMock(return_value=("What is a linked list?", "Data Structures"))):
            response = test_client.post("/interview/start", json={
                "role": "Software Engineer",
                "topics": ["Data Structures"],
                "difficulty": "easy",
            })
        assert response.status_code == 200
        assert response.json()["interview_type"] == "quick"


class TestGetSession:

    def test_get_existing_session(self, test_client, mock_db, mock_session):
        """GET /session/{id} returns session data for valid id."""
        session_id = str(mock_session["_id"])
        response = test_client.get(f"/interview/session/{session_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["role"] == "Software Engineer"

    def test_get_nonexistent_session_returns_404(self, test_client, mock_db):
        """GET /session/{id} returns 404 when session not found."""
        mock_db.sessions_col.find_one = AsyncMock(return_value=None)
        response = test_client.get(f"/interview/session/{ObjectId()}")
        assert response.status_code == 404


class TestEndInterview:

    def test_end_interview_returns_200(self, test_client, mock_db, mock_session):
        """POST /end/{id} marks session as completed."""
        session_id = str(mock_session["_id"])
        response = test_client.post(f"/interview/end/{session_id}")
        assert response.status_code == 200
        mock_db.sessions_col.update_one.assert_called_once()


class TestSubmitAnswer:

    def test_submit_voice_answer(self, test_client, mock_db, mock_session):
        """POST /submit-answer stores answer and returns metrics."""
        session_id = str(mock_session["_id"])
        response = test_client.post(f"/interview/submit-answer/{session_id}", json={
            "question": "Explain how a hash map works.",
            "transcript": "A hash map stores key value pairs using a hash function to compute an index into an array of buckets.",
            "input_mode": "voice",
            "duration_seconds": 15.0,
            "topic": "Data Structures",
        })
        assert response.status_code == 200
        data = response.json()
        assert data["stored"] is True
        assert "word_count" in data
        assert "wpm" in data

    def test_submit_answer_always_stores(self, test_client, mock_db):
        """POST /submit-answer calls update_one even if session doesn't exist.
        The route uses update_one directly without a prior find_one check."""
        response = test_client.post(f"/interview/submit-answer/{ObjectId()}", json={
            "question": "Test?",
            "transcript": "Test answer with enough words to be valid for processing.",
            "input_mode": "voice",
            "duration_seconds": 5.0,
            "topic": "General",
        })
        assert response.status_code == 200
        mock_db.sessions_col.update_one.assert_called_once()

    def test_submit_typed_answer_no_filler_detection(self, test_client, mock_db, mock_session):
        """Typed answers skip filler word detection."""
        session_id = str(mock_session["_id"])
        response = test_client.post(f"/interview/submit-answer/{session_id}", json={
            "question": "What is a stack?",
            "transcript": "um basically a stack is like you know a LIFO structure",
            "input_mode": "text",
            "duration_seconds": 10.0,
            "topic": "Data Structures",
        })
        assert response.status_code == 200
        # Typed mode — filler_words should be empty
        assert response.json()["filler_words"] == []


class TestEvaluateSession:

    def test_evaluate_returns_scores(self, test_client, mock_db, mock_session):
        """POST /evaluate returns overall_score and per-answer results."""
        session_with_answers = {
            **mock_session,
            "answers": [{
                "question_text": "Explain how a hash map works.",
                "transcript": "A hash map uses a hash function to map keys to array indices allowing O(1) lookup on average.",
                "input_mode": "voice",
                "phase": "technical",
                "topic": "Data Structures",
                "duration_seconds": 20.0,
                "word_count": 20,
                "wpm": 130,
                "filler_words": [],
                "ttr": 0.8,
                "hedging_ratio": 0.1,
                "avg_sentence_len": 15.0,
            }]
        }
        mock_db.sessions_col.find_one = AsyncMock(
            return_value=session_with_answers)

        fake_eval = [{
            "question_number": 1,
            "score": 75,
            "reasoning": "Good answer covering key concepts.",
            "keywords_mentioned": ["hash function", "O(1)"],
            "missing_concepts": ["collision handling"],
            "corrected_transcript": "A hash map uses a hash function to map keys to array indices allowing O(1) lookup on average.",
        }]

        with patch("routers.interview.batch_evaluate", new=AsyncMock(return_value=fake_eval)), \
                patch("routers.interview.update_skill_graph_from_session", new=AsyncMock()), \
                patch("routers.interview.benchmark_session_answers", new=AsyncMock(return_value=session_with_answers["answers"])):
            response = test_client.post(
                f"/interview/evaluate/{str(mock_session['_id'])}")

        assert response.status_code == 200
        data = response.json()
        assert "overall_score" in data
        assert "answers" in data
        assert len(data["answers"]) == 1

    def test_evaluate_no_answers_returns_400(self, test_client, mock_db, mock_session):
        """POST /evaluate returns 400 when session has no answers."""
        mock_db.sessions_col.find_one = AsyncMock(
            return_value={**mock_session, "answers": []})
        response = test_client.post(
            f"/interview/evaluate/{str(mock_session['_id'])}")
        assert response.status_code == 400

    def test_evaluate_session_not_found_returns_404(self, test_client, mock_db):
        """POST /evaluate returns 404 for missing session."""
        mock_db.sessions_col.find_one = AsyncMock(return_value=None)
        response = test_client.post(f"/interview/evaluate/{ObjectId()}")
        assert response.status_code == 404
