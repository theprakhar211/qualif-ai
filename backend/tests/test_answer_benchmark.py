"""
Tests for services/answer_benchmark.py - benchmark_session_answers
(get_or_generate_ideal_answer and benchmark_answer are mocked).
"""
import asyncio
import time
from unittest.mock import AsyncMock, patch

import pytest

from services.answer_benchmark import _parse_json_response, benchmark_session_answers

IDEAL = {"ideal_answer": "ideal", "key_concepts": ["a"],
         "scoring_rubric": {}, "common_mistakes": []}


def _answers(n):
    return [{"question_text": f"Q{i}", "transcript": f"answer {i}",
             "topic": "t", "difficulty": "medium"} for i in range(n)]


class TestBenchmarkSessionAnswers:

    @pytest.mark.asyncio
    async def test_attaches_results_and_keeps_order(self):
        with patch("services.answer_benchmark.get_or_generate_ideal_answer",
                   new=AsyncMock(return_value=IDEAL)), \
             patch("services.answer_benchmark.benchmark_answer",
                   new=AsyncMock(return_value={"similarity_score": 80})):
            out = await benchmark_session_answers(None, _answers(3), "Engineer")
        assert [a["question_text"] for a in out] == ["Q0", "Q1", "Q2"]
        assert all(a["ideal_answer"] == "ideal" for a in out)
        assert all(a["comparison"]["similarity_score"] == 80 for a in out)

    @pytest.mark.asyncio
    async def test_failure_returns_that_answer_unchanged(self):
        async def flaky(db, question_text, **kw):
            if question_text == "Q1":
                raise RuntimeError("boom")
            return IDEAL

        with patch("services.answer_benchmark.get_or_generate_ideal_answer", new=flaky), \
             patch("services.answer_benchmark.benchmark_answer",
                   new=AsyncMock(return_value={"similarity_score": 50})):
            out = await benchmark_session_answers(None, _answers(3), "Engineer")
        assert "ideal_answer" in out[0] and "ideal_answer" in out[2]
        assert "ideal_answer" not in out[1]

    @pytest.mark.asyncio
    async def test_answers_are_benchmarked_concurrently(self):
        async def slow_ideal(*a, **kw):
            await asyncio.sleep(0.1)
            return IDEAL

        with patch("services.answer_benchmark.get_or_generate_ideal_answer", new=slow_ideal), \
             patch("services.answer_benchmark.benchmark_answer",
                   new=AsyncMock(return_value={"similarity_score": 1})):
            start = time.perf_counter()
            await benchmark_session_answers(None, _answers(5), "Engineer")
            elapsed = time.perf_counter() - start
        # sequential would take >= 0.5s
        assert elapsed < 0.35


class TestParseJsonResponse:

    def test_plain_json(self):
        assert _parse_json_response('{"similarity_score": 70}') == {"similarity_score": 70}

    def test_fenced_json(self):
        assert _parse_json_response('```json\n{"a": 1}\n```') == {"a": 1}

    def test_json_embedded_in_text(self):
        assert _parse_json_response('Here you go: {"a": 1} done') == {"a": 1}

    def test_invalid_backslash_escape_is_repaired(self):
        out = _parse_json_response('{"comparison_feedback": "uses \\d+ regex"}')
        assert out is not None and "regex" in out["comparison_feedback"]

    def test_garbage_returns_none(self):
        assert _parse_json_response("not json") is None
        assert _parse_json_response(None) is None
